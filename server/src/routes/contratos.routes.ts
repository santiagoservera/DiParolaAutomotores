import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware, requirePermiso, puedeVerTodos, puedeAcceder, esAdmin, AuthRequest } from '../middlewares/auth.middleware.js';
import { upload, destruirSubida } from '../middlewares/upload.middleware.js';
import cloudinary from '../config/cloudinary.js';
import { handleError, HttpError } from '../utils/errorHandler.js';
import { parseFechaAR, esFechaValida, filtroDesdeAR, filtroHastaAR, fechaCalendarioAR, partesFechaAR } from '../utils/fechas.js';
import { parsePaginacion, parseId } from '../utils/paginacion.js';

const router = Router();
const prisma = new PrismaClient();

// ── Validación ──────────────────────────────────────────────────────────────

const contratoSchema = z.object({
  numeroContrato: z.string().min(1, 'Número de solicitud requerido').max(50),
  puntoVenta: z.enum(['SALON', 'STAND', 'CASA_CLIENTE', 'ONLINE', 'OTRO']),
  productorAsesor: z.string().min(1, 'Productor asesor requerido').max(150),
  tipoVehiculo: z.enum(['AUTO', 'UTILITARIO', 'CAMIONETA', 'MOTO', 'OTRO']),
  marca: z.string().min(1, 'Marca requerida').max(100),
  modelo: z.string().min(1, 'Modelo requerido').max(100),
  anticipoMensual: z.number().positive('El anticipo debe ser positivo').max(9999999999),
  montoSellado: z.number().min(0).max(9999999999).optional().nullable(),
  periodoPago: z.enum(['1-10', '10-20', '20-30']),
  cantidadCuotas: z.number().int().optional().default(0),

  solicitanteNombre: z.string().min(1, 'Nombre del solicitante requerido').max(200),
  solicitanteDni: z.string().min(1, 'DNI del solicitante requerido').max(20),
  solicitanteFechaNac: z.union([z.string().max(30), z.literal(''), z.null()]).optional(),
  solicitanteEstadoCivil: z.string().max(30).optional().nullable(),
  solicitanteDomicilio: z.string().max(255).optional().nullable(),
  solicitanteBarrio: z.string().max(100).optional().nullable(),
  solicitanteLocalidad: z.string().max(100).optional().nullable(),
  solicitanteCp: z.string().max(10).optional().nullable(),
  solicitanteProvincia: z.string().max(100).optional().nullable(),
  solicitanteCelular: z.string().min(1, 'Celular del solicitante requerido').max(50),
  solicitanteTelFijo: z.string().max(50).optional().nullable(),
  solicitanteHrContacto: z.string().max(50).optional().nullable(),
  solicitanteOcupacion: z.string().max(100).optional().nullable(),
  solicitanteEmail: z.union([z.string().email().max(255), z.literal(''), z.null()]).optional(),

  conyugeNombre: z.string().max(200).optional().nullable(),
  conyugeDni: z.string().max(20).optional().nullable(),
  conyugeFechaNac: z.union([z.string().max(30), z.literal(''), z.null()]).optional(),
  conyugeTelefono: z.string().max(50).optional().nullable(),

  tieneVehiculoUsado: z.boolean().default(false),
  usadoMarca: z.string().max(100).optional().nullable(),
  usadoModelo: z.string().max(100).optional().nullable(),
  usadoAnio: z.number().int().min(1900).max(2100).optional().nullable(),
  usadoColor: z.string().max(50).optional().nullable(),
  usadoCombustible: z.string().max(50).optional().nullable(),

  comoLlego: z.string().max(255).optional().nullable(),
  observaciones: z.string().max(10000).optional().nullable(),

  fechaPagoAnticipo: z.string().min(1, 'Fecha de pago del anticipo requerida').max(30),
  formaPagoAnticipo: z.string().min(1, 'Forma de pago del anticipo requerida').max(50),
  montosCuotas: z.array(z.number().positive()).optional(),
});

// Schema de edición (PUT): todos los campos opcionales. Se relajan algunos requeridos que
// contratos legacy/importados pueden tener vacíos (modelo, celular) para no bloquear su edición.
const contratoUpdateSchema = contratoSchema
  .omit({ fechaPagoAnticipo: true, formaPagoAnticipo: true, montosCuotas: true, cantidadCuotas: true })
  .extend({
    modelo: z.string().max(100),
    solicitanteCelular: z.string().max(50).nullable(),
    montoDevolucion: z.number().min(0).max(9999999999).nullable(),
    tipoFinanciamiento: z.enum(['SIN_SALDO', 'EXTERNO', 'CASA']).nullable(),
  })
  .partial();

