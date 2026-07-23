import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware, requirePermiso } from '../middlewares/auth.middleware.js';

const router = Router();
const prisma = new PrismaClient();

// ── Validación ──────────────────────────────────────────────────────────────

const recepcionSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido'),
  telefono: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  medio: z.enum(['PRESENCIAL', 'TELEFONO', 'WHATSAPP', 'EMAIL', 'WEB', 'OTRO']),
  motivo: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
  comoLlego: z.string().optional().nullable(),
  estado: z.enum(['PENDIENTE', 'CONTACTADO', 'CITA_AGENDADA', 'CERRADO']).optional(),
  fechaCita: z.string().datetime().optional().nullable(),
  notasCita: z.string().optional().nullable(),
  fechaContacto: z.string().datetime().optional(),
});

// ── POST /web - Formulario público del sitio web (sin auth) ────────────────

const webFormSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido'),
  telefono: z.string().optional().nullable(),
  email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
  motivo: z.string().optional().nullable(),
  comoLlego: z.string().optional().nullable(),
});

router.post('/web', async (req: Request, res: Response) => {
  try {
    const parsed = webFormSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    }
    const data = parsed.data;
    const recepcion = await prisma.recepcion.create({
      data: {
        nombre: data.nombre,
        telefono: data.telefono || null,
        email: data.email || null,
        medio: 'WEB',
        motivo: data.motivo || null,
        comoLlego: data.comoLlego || null,
        estado: 'PENDIENTE',
      },
    });
    res.status(201).json({ message: 'Consulta recibida correctamente', id: recepcion.id });
  } catch (error) {
    console.error('Error al crear recepción web:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── GET / - Listar recepciones ──────────────────────────────────────────────

router.get('/', authMiddleware, requirePermiso('RECEPCION', 'leer'), async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', busqueda, estado } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (estado && typeof estado === 'string') {
      where.estado = estado;
    }

    if (busqueda && typeof busqueda === 'string') {
      where.OR = [
        { nombre: { contains: busqueda } },
        { telefono: { contains: busqueda } },
        { email: { contains: busqueda } },
      ];
    }

    const [recepciones, total] = await Promise.all([
      prisma.recepcion.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { fechaContacto: 'desc' },
        include: {
          registradoPor: { select: { id: true, nombre: true } },
        },
      }),
      prisma.recepcion.count({ where }),
    ]);

    res.json({
      data: recepciones,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Error al listar recepciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── GET /citas - Listar citas agendadas ─────────────────────────────────────

router.get('/citas', authMiddleware, requirePermiso('RECEPCION', 'leer'), async (req: Request, res: Response) => {
  try {
    const { desde, hasta } = req.query;

    const where: any = {
      fechaCita: { not: null },
    };

    if (desde || hasta) {
      where.fechaCita = { ...where.fechaCita };
      if (desde && typeof desde === 'string') {
        where.fechaCita.gte = new Date(desde);
      }
      if (hasta && typeof hasta === 'string') {
        where.fechaCita.lte = new Date(hasta);
      }
    }

    const citas = await prisma.recepcion.findMany({
      where,
      orderBy: { fechaCita: 'asc' },
      include: {
        registradoPor: { select: { id: true, nombre: true } },
      },
    });

    res.json(citas);
  } catch (error) {
    console.error('Error al listar citas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── GET /stats - Estadísticas completas de recepción ──────────────────────

router.get('/stats', authMiddleware, requirePermiso('RECEPCION', 'leer'), async (req: Request, res: Response) => {
  try {
    const { desde, hasta } = req.query;
    const where: any = {};
    if (desde || hasta) {
      where.fechaContacto = {};
      if (desde && typeof desde === 'string') where.fechaContacto.gte = new Date(desde);
      if (hasta && typeof hasta === 'string') where.fechaContacto.lte = new Date(hasta);
    }

    const all = await prisma.recepcion.findMany({ where, select: { comoLlego: true, medio: true, estado: true, fechaContacto: true } });

    // Por comoLlego
    const porOrigen: Record<string, number> = {};
    // Por medio
    const porMedio: Record<string, number> = {};
    // Por estado
    const porEstado: Record<string, number> = {};
    // Por día de la semana (0=Dom, 1=Lun, ...)
    const porDia: number[] = [0, 0, 0, 0, 0, 0, 0];
    // Por mes
    const porMes: number[] = new Array(12).fill(0);
    // Por hora del día
    const porHora: number[] = new Array(24).fill(0);

    for (const r of all) {
      const key = r.comoLlego || 'Sin especificar';
      porOrigen[key] = (porOrigen[key] || 0) + 1;
      porMedio[r.medio] = (porMedio[r.medio] || 0) + 1;
      porEstado[r.estado] = (porEstado[r.estado] || 0) + 1;
      const d = new Date(r.fechaContacto);
      porDia[d.getDay()] = (porDia[d.getDay()] || 0) + 1;
      porMes[d.getMonth()] = (porMes[d.getMonth()] || 0) + 1;
      porHora[d.getHours()] = (porHora[d.getHours()] || 0) + 1;
    }

    res.json({
      total: all.length,
      porOrigen: Object.entries(porOrigen).map(([k, v]) => ({ label: k, total: v })).sort((a, b) => b.total - a.total),
      porMedio: Object.entries(porMedio).map(([k, v]) => ({ label: k, total: v })).sort((a, b) => b.total - a.total),
      porEstado: Object.entries(porEstado).map(([k, v]) => ({ label: k, total: v })).sort((a, b) => b.total - a.total),
      porDia,
      porMes,
      porHora,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── GET /stats/como-llego - Compatibilidad ────────────────────────────────

router.get('/stats/como-llego', authMiddleware, requirePermiso('RECEPCION', 'leer'), async (req: Request, res: Response) => {
  try {
    const result = await prisma.recepcion.groupBy({
      by: ['comoLlego'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    res.json(result.map(r => ({ comoLlego: r.comoLlego || 'Sin especificar', total: r._count.id })));
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── GET /:id - Detalle recepción ────────────────────────────────────────────

router.get('/:id', authMiddleware, requirePermiso('RECEPCION', 'leer'), async (req: Request, res: Response) => {
  try {
    const recepcion = await prisma.recepcion.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        registradoPor: { select: { id: true, nombre: true } },
      },
    });

    if (!recepcion) {
      return res.status(404).json({ error: 'Registro de recepción no encontrado' });
    }

    res.json(recepcion);
  } catch (error) {
    console.error('Error al obtener recepción:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── POST / - Crear registro ─────────────────────────────────────────────────

router.post('/', authMiddleware, requirePermiso('RECEPCION', 'crear'), async (req: Request, res: Response) => {
  try {
    const parsed = recepcionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    }

    const data = parsed.data;

    // Validar disponibilidad si tiene cita
    if (data.fechaCita) {
      const fechaCita = new Date(data.fechaCita);
      const horaInicio = new Date(fechaCita);
      horaInicio.setMinutes(0, 0, 0);
      const horaFin = new Date(horaInicio);
      horaFin.setHours(horaFin.getHours() + 1);

      const citasEnHora = await prisma.recepcion.count({
        where: {
          fechaCita: { gte: horaInicio, lt: horaFin },
        },
      });

      if (citasEnHora >= 2) {
        return res.status(400).json({ error: 'Ya hay 2 citas agendadas en esa hora. Elegí otro horario.' });
      }
    }

    const recepcion = await prisma.recepcion.create({
      data: {
        nombre: data.nombre,
        telefono: data.telefono || null,
        email: data.email || null,
        medio: data.medio,
        motivo: data.motivo || null,
        observaciones: data.observaciones || null,
        comoLlego: data.comoLlego || null,
        estado: data.estado || 'PENDIENTE',
        fechaCita: data.fechaCita ? new Date(data.fechaCita) : null,
        notasCita: data.notasCita || null,
        fechaContacto: data.fechaContacto ? new Date(data.fechaContacto) : new Date(),
        registradoPorId: (req as any).userId,
      },
      include: {
        registradoPor: { select: { id: true, nombre: true } },
      },
    });

    res.status(201).json(recepcion);
  } catch (error) {
    console.error('Error al crear recepción:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── PUT /:id - Editar registro ──────────────────────────────────────────────

router.put('/:id', authMiddleware, requirePermiso('RECEPCION', 'editar'), async (req: Request, res: Response) => {
  try {
    const recepcion = await prisma.recepcion.findUnique({
      where: { id: Number(req.params.id) },
    });

    if (!recepcion) {
      return res.status(404).json({ error: 'Registro de recepción no encontrado' });
    }

    const updateData: any = {};
    const allowedFields = [
      'nombre', 'telefono', 'email', 'medio', 'motivo',
      'observaciones', 'comoLlego', 'estado', 'notasCita',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (req.body.fechaCita !== undefined) {
      updateData.fechaCita = req.body.fechaCita ? new Date(req.body.fechaCita) : null;

      // Validar disponibilidad
      if (req.body.fechaCita) {
        const fechaCita = new Date(req.body.fechaCita);
        const horaInicio = new Date(fechaCita);
        horaInicio.setMinutes(0, 0, 0);
        const horaFin = new Date(horaInicio);
        horaFin.setHours(horaFin.getHours() + 1);

        const citasEnHora = await prisma.recepcion.count({
          where: {
            fechaCita: { gte: horaInicio, lt: horaFin },
            id: { not: Number(req.params.id) }, // Excluir la cita actual
          },
        });

        if (citasEnHora >= 2) {
          return res.status(400).json({ error: 'Ya hay 2 citas agendadas en esa hora. Elegí otro horario.' });
        }
      }
    }
    if (req.body.fechaContacto !== undefined) {
      updateData.fechaContacto = new Date(req.body.fechaContacto);
    }

    if (req.body.fechaCita && recepcion.estado === 'PENDIENTE') {
      updateData.estado = 'CITA_AGENDADA';
    }

    const recepcionActualizada = await prisma.recepcion.update({
      where: { id: Number(req.params.id) },
      data: updateData,
      include: {
        registradoPor: { select: { id: true, nombre: true } },
      },
    });

    res.json(recepcionActualizada);
  } catch (error) {
    console.error('Error al actualizar recepción:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── DELETE /:id - Eliminar registro ─────────────────────────────────────────

router.delete('/:id', authMiddleware, requirePermiso('RECEPCION', 'eliminar'), async (req: Request, res: Response) => {
  try {
    const recepcion = await prisma.recepcion.findUnique({
      where: { id: Number(req.params.id) },
    });

    if (!recepcion) {
      return res.status(404).json({ error: 'Registro de recepción no encontrado' });
    }

    await prisma.recepcion.delete({ where: { id: Number(req.params.id) } });

    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar recepción:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
