import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware, requirePermiso, puedeVerTodos, puedeAcceder, AuthRequest } from '../middlewares/auth.middleware.js';
import { handleError } from '../utils/errorHandler.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { filtroDesdeAR, filtroHastaAR, esFechaValida, formatearFechaHoraAR } from '../utils/fechas.js';
import { parsePaginacion, parseId } from '../utils/paginacion.js';

const router = Router();
const prisma = new PrismaClient();

// ── Validación ──────────────────────────────────────────────────────────────

const recepcionSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(200),
  telefono: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  medio: z.enum(['PRESENCIAL', 'TELEFONO', 'WHATSAPP', 'EMAIL', 'WEB', 'OTRO']),
  motivo: z.string().max(500).optional().nullable(),
  observaciones: z.string().max(10000).optional().nullable(),
  comoLlego: z.string().max(100).optional().nullable(),
  estado: z.enum(['PENDIENTE', 'CONTACTADO', 'CITA_AGENDADA', 'CERRADO']).optional(),
  fechaCita: z.string().datetime().optional().nullable(),
  notasCita: z.string().max(500).optional().nullable(),
  fechaContacto: z.string().datetime().optional(),
});

function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Datos inválidos';
  const campo = issue.path.join('.');
  return campo ? `Datos inválidos en "${campo}": ${issue.message}` : `Datos inválidos: ${issue.message}`;
}

/** Texto de fecha/hora para el historial, siempre en hora Argentina. */
const fmtCita = (d: Date) => formatearFechaHoraAR(d);

// ── POST /web - Formulario público del sitio web (sin auth) ────────────────

const webFormSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(200),
  telefono: z.string().max(50).optional().nullable(),
  email: z.union([z.string().email().max(255), z.literal(''), z.null()]).optional(),
  motivo: z.string().max(500).optional().nullable(),
  comoLlego: z.string().max(100).optional().nullable(),
});

const webFormLimiter = rateLimit({
  max: 5,
  windowMs: 15 * 60 * 1000,
  mensaje: 'Recibimos demasiadas consultas desde tu conexión. Probá de nuevo en unos minutos o escribinos por WhatsApp.',
});

router.post('/web', webFormLimiter, async (req: Request, res: Response) => {
  try {
    // Honeypot anti-bots: campo oculto "website" que un humano nunca completa
    if (typeof req.body?.website === 'string' && req.body.website.trim() !== '') {
      return res.status(200).json({ message: 'Consulta recibida correctamente' });
    }
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
  } catch (error: any) {
    handleError(error, 'crear recepción web', res);
  }
});

// ── GET / - Listar recepciones ──────────────────────────────────────────────