// ── Helpers ─────────────────────────────────────────────────────────────────

function calcularFechaVencimiento(periodoPago: string, numeroCuota: number, fechaBase: Date): Date {
  const diaVencimiento = periodoPago === '1-10' ? 10 : periodoPago === '10-20' ? 20 : 30;
  const fecha = new Date(fechaBase);
  fecha.setMonth(fecha.getMonth() + numeroCuota);
  const ultimoDiaMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
  fecha.setDate(Math.min(diaVencimiento, ultimoDiaMes));
  return fecha;
}

function generarCuotas(
  contratoId: number,
  cantidadCuotas: number,
  anticipoMensual: number,
  periodoPago: string,
  montosCuotas?: number[]
) {
  const fechaBase = new Date();
  const cuotas = [];

  for (let i = 1; i <= cantidadCuotas; i++) {
    const monto = montosCuotas && montosCuotas[i - 1] !== undefined
      ? montosCuotas[i - 1]
      : anticipoMensual;

    cuotas.push({
      contratoId,
      numeroCuota: i,
      monto: new Prisma.Decimal(monto),
      fechaVencimiento: calcularFechaVencimiento(periodoPago, i, fechaBase),
    });
  }

  return cuotas;
}

// ── GET / - Listar contratos ────────────────────────────────────────────────

router.get('/', authMiddleware, requirePermiso('VENTAS', 'leer'), async (req: Request, res: Response) => {
  try {
    const { busqueda, estado, asesor, desde, hasta } = req.query;
    const pag = parsePaginacion(req.query, 100);
    if (typeof pag === 'string') return res.status(400).json({ error: pag });
    const { page, limit, skip } = pag;

    const where: any = {};

    // Filtro de visibilidad por permisos
    if (!puedeVerTodos(req as AuthRequest, 'VENTAS')) {
      where.registradoPorId = (req as any).userId;
    }

    if (estado && typeof estado === 'string') {
      where.estado = estado;
    } else {
      // Por defecto no mostrar cancelados
      where.estado = { not: 'CANCELADO' };
    }

    if (asesor && typeof asesor === 'string') {
      where.productorAsesor = { contains: asesor };
    }

    if (desde && typeof desde === 'string') {
      const d = filtroDesdeAR(desde);
      if (!esFechaValida(d)) return res.status(400).json({ error: 'Fecha "desde" inválida' });
      where.fechaCreacion = { ...where.fechaCreacion, gte: d };
    }
    if (hasta && typeof hasta === 'string') {
      const h = filtroHastaAR(hasta);
      if (!esFechaValida(h)) return res.status(400).json({ error: 'Fecha "hasta" inválida' });
      where.fechaCreacion = { ...where.fechaCreacion, lte: h };
    }

    if (busqueda && typeof busqueda === 'string') {
      where.OR = [
        { numeroContrato: { contains: busqueda, mode: 'insensitive' } },
        { solicitanteNombre: { contains: busqueda, mode: 'insensitive' } },
        { solicitanteDni: { contains: busqueda } },
        { productorAsesor: { contains: busqueda, mode: 'insensitive' } },
        { marca: { contains: busqueda, mode: 'insensitive' } },
      ];
    }

    const [contratos, total] = await Promise.all([
      prisma.contrato.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fechaCreacion: 'desc' },
        include: {
          registradoPor: { select: { id: true, nombre: true } },
          _count: { select: { cuotas: true, archivos: true } },
        },
      }),
      prisma.contrato.count({ where }),
    ]);

    res.json({
      data: contratos,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    handleError(error, 'listar contratos', res);
  }
});

// ── GET /asesores - Lista distinta de asesores ─────────────────────────────

router.get('/asesores', authMiddleware, requirePermiso('VENTAS', 'leer'), async (req: Request, res: Response) => {
  try {
    const where: any = {};
    if (!puedeVerTodos(req as AuthRequest, 'VENTAS')) {
      where.registradoPorId = (req as AuthRequest).userId;
    }
    const asesores = await prisma.contrato.findMany({
      where,
      select: { productorAsesor: true },
      distinct: ['productorAsesor'],
      orderBy: { productorAsesor: 'asc' },
    });
    res.json(asesores.map(a => a.productorAsesor));
  } catch (error: any) {
    handleError(error, 'listar asesores', res);
  }
});

