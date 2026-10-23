import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware, requirePermiso, puedeVerTodos, AuthRequest } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import cloudinary from '../config/cloudinary.js';
import { handleError } from '../utils/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

// ── Validación ──────────────────────────────────────────────────────────────

const contratoSchema = z.object({
  numeroContrato: z.string().min(1, 'Número de solicitud requerido'),
  puntoVenta: z.enum(['SALON', 'STAND', 'CASA_CLIENTE', 'ONLINE', 'OTRO']),
  productorAsesor: z.string().min(1, 'Productor asesor requerido'),
  tipoVehiculo: z.enum(['AUTO', 'UTILITARIO', 'CAMIONETA', 'MOTO', 'OTRO']),
  marca: z.string().min(1, 'Marca requerida'),
  modelo: z.string().min(1, 'Modelo requerido'),
  anticipoMensual: z.number().positive('El anticipo debe ser positivo'),
  montoSellado: z.number().min(0).optional().nullable(),
  periodoPago: z.enum(['1-10', '10-20', '20-30']),
  cantidadCuotas: z.number().int().optional().default(0),

  solicitanteNombre: z.string().min(1, 'Nombre del solicitante requerido'),
  solicitanteDni: z.string().min(1, 'DNI del solicitante requerido'),
  solicitanteFechaNac: z.union([z.string().datetime(), z.literal(''), z.null()]).optional(),
  solicitanteEstadoCivil: z.string().optional().nullable(),
  solicitanteDomicilio: z.string().optional().nullable(),
  solicitanteBarrio: z.string().optional().nullable(),
  solicitanteLocalidad: z.string().optional().nullable(),
  solicitanteCp: z.string().optional().nullable(),
  solicitanteProvincia: z.string().optional().nullable(),
  solicitanteCelular: z.string().min(1, 'Celular del solicitante requerido'),
  solicitanteTelFijo: z.string().optional().nullable(),
  solicitanteHrContacto: z.string().optional().nullable(),
  solicitanteOcupacion: z.string().optional().nullable(),
  solicitanteEmail: z.union([z.string().email(), z.literal(''), z.null()]).optional(),

  conyugeNombre: z.string().optional().nullable(),
  conyugeDni: z.string().optional().nullable(),
  conyugeFechaNac: z.union([z.string().datetime(), z.literal(''), z.null()]).optional(),
  conyugeTelefono: z.string().optional().nullable(),

  tieneVehiculoUsado: z.boolean().default(false),
  usadoMarca: z.string().optional().nullable(),
  usadoModelo: z.string().optional().nullable(),
  usadoAnio: z.number().int().optional().nullable(),
  usadoColor: z.string().optional().nullable(),
  usadoCombustible: z.string().optional().nullable(),

  comoLlego: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),

  fechaPagoAnticipo: z.string().min(1, 'Fecha de pago del anticipo requerida'),
  formaPagoAnticipo: z.string().min(1, 'Forma de pago del anticipo requerida'),
  montosCuotas: z.array(z.number().positive()).optional(),
});

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
    const { page = '1', limit = '20', busqueda, estado, asesor, desde, hasta } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

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
      where.fechaCreacion = { ...where.fechaCreacion, gte: new Date(desde) };
    }
    if (hasta && typeof hasta === 'string') {
      where.fechaCreacion = { ...where.fechaCreacion, lte: new Date(hasta) };
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
        take: Number(limit),
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
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    handleError(error, 'listar contratos', res);
  }
});

// ── GET /asesores - Lista distinta de asesores ─────────────────────────────

router.get('/asesores', authMiddleware, requirePermiso('VENTAS', 'leer'), async (req: Request, res: Response) => {
  try {
    const asesores = await prisma.contrato.findMany({
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
      select: { id: true, solicitanteNombre: true, estado: true },
    });
    res.json({ existe: !!contrato, contrato: contrato || null });
  } catch (error: any) {
    handleError(error, 'verificar número de contrato', res);
  }
});

// ── GET /:id - Detalle contrato ─────────────────────────────────────────────

