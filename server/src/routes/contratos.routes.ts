import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware, requirePermiso, puedeVerTodos, AuthRequest } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import cloudinary from '../config/cloudinary.js';

const router = Router();
const prisma = new PrismaClient();

// ── Validación ──────────────────────────────────────────────────────────────

const contratoSchema = z.object({
  numeroContrato: z.string().min(1, 'Número de solicitud requerido'),
  puntoVenta: z.enum(['SALON', 'STAND', 'CASA_CLIENTE', 'ONLINE', 'OTRO']),
  productorAsesor: z.string().min(1, 'Productor asesor requerido'),
  tipoVehiculo: z.enum(['AUTO', 'UTILITARIO', 'CAMIONETA']),
  marca: z.string().optional().default(''),
  modelo: z.string().optional().default(''),
  anticipoMensual: z.number().positive('El anticipo debe ser positivo'),
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
  solicitanteCelular: z.string().optional().nullable(),
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
  } catch (error) {
    console.error('Error al listar contratos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
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
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error interno' });
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
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error interno' });
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
  } catch (error) {
    console.error('Error al obtener contrato:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
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

    const { montosCuotas, cantidadCuotas, ...contratoData } = data;

    // Limpiar strings vacíos a null
    const cleanData = { ...contratoData } as any;
    for (const key of Object.keys(cleanData)) {
      if (cleanData[key] === '') cleanData[key] = null;
    }

    // Crear contrato sin cuotas (se agregan desde cobranzas mes a mes)
    const contrato = await prisma.contrato.create({
      data: {
        ...cleanData,
        cantidadCuotas: 0,
        anticipoMensual: new Prisma.Decimal(contratoData.anticipoMensual),
        solicitanteFechaNac: cleanData.solicitanteFechaNac ? new Date(cleanData.solicitanteFechaNac) : null,
        conyugeFechaNac: cleanData.conyugeFechaNac ? new Date(cleanData.conyugeFechaNac) : null,
        registradoPorId: (req as any).userId,
      },
      include: {
        cuotas: { orderBy: { numeroCuota: 'asc' } },
        registradoPor: { select: { id: true, nombre: true } },
      },
    });

    res.status(201).json(contrato);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un contrato con ese número' });
    }
    console.error('Error al crear contrato:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
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
      const estadosValidos = ['ACTIVO', 'COMPLETADO', 'CANCELADO', 'DE_BAJA'];
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
      'usadoColor', 'usadoCombustible', 'comoLlego', 'observaciones',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'anticipoMensual') {
          updateData[field] = new Prisma.Decimal(req.body[field]);
        } else if (field === 'solicitanteFechaNac' || field === 'conyugeFechaNac') {
          updateData[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else {
          updateData[field] = req.body[field];
        }
      }
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
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un contrato con ese número' });
    }
    console.error('Error al actualizar contrato:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
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
  } catch (error) {
    console.error('Error al cancelar contrato:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── POST /:id/archivos - Subir archivo ──────────────────────────────────────

router.post(
  '/:id/archivos',
  authMiddleware,
  requirePermiso('VENTAS', 'editar'),
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
    } catch (error) {
      console.error('Error al subir archivo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
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
  } catch (error) {
    console.error('Error al eliminar archivo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