// ── GET /vendedores - Lista de usuarios activos (para selector de asesor) ──

router.get('/vendedores', authMiddleware, requirePermiso('VENTAS', 'leer'), async (req: Request, res: Response) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
    res.json(usuarios);
  } catch (error: any) {
    handleError(error, 'listar vendedores', res);
  }
});

// ── GET /sync-asesores - Lista asesores distintos con cantidad de contratos ──

router.get('/sync-asesores', authMiddleware, requirePermiso('CONFIGURACION', 'leer'), async (req: Request, res: Response) => {
  try {
    const agrupados = await prisma.contrato.groupBy({
      by: ['productorAsesor'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    res.json(agrupados.map(a => ({ asesor: a.productorAsesor, contratos: a._count.id })));
  } catch (error: any) {
    handleError(error, 'listar asesores para sync', res);
  }
});

// ── POST /sync-asesores - Aplicar asociaciones manuales asesor → vendedor ───

router.post('/sync-asesores', authMiddleware, requirePermiso('CONFIGURACION', 'leer'), async (req: Request, res: Response) => {
  try {
    const { asociaciones } = req.body as { asociaciones: { asesor: string; vendedor: string }[] };
    if (!asociaciones || !Array.isArray(asociaciones) || asociaciones.length === 0) {
      return res.status(400).json({ error: 'Debe enviar al menos una asociación' });
    }

    let actualizados = 0;
    for (const { asesor, vendedor } of asociaciones) {
      if (!asesor || !vendedor || asesor === vendedor) continue;
      const count = await prisma.contrato.updateMany({
        where: { productorAsesor: asesor },
        data: { productorAsesor: vendedor },
      });
      actualizados += count.count;
    }

    res.json({ actualizados });
  } catch (error: any) {
    handleError(error, 'sincronizar asesores', res);
  }
});

// ── GET /stats/como-llego - Estadísticas agrupadas por comoLlego ───────────

router.get('/stats/como-llego', authMiddleware, requirePermiso('VENTAS', 'leer'), async (req: Request, res: Response) => {
  try {
    const where: any = { estado: { not: 'CANCELADO' } };
    if (!puedeVerTodos(req as AuthRequest, 'VENTAS')) {
      where.registradoPorId = (req as any).userId;
    }
    const contratos = await prisma.contrato.groupBy({
      by: ['comoLlego'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    res.json(contratos.map(c => ({ comoLlego: c.comoLlego || 'Sin especificar', total: c._count.id })));
  } catch (error: any) {
    handleError(error, 'obtener estadísticas', res);
  }
});

// ── GET /verificar-numero - Verifica si ya existe un contrato con ese número ─

router.get('/verificar-numero', authMiddleware, requirePermiso('VENTAS', 'leer'), async (req: Request, res: Response) => {
  try {
    const numero = String(req.query.numero || '').trim();
    if (!numero) return res.json({ existe: false });
    const contrato = await prisma.contrato.findFirst({
      where: { numeroContrato: numero },
      select: { id: true, solicitanteNombre: true, estado: true, registradoPorId: true },
    });
    if (!contrato) return res.json({ existe: false, contrato: null });
    if (!puedeAcceder(req as AuthRequest, 'VENTAS', contrato.registradoPorId, 'leer')) {
      // Existe pero pertenece a otro vendedor: no exponer datos del cliente
      return res.json({ existe: true, contrato: { id: null, solicitanteNombre: 'Otro vendedor', estado: '—' } });
    }
    const { registradoPorId: _owner, ...publico } = contrato;
    res.json({ existe: true, contrato: publico });
  } catch (error: any) {
    handleError(error, 'verificar número de contrato', res);
  }
});

// ── GET /:id - Detalle contrato ─────────────────────────────────────────────

router.get('/:id', authMiddleware, requirePermiso('VENTAS', 'leer'), async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de contrato inválido' });
    const contrato = await prisma.contrato.findUnique({
      where: { id },
      include: {
        archivos: true,
        cuotas: { orderBy: { numeroCuota: 'asc' } },
        registradoPor: { select: { id: true, nombre: true } },
      },
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    if (!puedeAcceder(req as AuthRequest, 'VENTAS', contrato.registradoPorId, 'leer')) {
      return res.status(403).json({ error: 'No tenés permiso para ver este contrato' });
    }

    res.json(contrato);
  } catch (error: any) {
    handleError(error, 'obtener contrato', res);
  }
});

// ── POST / - Crear contrato ─────────────────────────────────────────────────

router.post('/', authMiddleware, requirePermiso('VENTAS', 'crear'), async (req: Request, res: Response) => {
  try {
    const parsed = contratoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    }

    const data = parsed.data;

    if (data.tieneVehiculoUsado) {
      if (!data.usadoMarca || !data.usadoModelo) {
        return res.status(400).json({
          error: 'Marca y modelo del vehículo usado son requeridos cuando tiene vehículo usado',
        });
      }
    }

    const { montosCuotas, cantidadCuotas, fechaPagoAnticipo, formaPagoAnticipo, montoSellado, ...contratoData } = data;

    // Limpiar strings vacíos a null solo en campos nullable
    const notNullFields = new Set([
      'numeroContrato', 'puntoVenta', 'productorAsesor', 'tipoVehiculo',
      'marca', 'modelo', 'periodoPago', 'solicitanteNombre', 'solicitanteDni',
    ]);
    const cleanData = { ...contratoData } as any;
    for (const key of Object.keys(cleanData)) {
      if (cleanData[key] === '') {
        cleanData[key] = notNullFields.has(key) ? '' : null;
      }
    }

    // Validar fechas antes de guardar
    const fechasValidar = [
      { val: cleanData.solicitanteFechaNac, campo: 'solicitanteFechaNac', label: 'Fecha de nacimiento del solicitante' },
      { val: cleanData.conyugeFechaNac, campo: 'conyugeFechaNac', label: 'Fecha de nacimiento del cónyuge' },
      { val: fechaPagoAnticipo, campo: 'fechaPagoAnticipo', label: 'Fecha de pago del anticipo' },
    ];
    for (const { val, campo, label } of fechasValidar) {
      if (val && !esFechaValida(parseFechaAR(val))) {
        return res.status(400).json({ error: `${label}: la fecha ingresada no es válida`, campo });
      }
    }

    // Crear contrato con la primera cuota (anticipo + sellado)
    const selladoNum = montoSellado && montoSellado > 0 ? montoSellado : 0;
    const montoCuota1 = contratoData.anticipoMensual + selladoNum;
    const contrato = await prisma.contrato.create({
      data: {
        ...cleanData,
        cantidadCuotas: 1,
        anticipoMensual: new Prisma.Decimal(contratoData.anticipoMensual),
        montoSellado: selladoNum > 0 ? new Prisma.Decimal(selladoNum) : null,
        solicitanteFechaNac: cleanData.solicitanteFechaNac ? parseFechaAR(cleanData.solicitanteFechaNac) : null,
        conyugeFechaNac: cleanData.conyugeFechaNac ? parseFechaAR(cleanData.conyugeFechaNac) : null,
        registradoPor: { connect: { id: (req as any).userId } },
        cuotas: {
          create: {
            numeroCuota: 1,
            monto: new Prisma.Decimal(montoCuota1),
            fechaVencimiento: parseFechaAR(fechaPagoAnticipo),
            estado: 'PAGADA',
            formaPago: formaPagoAnticipo,
            fechaPago: parseFechaAR(fechaPagoAnticipo),
            registradoPorId: (req as any).userId,
          },
        },
      },
      include: {
        cuotas: { orderBy: { numeroCuota: 'asc' } },
        registradoPor: { select: { id: true, nombre: true } },
      },
    });

    res.status(201).json(contrato);
  } catch (error: any) {
    handleError(error, 'crear contrato', res);
  }
});

// ── PUT /:id - Editar contrato ──────────────────────────────────────────────

function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Datos inválidos';
  const campo = issue.path.join('.');
  return campo ? `Datos inválidos en "${campo}": ${issue.message}` : `Datos inválidos: ${issue.message}`;
}

const CAMPOS_EDITABLES = [
  'numeroContrato', 'puntoVenta', 'productorAsesor', 'tipoVehiculo',
  'marca', 'modelo', 'anticipoMensual', 'periodoPago',
  'solicitanteNombre', 'solicitanteDni', 'solicitanteFechaNac',
  'solicitanteEstadoCivil', 'solicitanteDomicilio', 'solicitanteBarrio',
  'solicitanteLocalidad', 'solicitanteCp', 'solicitanteProvincia',
  'solicitanteCelular', 'solicitanteTelFijo', 'solicitanteHrContacto',
  'solicitanteOcupacion', 'solicitanteEmail',
  'conyugeNombre', 'conyugeDni', 'conyugeFechaNac', 'conyugeTelefono',
  'tieneVehiculoUsado', 'usadoMarca', 'usadoModelo', 'usadoAnio',
  'usadoColor', 'usadoCombustible', 'comoLlego', 'observaciones', 'montoDevolucion', 'montoSellado',
  'tipoFinanciamiento',
] as const;

const CAMPOS_NUMERICOS = new Set(['anticipoMensual', 'montoSellado', 'montoDevolucion', 'usadoAnio']);

router.put('/:id', authMiddleware, requirePermiso('VENTAS', 'editar'), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de contrato inválido' });

    const contratoExistente = await prisma.contrato.findUnique({ where: { id } });

    if (!contratoExistente) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    if (!puedeAcceder(authReq, 'VENTAS', contratoExistente.registradoPorId, 'escribir')) {
      return res.status(403).json({ error: 'No tenés permiso para editar este contrato' });
    }

    const admin = esAdmin(authReq);

    // Permitir cambio de estado, pero no editar otros campos si está cancelado
    if (req.body.estado !== undefined) {
      const estadosValidos = ['ACTIVO', 'NEGOCIACION', 'COMPLETADO', 'CANCELADO', 'DE_BAJA', 'DEVOLUCION'];
      if (!estadosValidos.includes(req.body.estado)) {
        return res.status(400).json({ error: `Estado inválido. Opciones: ${estadosValidos.join(', ')}` });
      }
    }

    // Campos solo-admin: se rechaza únicamente si el valor CAMBIA (el front reenvía el valor actual)
    const cambiaEstado = req.body.estado !== undefined && req.body.estado !== contratoExistente.estado;
    if (cambiaEstado && !admin) {
      return res.status(403).json({ error: 'Solo un administrador puede cambiar el estado del contrato' });
    }
    const cambiaAsesor = req.body.productorAsesor !== undefined && req.body.productorAsesor !== contratoExistente.productorAsesor;
    if (cambiaAsesor && !admin) {
      return res.status(403).json({ error: 'Solo un administrador puede cambiar el asesor del contrato' });
    }
    const cambiaTipoFin = req.body.tipoFinanciamiento !== undefined
      && (req.body.tipoFinanciamiento || null) !== (contratoExistente.tipoFinanciamiento || null);
    const generaFinCasa = req.body.tipoFinanciamiento === 'CASA' && !!req.body.financiamientoCuotas && !!req.body.financiamientoValorCuota;
    if ((cambiaTipoFin || generaFinCasa) && !admin) {
      return res.status(403).json({ error: 'Solo un administrador puede modificar el financiamiento del contrato' });
    }

    if (contratoExistente.estado === 'CANCELADO' && req.body.estado === undefined) {
      return res.status(400).json({ error: 'No se puede editar un contrato cancelado. Cambie el estado primero.' });
    }

    // Validación con el schema de contrato (parcial): solo los campos editables presentes en el body
    const input: Record<string, any> = {};
    for (const field of CAMPOS_EDITABLES) {
      if (req.body[field] === undefined) continue;
      let v = req.body[field];
      if (CAMPOS_NUMERICOS.has(field) && typeof v === 'string') {
        v = v.trim() === '' ? null : Number(v);
      }
      if (field === 'tipoFinanciamiento' && v === '') v = null;
      input[field] = v;
    }
    const parsed = contratoUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error), detalles: parsed.error.flatten() });
    }
    const data = parsed.data as Record<string, any>;

    const updateData: any = {};

    // Estado se maneja por separado
    if (req.body.estado !== undefined) {
      updateData.estado = req.body.estado;
    }

    // Reasignar vendedor (solo admin)
    if (req.body.registradoPorId !== undefined && admin) {
      const nuevoOwner = Number(req.body.registradoPorId);
      if (Number.isInteger(nuevoOwner) && nuevoOwner > 0 && nuevoOwner !== contratoExistente.registradoPorId) {
        updateData.registradoPorId = nuevoOwner;
      }
    }

    for (const field of Object.keys(data)) {
      const value = data[field];
      if (value === undefined) continue;
      if (field === 'anticipoMensual' || field === 'montoDevolucion' || field === 'montoSellado') {
        updateData[field] = value !== null ? new Prisma.Decimal(value) : null;
      } else if (field === 'solicitanteFechaNac' || field === 'conyugeFechaNac') {
        if (value) {
          const d = parseFechaAR(value);
          if (!esFechaValida(d)) {
            const label = field === 'solicitanteFechaNac' ? 'Fecha de nacimiento del solicitante' : 'Fecha de nacimiento del cónyuge';
            return res.status(400).json({ error: `${label}: la fecha ingresada no es válida`, campo: field });
          }
          updateData[field] = d;
        } else {
          updateData[field] = null;
        }
      } else {
        updateData[field] = value;
      }
    }

    // Financiamiento de la casa: guardar tasa y generar cuotas
    if (generaFinCasa) {
      const cantCuotas = Number(req.body.financiamientoCuotas);
      const valorCuota = Number(req.body.financiamientoValorCuota);
      const tasaRaw = req.body.financiamientoTasa;
      const tasa = tasaRaw !== undefined && tasaRaw !== null && tasaRaw !== '' ? Number(tasaRaw) : null;
      if (!Number.isInteger(cantCuotas) || cantCuotas < 1 || cantCuotas > 240) {
        return res.status(400).json({ error: 'Cantidad de cuotas de financiamiento inválida (1 a 240)' });
      }
      if (!Number.isFinite(valorCuota) || valorCuota <= 0) {
        return res.status(400).json({ error: 'El valor de la cuota de financiamiento debe ser mayor a 0' });
      }
      if (tasa !== null && (!Number.isFinite(tasa) || tasa < 0 || tasa >= 1000)) {
        return res.status(400).json({ error: 'Tasa de financiamiento inválida' });
      }

      updateData.financiamientoCuotas = cantCuotas;
      updateData.financiamientoValorCuota = new Prisma.Decimal(valorCuota);
      updateData.financiamientoTasa = tasa !== null ? new Prisma.Decimal(tasa) : null;

      const diaVenc = Math.min(Math.max(Number(req.body.financiamientoDiaVenc) || 1, 1), 28);
      let startYear: number, startMonth: number;
      if (req.body.financiamientoMesInicio) {
        const mesInicio = String(req.body.financiamientoMesInicio);
        if (!/^\d{4}-\d{2}$/.test(mesInicio)) {
          return res.status(400).json({ error: 'Mes de inicio del financiamiento inválido (formato AAAA-MM)' });
        }
        const [y, m] = mesInicio.split('-').map(Number);
        if (m < 1 || m > 12) {
          return res.status(400).json({ error: 'Mes de inicio del financiamiento inválido' });
        }
        startYear = y; startMonth = m - 1;
      } else {
        const hoy = partesFechaAR();
        startYear = hoy.anio; startMonth = hoy.mes + 1;
      }

      await prisma.$transaction(async (tx) => {
        // Lock del contrato: evita números de cuota duplicados / doble generación concurrente
        await tx.$queryRaw`SELECT id FROM contratos WHERE id = ${id} FOR UPDATE`;

        const existingFin = await tx.cuota.count({
          where: { contratoId: id, tipo: 'FINANCIAMIENTO' },
        });
        if (existingFin > 0) {
          throw new HttpError(400, 'Este contrato ya tiene cuotas de financiamiento generadas');
        }

        const ultimaCuota = await tx.cuota.findFirst({
          where: { contratoId: id },
          orderBy: { numeroCuota: 'desc' },
        });
        const startNum = (ultimaCuota?.numeroCuota || 0) + 1;

        const cuotasData = [];
        for (let i = 0; i < cantCuotas; i++) {
          cuotasData.push({
            contratoId: id,
            numeroCuota: startNum + i,
            monto: new Prisma.Decimal(valorCuota),
            fechaVencimiento: fechaCalendarioAR(startYear, startMonth + i, diaVenc),
            estado: 'PENDIENTE',
            tipo: 'FINANCIAMIENTO',
          });
        }

        await tx.contrato.update({ where: { id }, data: updateData });
        await tx.cuota.createMany({ data: cuotasData });
      });

      const contrato = await prisma.contrato.findUnique({
        where: { id },
        include: {
          archivos: true,
          cuotas: { orderBy: { numeroCuota: 'asc' }, include: { pagos: { include: { registradoPor: { select: { id: true, nombre: true } } } } } },
          registradoPor: { select: { id: true, nombre: true } },
        },
      });

      return res.json(contrato);
    }

    const contrato = await prisma.contrato.update({
      where: { id },
      data: updateData,
      include: {
        archivos: true,
        cuotas: { orderBy: { numeroCuota: 'asc' } },
        registradoPor: { select: { id: true, nombre: true } },
      },
    });

    res.json(contrato);
  } catch (error: any) {
    handleError(error, 'actualizar contrato', res);
  }
});