router.get('/', authMiddleware, requirePermiso('RECEPCION', 'leer'), async (req: Request, res: Response) => {
  try {
    const { busqueda, estado } = req.query;
    const pag = parsePaginacion(req.query, 100);
    if (typeof pag === 'string') return res.status(400).json({ error: pag });
    const { page, limit, skip } = pag;

    const where: any = {};

    if (!puedeVerTodos(req as AuthRequest, 'RECEPCION')) {
      where.registradoPorId = (req as any).userId;
    }

    if (estado && typeof estado === 'string') {
      where.estado = estado;
    }

    if (busqueda && typeof busqueda === 'string') {
      where.OR = [
        { nombre: { contains: busqueda, mode: 'insensitive' } },
        { telefono: { contains: busqueda } },
        { email: { contains: busqueda, mode: 'insensitive' } },
      ];
    }

    const [recepciones, total] = await Promise.all([
      prisma.recepcion.findMany({
        where,
        skip,
        take: limit,
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
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    handleError(error, 'listar recepciones', res);
  }
});

// ── GET /citas - Listar citas agendadas ─────────────────────────────────────

router.get('/citas', authMiddleware, requirePermiso('RECEPCION', 'leer'), async (req: Request, res: Response) => {
  try {
    const { desde, hasta } = req.query;
    const verTodos = puedeVerTodos(req as AuthRequest, 'RECEPCION');
    const userId = (req as any).userId;

    const where: any = {
      fechaCita: { not: null },
    };

    if (desde || hasta) {
      where.fechaCita = { ...where.fechaCita };
      if (desde && typeof desde === 'string') {
        const d = filtroDesdeAR(desde);
        if (!esFechaValida(d)) return res.status(400).json({ error: 'Fecha "desde" inválida' });
        where.fechaCita.gte = d;
      }
      if (hasta && typeof hasta === 'string') {
        const h = filtroHastaAR(hasta);
        if (!esFechaValida(h)) return res.status(400).json({ error: 'Fecha "hasta" inválida' });
        where.fechaCita.lte = h;
      }
    }

    const citas = await prisma.recepcion.findMany({
      where,
      orderBy: { fechaCita: 'asc' },
      include: {
        registradoPor: { select: { id: true, nombre: true } },
      },
    });

    if (verTodos) {
      res.json(citas);
    } else {
      res.json(citas.map(c => {
        if (c.registradoPorId === userId) return c;
        return {
          ...c,
          nombre: 'Reservado',
          telefono: null,
          email: null,
          motivo: null,
          observaciones: null,
          notasCita: null,
          comoLlego: null,
          _masked: true,
        };
      }));
    }
  } catch (error: any) {
    handleError(error, 'listar citas', res);
  }
});

// ── GET /stats - Estadísticas completas de recepción ──────────────────────

router.get('/stats', authMiddleware, requirePermiso('RECEPCION', 'leer'), async (req: Request, res: Response) => {
  try {
    const { desde, hasta } = req.query;
    const where: any = {};
    if (!puedeVerTodos(req as AuthRequest, 'RECEPCION')) {
      where.registradoPorId = (req as any).userId;
    }
    if (desde || hasta) {
      where.fechaContacto = {};
      if (desde && typeof desde === 'string') {
        const d = filtroDesdeAR(desde);
        if (!esFechaValida(d)) return res.status(400).json({ error: 'Fecha "desde" inválida' });
        where.fechaContacto.gte = d;
      }
      if (hasta && typeof hasta === 'string') {
        const h = filtroHastaAR(hasta);
        if (!esFechaValida(h)) return res.status(400).json({ error: 'Fecha "hasta" inválida' });
        where.fechaContacto.lte = h;
      }
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
  } catch (error: any) {
    handleError(error, 'obtener estadísticas de recepción', res);
  }
});

// ── GET /stats/como-llego - Compatibilidad ────────────────────────────────

router.get('/stats/como-llego', authMiddleware, requirePermiso('RECEPCION', 'leer'), async (req: Request, res: Response) => {
  try {
    const where: any = {};
    if (!puedeVerTodos(req as AuthRequest, 'RECEPCION')) {
      where.registradoPorId = (req as AuthRequest).userId;
    }
    const result = await prisma.recepcion.groupBy({
      by: ['comoLlego'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    res.json(result.map(r => ({ comoLlego: r.comoLlego || 'Sin especificar', total: r._count.id })));
  } catch (error: any) {
    handleError(error, 'obtener stats como llegó', res);
  }
});

// ── GET /:id - Detalle recepción ────────────────────────────────────────────

router.get('/:id', authMiddleware, requirePermiso('RECEPCION', 'leer'), async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    const recepcion = await prisma.recepcion.findUnique({
      where: { id },
      include: {
        registradoPor: { select: { id: true, nombre: true } },
        historial: { orderBy: { createdAt: 'desc' }, include: { creadoPor: { select: { id: true, nombre: true } } } },
      },
    });

    if (!recepcion) {
      return res.status(404).json({ error: 'Registro de recepción no encontrado' });
    }

    if (!puedeAcceder(req as AuthRequest, 'RECEPCION', recepcion.registradoPorId, 'leer')) {
      return res.status(403).json({ error: 'No tenés permiso para ver este contacto' });
    }

    res.json(recepcion);
  } catch (error: any) {
    handleError(error, 'obtener recepción', res);
  }
});

// ── POST / - Crear registro ─────────────────────────────────────────────────

router.post('/', authMiddleware, requirePermiso('RECEPCION', 'crear'), async (req: Request, res: Response) => {
  try {
    const parsed = recepcionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error), detalles: parsed.error.flatten() });
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

    const desc = data.fechaCita
      ? `Contacto registrado con cita el ${fmtCita(new Date(data.fechaCita))}`
      : 'Contacto registrado';
    await prisma.recepcionHistorial.create({
      data: { recepcionId: recepcion.id, tipo: 'CREADA', descripcion: desc, creadoPorId: (req as any).userId },
    });

    res.status(201).json(recepcion);
  } catch (error: any) {
    handleError(error, 'crear recepción', res);
  }
});

// ── PUT /:id - Editar registro ──────────────────────────────────────────────

router.put('/:id', authMiddleware, requirePermiso('RECEPCION', 'editar'), async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    const recepcion = await prisma.recepcion.findUnique({
      where: { id },
    });

    if (!recepcion) {
      return res.status(404).json({ error: 'Registro de recepción no encontrado' });
    }

    if (!puedeAcceder(req as AuthRequest, 'RECEPCION', recepcion.registradoPorId, 'escribir')) {
      return res.status(403).json({ error: 'No tenés permiso para editar este contacto' });
    }

    // Email vacío se trata como null (el schema exige formato válido si viene)
    const body = { ...req.body };
    if (body.email === '') body.email = null;
    const parsed = recepcionSchema.partial().safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error), detalles: parsed.error.flatten() });
    }
    const data = parsed.data as Record<string, any>;

    const updateData: any = {};
    const allowedFields = [
      'nombre', 'telefono', 'email', 'medio', 'motivo',
      'observaciones', 'comoLlego', 'estado', 'notasCita',
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
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
            id: { not: id }, // Excluir la cita actual
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
      where: { id },
      data: updateData,
      include: {
        registradoPor: { select: { id: true, nombre: true } },
      },
    });

    const histEntries: { tipo: string; descripcion: string }[] = [];
    if (req.body.fechaCita !== undefined && recepcion.fechaCita) {
      const anterior = fmtCita(recepcion.fechaCita);
      if (req.body.fechaCita) {
        const nueva = new Date(req.body.fechaCita);
        histEntries.push({ tipo: 'REAGENDADA', descripcion: `Cita reagendada de ${anterior} a ${fmtCita(nueva)}` });
      } else {
        histEntries.push({ tipo: 'EDITADA', descripcion: `Cita cancelada (era ${anterior})` });
      }
    } else if (req.body.fechaCita && !recepcion.fechaCita) {
      const nueva = new Date(req.body.fechaCita);
      histEntries.push({ tipo: 'CREADA', descripcion: `Cita agendada para ${fmtCita(nueva)}` });
    }
    if (req.body.estado && req.body.estado !== recepcion.estado) {
      histEntries.push({ tipo: 'ESTADO_CAMBIADO', descripcion: `Estado cambiado de ${recepcion.estado} a ${req.body.estado}` });
    }
    if (histEntries.length > 0) {
      await prisma.recepcionHistorial.createMany({
        data: histEntries.map(h => ({ recepcionId: recepcion.id, ...h, creadoPorId: (req as any).userId })),
      });
    }

    res.json(recepcionActualizada);
  } catch (error: any) {
    handleError(error, 'actualizar recepción', res);
  }
});