router.get('/:id', authMiddleware, requirePermiso('VENTAS', 'leer'), async (req: Request, res: Response) => {
  try {
    const contrato = await prisma.contrato.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        archivos: true,
        cuotas: { orderBy: { numeroCuota: 'asc' } },
        registradoPor: { select: { id: true, nombre: true } },
      },
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
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

    // Crear contrato con la primera cuota (anticipo + sellado)
    const selladoNum = montoSellado && montoSellado > 0 ? montoSellado : 0;
    const montoCuota1 = contratoData.anticipoMensual + selladoNum;
    const contrato = await prisma.contrato.create({
      data: {
        ...cleanData,
        cantidadCuotas: 1,
        anticipoMensual: new Prisma.Decimal(contratoData.anticipoMensual),
        montoSellado: selladoNum > 0 ? new Prisma.Decimal(selladoNum) : null,
        solicitanteFechaNac: cleanData.solicitanteFechaNac ? new Date(cleanData.solicitanteFechaNac) : null,
        conyugeFechaNac: cleanData.conyugeFechaNac ? new Date(cleanData.conyugeFechaNac) : null,
        registradoPor: { connect: { id: (req as any).userId } },
        cuotas: {
          create: {
            numeroCuota: 1,
            monto: new Prisma.Decimal(montoCuota1),
            fechaVencimiento: new Date(fechaPagoAnticipo),
            estado: 'PAGADA',
            formaPago: formaPagoAnticipo,
            fechaPago: new Date(fechaPagoAnticipo),
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

router.put('/:id', authMiddleware, requirePermiso('VENTAS', 'editar'), async (req: Request, res: Response) => {
  try {
    const contratoExistente = await prisma.contrato.findUnique({
      where: { id: Number(req.params.id) },
    });

    if (!contratoExistente) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Permitir cambio de estado, pero no editar otros campos si está cancelado
    if (req.body.estado !== undefined) {
      const estadosValidos = ['ACTIVO', 'NEGOCIACION', 'COMPLETADO', 'CANCELADO', 'DE_BAJA', 'DEVOLUCION'];
      if (!estadosValidos.includes(req.body.estado)) {
        return res.status(400).json({ error: `Estado inválido. Opciones: ${estadosValidos.join(', ')}` });
      }
    }

    if (contratoExistente.estado === 'CANCELADO' && req.body.estado === undefined) {
      return res.status(400).json({ error: 'No se puede editar un contrato cancelado. Cambie el estado primero.' });
    }

    const updateData: any = {};

    // Estado se maneja por separado
    if (req.body.estado !== undefined) {
      updateData.estado = req.body.estado;
    }

    // Reasignar vendedor (solo admin)
    if (req.body.registradoPorId !== undefined && (req as any).userRolNombre === 'Administrador') {
      updateData.registradoPorId = Number(req.body.registradoPorId);
    }

    const allowedFields = [
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
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'anticipoMensual' || field === 'montoDevolucion' || field === 'montoSellado') {
          updateData[field] = req.body[field] !== null && req.body[field] !== undefined ? new Prisma.Decimal(req.body[field]) : null;
        } else if (field === 'solicitanteFechaNac' || field === 'conyugeFechaNac') {
          updateData[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    // Financiamiento de la casa: guardar tasa y generar cuotas
    if (req.body.tipoFinanciamiento === 'CASA' && req.body.financiamientoCuotas && req.body.financiamientoValorCuota) {
      const existingFin = await prisma.cuota.count({
        where: { contratoId: Number(req.params.id), tipo: 'FINANCIAMIENTO' },
      });
      if (existingFin > 0) {
        return res.status(400).json({ error: 'Este contrato ya tiene cuotas de financiamiento generadas' });
      }

      const cantCuotas = Number(req.body.financiamientoCuotas);
      const valorCuota = Number(req.body.financiamientoValorCuota);
      updateData.financiamientoCuotas = cantCuotas;
      updateData.financiamientoValorCuota = new Prisma.Decimal(valorCuota);
      updateData.financiamientoTasa = req.body.financiamientoTasa ? new Prisma.Decimal(req.body.financiamientoTasa) : null;

      const ultimaCuota = await prisma.cuota.findFirst({
        where: { contratoId: Number(req.params.id) },
        orderBy: { numeroCuota: 'desc' },
      });
      const startNum = (ultimaCuota?.numeroCuota || 0) + 1;

      const cuotasData = [];
      const diaVenc = Math.min(Math.max(Number(req.body.financiamientoDiaVenc) || 1, 1), 28);
      let startYear: number, startMonth: number;
      if (req.body.financiamientoMesInicio) {
        const [y, m] = (req.body.financiamientoMesInicio as string).split('-').map(Number);
        startYear = y; startMonth = m - 1;
      } else {
        const now = new Date();
        startYear = now.getFullYear(); startMonth = now.getMonth() + 1;
      }
      for (let i = 0; i < cantCuotas; i++) {
        const vencimiento = new Date(startYear, startMonth + i, diaVenc);
        cuotasData.push({
          contratoId: Number(req.params.id),
          numeroCuota: startNum + i,
          monto: new Prisma.Decimal(valorCuota),
          fechaVencimiento: vencimiento,
          estado: 'PENDIENTE',
          tipo: 'FINANCIAMIENTO',
        });
      }

      await prisma.$transaction([
        prisma.contrato.update({ where: { id: Number(req.params.id) }, data: updateData }),
        prisma.cuota.createMany({ data: cuotasData }),
      ]);

      const contrato = await prisma.contrato.findUnique({
        where: { id: Number(req.params.id) },
        include: {
          archivos: true,
          cuotas: { orderBy: { numeroCuota: 'asc' }, include: { pagos: { include: { registradoPor: { select: { id: true, nombre: true } } } } } },
          registradoPor: { select: { id: true, nombre: true } },
        },
      });

      return res.json(contrato);
    }

    const contrato = await prisma.contrato.update({
      where: { id: Number(req.params.id) },
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
    const contrato = await prisma.contrato.findUnique({
      where: { id: Number(req.params.id) },
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    await prisma.contrato.update({
      where: { id: Number(req.params.id) },
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
    const authReq = req as AuthRequest;
    const perm = authReq.userPermisos?.find(p => p.modulo === 'VENTAS');
    if (!perm || (!perm.crear && !perm.editar)) {
      return res.status(403).json({ error: 'Sin permiso para subir archivos en VENTAS' });
    }
    next();
  },
  upload.single('archivo'),
  async (req: Request, res: Response) => {
    try {
      const contrato = await prisma.contrato.findUnique({
        where: { id: Number(req.params.id) },
      });

      if (!contrato) {
        return res.status(404).json({ error: 'Contrato no encontrado' });
      }

      const tipo = req.body.tipo;
      if (!['CONTRATO', 'DNI_FRENTE', 'DNI_DORSO', 'FOTO_AUTO'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de archivo inválido' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó un archivo' });
      }

      const archivo = await prisma.contratoArchivo.create({
        data: {
          contratoId: contrato.id,
          tipo,
          url: (req.file as any).path,
          publicId: (req.file as any).filename,
        },
      });

      res.status(201).json(archivo);
    } catch (error: any) {
      handleError(error, 'subir archivo', res);
    }
  }
);

// ── DELETE /:id/archivos/:archivoId - Eliminar archivo ──────────────────────

router.delete('/:id/archivos/:archivoId', authMiddleware, requirePermiso('VENTAS', 'eliminar'), async (req: Request, res: Response) => {
  try {
    const archivo = await prisma.contratoArchivo.findFirst({
      where: {
        id: Number(req.params.archivoId),
        contratoId: Number(req.params.id),
      },
    });

    if (!archivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    await cloudinary.uploader.destroy(archivo.publicId);
    await prisma.contratoArchivo.delete({ where: { id: archivo.id } });

    res.json({ message: 'Archivo eliminado correctamente' });
  } catch (error: any) {
    handleError(error, 'eliminar archivo', res);
  }
});

export default router;