// ── DELETE /:id - Cancelar contrato (soft) ──────────────────────────────────

router.delete('/:id', authMiddleware, requirePermiso('VENTAS', 'eliminar'), async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de contrato inválido' });

    const contrato = await prisma.contrato.findUnique({
      where: { id },
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    if (!puedeAcceder(req as AuthRequest, 'VENTAS', contrato.registradoPorId, 'escribir')) {
      return res.status(403).json({ error: 'No tenés permiso para cancelar este contrato' });
    }

    await prisma.contrato.update({
      where: { id },
      data: { estado: 'CANCELADO' },
    });

    res.json({ message: 'Contrato cancelado correctamente' });
  } catch (error: any) {
    handleError(error, 'cancelar contrato', res);
  }
});

// ── POST /:id/archivos - Subir archivo ──────────────────────────────────────

router.post(
  '/:id/archivos',
  authMiddleware,
  async (req: Request, res: Response, next) => {
    try {
      const authReq = req as AuthRequest;
      const perm = authReq.userPermisos?.find(p => p.modulo === 'VENTAS');
      if (!perm || (!perm.crear && !perm.editar)) {
        return res.status(403).json({ error: 'Sin permiso para subir archivos en VENTAS' });
      }
      // Validar existencia y dueño ANTES de subir a Cloudinary
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: 'ID de contrato inválido' });
      const contrato = await prisma.contrato.findUnique({ where: { id }, select: { id: true, registradoPorId: true } });
      if (!contrato) return res.status(404).json({ error: 'Contrato no encontrado' });
      if (!puedeAcceder(authReq, 'VENTAS', contrato.registradoPorId, 'escribir')) {
        return res.status(403).json({ error: 'No tenés permiso para subir archivos a este contrato' });
      }
      next();
    } catch (error: any) {
      handleError(error, 'subir archivo', res);
    }
  },
  upload.single('archivo'),
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);

      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó un archivo' });
      }

      const tipo = req.body.tipo;
      if (!['CONTRATO', 'DNI_FRENTE', 'DNI_DORSO', 'FOTO_AUTO'].includes(tipo)) {
        await destruirSubida(req.file);
        return res.status(400).json({ error: 'Tipo de archivo inválido' });
      }

      const archivo = await prisma.contratoArchivo.create({
        data: {
          contratoId: id,
          tipo,
          url: (req.file as any).path,
          publicId: (req.file as any).filename,
        },
      });

      res.status(201).json(archivo);
    } catch (error: any) {
      await destruirSubida(req.file);
      handleError(error, 'subir archivo', res);
    }
  }
);

// ── DELETE /:id/archivos/:archivoId - Eliminar archivo ──────────────────────

router.delete('/:id/archivos/:archivoId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const perm = authReq.userPermisos?.find(p => p.modulo === 'VENTAS');
    if (!perm || (!perm.editar && !perm.eliminar)) {
      return res.status(403).json({ error: 'Sin permiso para eliminar archivos en VENTAS' });
    }

    const archivo = await prisma.contratoArchivo.findFirst({
      where: {
        id: Number(req.params.archivoId) || 0,
        contratoId: Number(req.params.id) || 0,
      },
      include: { contrato: { select: { registradoPorId: true } } },
    });

    if (!archivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    if (!puedeAcceder(authReq, 'VENTAS', archivo.contrato.registradoPorId, 'escribir')) {
      return res.status(403).json({ error: 'No tenés permiso para eliminar archivos de este contrato' });
    }

    await cloudinary.uploader.destroy(archivo.publicId);
    await prisma.contratoArchivo.delete({ where: { id: archivo.id } });

    res.json({ message: 'Archivo eliminado correctamente' });
  } catch (error: any) {
    handleError(error, 'eliminar archivo', res);
  }
});

export default router;