// ── GET /:id/historial - Historial de cambios ──────────────────────────────

router.get('/:id/historial', authMiddleware, requirePermiso('RECEPCION', 'leer'), async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    const recepcion = await prisma.recepcion.findUnique({ where: { id }, select: { registradoPorId: true } });
    if (!recepcion) return res.status(404).json({ error: 'Registro de recepción no encontrado' });
    if (!puedeAcceder(req as AuthRequest, 'RECEPCION', recepcion.registradoPorId, 'leer')) {
      return res.status(403).json({ error: 'No tenés permiso para ver este contacto' });
    }
    const historial = await prisma.recepcionHistorial.findMany({
      where: { recepcionId: id },
      orderBy: { createdAt: 'desc' },
      include: { creadoPor: { select: { id: true, nombre: true } } },
    });
    res.json(historial);
  } catch (error: any) {
    handleError(error, 'obtener historial', res);
  }
});

// ── DELETE /:id - Eliminar registro ─────────────────────────────────────────

router.delete('/:id', authMiddleware, requirePermiso('RECEPCION', 'eliminar'), async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    const recepcion = await prisma.recepcion.findUnique({
      where: { id },
    });

    if (!recepcion) {
      return res.status(404).json({ error: 'Registro de recepción no encontrado' });
    }

    if (!puedeAcceder(req as AuthRequest, 'RECEPCION', recepcion.registradoPorId, 'escribir')) {
      return res.status(403).json({ error: 'No tenés permiso para eliminar este contacto' });
    }

    await prisma.recepcion.delete({ where: { id } });

    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error: any) {
    handleError(error, 'eliminar recepción', res);
  }
});

export default router;
