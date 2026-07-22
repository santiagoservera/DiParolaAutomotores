import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { authMiddleware, requirePermiso, puedeVerTodos, AuthRequest } from '../middlewares/auth.middleware.js';
import { uploadComprobante } from '../middlewares/upload.middleware.js';
import cloudinary from '../config/cloudinary.js';

const router = Router();
const prisma = new PrismaClient();

// ── GET / - Listar cuotas ───────────────────────────────────────────────────

router.get('/', authMiddleware, requirePermiso('COBRANZAS', 'leer'), async (req: Request, res: Response) => {
  try {
    // Auto-mark overdue cuotas as VENCIDA
    await prisma.cuota.updateMany({
      where: {
        estado: 'PENDIENTE',
        fechaVencimiento: { lt: new Date() },
      },
      data: { estado: 'VENCIDA' },
    });

    // Auto-baja: contratos con 4+ cuotas vencidas → DE_BAJA
    const contratosConVencidas = await prisma.contrato.findMany({
      where: { estado: 'ACTIVO' },
      include: { cuotas: { where: { estado: 'VENCIDA' } } },
    });
    for (const c of contratosConVencidas) {
      if (c.cuotas.length >= 4) {
        await prisma.contrato.update({
          where: { id: c.id },
          data: { estado: 'DE_BAJA' },
        });
      }
    }

    const { page = '1', limit = '20', estado, estadoContrato, contratoId, desde, hasta, asesor } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};

    // Filtro de visibilidad por permisos
    if (!puedeVerTodos(req as AuthRequest, 'COBRANZAS')) {
      where.contrato = { ...where.contrato, registradoPorId: (req as any).userId };
    }

    // Filtro por asesor
    if (asesor && typeof asesor === 'string') {
      where.contrato = { ...where.contrato, productorAsesor: { contains: asesor } };
    }

    // Filtro por estado del contrato
    if (estadoContrato && typeof estadoContrato === 'string') {
      where.contrato = { ...where.contrato, estado: estadoContrato };
    }

    if (estado && typeof estado === 'string') {
      where.estado = estado;
    }

    if (contratoId) {
      where.contratoId = Number(contratoId);
    }

    if (desde || hasta) {
      where.fechaVencimiento = {};
      if (desde && typeof desde === 'string') {
        where.fechaVencimiento.gte = new Date(desde);
      }
      if (hasta && typeof hasta === 'string') {
        where.fechaVencimiento.lte = new Date(hasta);
      }
    }

    const [cuotas, total] = await Promise.all([
      prisma.cuota.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: [{ fechaVencimiento: 'asc' }, { numeroCuota: 'asc' }],
        include: {
          contrato: {
            select: {
              id: true,
              numeroContrato: true,
              solicitanteNombre: true,
              solicitanteDni: true,
              solicitanteCelular: true,
              marca: true,
              modelo: true,
              periodoPago: true,
              estado: true,
              productorAsesor: true,
            },
          },
          registradoPor: { select: { id: true, nombre: true } },
        },
      }),
      prisma.cuota.count({ where }),
    ]);

    res.json({
      data: cuotas,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Error al listar cuotas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── GET /vencidas - Cuotas vencidas con detalle ────────────────────────────

router.get('/vencidas', authMiddleware, requirePermiso('COBRANZAS', 'leer'), async (req: Request, res: Response) => {
  try {
    // Auto-mark overdue
    await prisma.cuota.updateMany({
      where: { estado: 'PENDIENTE', fechaVencimiento: { lt: new Date() } },
      data: { estado: 'VENCIDA' },
    });

    const vencidaWhere: any = { estado: 'VENCIDA' };
    if (!puedeVerTodos(req as AuthRequest, 'COBRANZAS')) {
      vencidaWhere.contrato = { registradoPorId: (req as any).userId };
    }

    const cuotas = await prisma.cuota.findMany({
      where: vencidaWhere,
      orderBy: { fechaVencimiento: 'asc' },
      take: 20,
      include: {
        contrato: {
          select: {
            id: true, numeroContrato: true, solicitanteNombre: true,
            solicitanteDni: true, solicitanteCelular: true, periodoPago: true,
          },
        },
      },
    });

    res.json({ data: cuotas, total: cuotas.length });
  } catch (error) {
    console.error('Error al listar vencidas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── GET /contrato/:contratoId - Cuotas de un contrato ───────────────────────

router.get('/contrato/:contratoId', authMiddleware, requirePermiso('COBRANZAS', 'leer'), async (req: Request, res: Response) => {
  try {
    const contratoId = Number(req.params.contratoId);

    const contrato = await prisma.contrato.findUnique({
      where: { id: contratoId },
      select: {
        id: true,
        numeroContrato: true,
        solicitanteNombre: true,
        solicitanteDni: true,
        solicitanteCelular: true,
        marca: true,
        modelo: true,
        anticipoMensual: true,
        periodoPago: true,
        cantidadCuotas: true,
        estado: true,
      },
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const cuotas = await prisma.cuota.findMany({
      where: { contratoId },
      orderBy: { numeroCuota: 'asc' },
      include: {
        registradoPor: { select: { id: true, nombre: true } },
      },
    });

    const totalCuotas = cuotas.length;
    const cuotasPagadas = cuotas.filter(c => c.estado === 'PAGADA').length;
    const cuotasPendientes = cuotas.filter(c => c.estado === 'PENDIENTE').length;
    const cuotasVencidas = cuotas.filter(c => c.estado === 'VENCIDA').length;
    const montoPagado = cuotas
      .filter(c => c.estado === 'PAGADA')
      .reduce((sum, c) => sum + Number(c.monto), 0);
    const montoPendiente = cuotas
      .filter(c => c.estado !== 'PAGADA')
      .reduce((sum, c) => sum + Number(c.monto), 0);

    res.json({
      contrato,
      cuotas,
      resumen: {
        totalCuotas,
        cuotasPagadas,
        cuotasPendientes,
        cuotasVencidas,
        montoPagado,
        montoPendiente,
      },
    });
  } catch (error) {
    console.error('Error al obtener cuotas del contrato:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── POST /contrato/:contratoId - Agregar cuota a un contrato ───────────────

router.post('/contrato/:contratoId', authMiddleware, requirePermiso('COBRANZAS', 'editar'), async (req: Request, res: Response) => {
  try {
    const contratoId = Number(req.params.contratoId);
    const { monto, fechaVencimiento, formaPago, observaciones } = req.body;

    if (!monto || monto <= 0) {
      return res.status(400).json({ error: 'El monto es requerido y debe ser positivo' });
    }

    const contrato = await prisma.contrato.findUnique({
      where: { id: contratoId },
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Vendedores solo pueden agregar cuotas a sus propios contratos
    if ((req as any).userRolNombre !== 'Administrador' && contrato.registradoPorId !== (req as any).userId) {
      return res.status(403).json({ error: 'No tenés permiso para modificar este contrato' });
    }

    if (contrato.estado === 'CANCELADO') {
      return res.status(400).json({ error: 'No se pueden agregar cuotas a un contrato cancelado' });
    }

    // Obtener el número de la última cuota
    const ultimaCuota = await prisma.cuota.findFirst({
      where: { contratoId },
      orderBy: { numeroCuota: 'desc' },
    });

    const nuevaNumeroCuota = (ultimaCuota?.numeroCuota || 0) + 1;

    const cuota = await prisma.$transaction(async (tx) => {
      const nuevaCuota = await tx.cuota.create({
        data: {
          contratoId,
          numeroCuota: nuevaNumeroCuota,
          monto: new Prisma.Decimal(monto),
          fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : new Date(),
          estado: 'PENDIENTE',
          formaPago: formaPago || null,
          observaciones: observaciones || null,
          registradoPorId: (req as any).userId,
        },
        include: {
          contrato: {
            select: { id: true, numeroContrato: true, solicitanteNombre: true },
          },
          registradoPor: { select: { id: true, nombre: true } },
        },
      });

      // Actualizar cantidadCuotas en el contrato
      await tx.contrato.update({
        where: { id: contratoId },
        data: { cantidadCuotas: nuevaNumeroCuota },
      });

      return nuevaCuota;
    });

    res.status(201).json(cuota);
  } catch (error) {
    console.error('Error al agregar cuota:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── PUT /:cuotaId/pagar - Registrar pago de cuota ───────────────────────────

router.put('/:cuotaId/pagar', authMiddleware, requirePermiso('COBRANZAS', 'editar'), async (req: Request, res: Response) => {
  try {
    const cuotaId = Number(req.params.cuotaId);
    const { formaPago, fechaPago, observaciones } = req.body;

    if (!formaPago) {
      return res.status(400).json({ error: 'Forma de pago requerida' });
    }

    const formasValidas = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CHEQUE', 'DEPOSITO'];
    if (!formasValidas.includes(formaPago)) {
      return res.status(400).json({ error: `Forma de pago inválida. Opciones: ${formasValidas.join(', ')}` });
    }

    const cuota = await prisma.cuota.findUnique({
      where: { id: cuotaId },
      include: { contrato: true },
    });

    if (!cuota) {
      return res.status(404).json({ error: 'Cuota no encontrada' });
    }

    if (cuota.estado === 'PAGADA') {
      return res.status(400).json({ error: 'Esta cuota ya fue pagada' });
    }

    if (cuota.contrato.estado === 'CANCELADO') {
      return res.status(400).json({ error: 'No se puede pagar cuotas de un contrato cancelado' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const cuotaActualizada = await tx.cuota.update({
        where: { id: cuotaId },
        data: {
          estado: 'PAGADA',
          formaPago,
          fechaPago: fechaPago ? new Date(fechaPago) : new Date(),
          registradoPorId: (req as any).userId,
          observaciones: observaciones || null,
        },
        include: {
          registradoPor: { select: { id: true, nombre: true } },
          contrato: {
            select: {
              id: true, numeroContrato: true, solicitanteNombre: true,
              solicitanteCelular: true, marca: true, modelo: true,
              productorAsesor: true,
            },
          },
        },
      });

      const cuotasPendientes = await tx.cuota.count({
        where: {
          contratoId: cuota.contratoId,
          estado: { not: 'PAGADA' },
        },
      });

      if (cuotasPendientes === 0) {
        await tx.contrato.update({
          where: { id: cuota.contratoId },
          data: { estado: 'COMPLETADO' },
        });
      }

      return cuotaActualizada;
    });

    res.json(result);
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── PUT /:cuotaId - Editar cuota ────────────────────────────────────────────

router.put('/:cuotaId', authMiddleware, requirePermiso('COBRANZAS', 'editar'), async (req: Request, res: Response) => {
  try {
    const cuotaId = Number(req.params.cuotaId);

    const cuota = await prisma.cuota.findUnique({ where: { id: cuotaId } });

    if (!cuota) {
      return res.status(404).json({ error: 'Cuota no encontrada' });
    }

    const updateData: any = {};

    if (req.body.monto !== undefined) {
      updateData.monto = new Prisma.Decimal(req.body.monto);
    }
    if (req.body.fechaVencimiento !== undefined) {
      updateData.fechaVencimiento = new Date(req.body.fechaVencimiento);
    }
    if (req.body.estado !== undefined) {
      const estadosValidos = ['PENDIENTE', 'PAGADA', 'VENCIDA', 'DE_BAJA'];
      if (!estadosValidos.includes(req.body.estado)) {
        return res.status(400).json({ error: `Estado inválido. Opciones: ${estadosValidos.join(', ')}` });
      }
      updateData.estado = req.body.estado;
    }
    if (req.body.observaciones !== undefined) {
      updateData.observaciones = req.body.observaciones;
    }

    const cuotaActualizada = await prisma.cuota.update({
      where: { id: cuotaId },
      data: updateData,
      include: {
        contrato: {
          select: { id: true, numeroContrato: true, solicitanteNombre: true },
        },
        registradoPor: { select: { id: true, nombre: true } },
      },
    });

    res.json(cuotaActualizada);
  } catch (error) {
    console.error('Error al editar cuota:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── DELETE /:cuotaId - Eliminar cuota ──────────────────────────────────────

router.delete('/:cuotaId', authMiddleware, requirePermiso('COBRANZAS', 'eliminar'), async (req: Request, res: Response) => {
  try {
    const cuotaId = Number(req.params.cuotaId);

    const cuota = await prisma.cuota.findUnique({
      where: { id: cuotaId },
      include: { contrato: true },
    });

    if (!cuota) {
      return res.status(404).json({ error: 'Cuota no encontrada' });
    }

    // Vendedores solo pueden eliminar cuotas de sus contratos
    if ((req as any).userRolNombre !== 'Administrador' && cuota.contrato.registradoPorId !== (req as any).userId) {
      return res.status(403).json({ error: 'No tenés permiso para eliminar esta cuota' });
    }

    if (cuota.estado === 'PAGADA') {
      return res.status(400).json({ error: 'No se puede eliminar una cuota pagada' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.cuota.delete({ where: { id: cuotaId } });

      // Actualizar cantidadCuotas
      const count = await tx.cuota.count({ where: { contratoId: cuota.contratoId } });
      await tx.contrato.update({
        where: { id: cuota.contratoId },
        data: { cantidadCuotas: count },
      });
    });

    res.json({ message: 'Cuota eliminada' });
  } catch (error) {
    console.error('Error al eliminar cuota:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── POST /:cuotaId/observaciones - Agregar observación ────────────────────

router.post('/:cuotaId/observaciones', authMiddleware, requirePermiso('COBRANZAS', 'editar'), async (req: Request, res: Response) => {
  try {
    const cuotaId = Number(req.params.cuotaId);
    const { texto } = req.body;
    if (!texto || !texto.trim()) {
      return res.status(400).json({ error: 'El texto es requerido' });
    }
    const cuota = await prisma.cuota.findUnique({ where: { id: cuotaId } });
    if (!cuota) return res.status(404).json({ error: 'Cuota no encontrada' });

    const obs = await prisma.cuotaObservacion.create({
      data: {
        cuotaId,
        texto: texto.trim(),
        creadoPorId: (req as any).userId,
      },
      include: {
        creadoPor: { select: { id: true, nombre: true } },
      },
    });
    res.status(201).json(obs);
  } catch (error) {
    console.error('Error al agregar observación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── GET /:cuotaId/observaciones - Listar observaciones ────────────────────

router.get('/:cuotaId/observaciones', authMiddleware, requirePermiso('COBRANZAS', 'leer'), async (req: Request, res: Response) => {
  try {
    const cuotaId = Number(req.params.cuotaId);
    const observaciones = await prisma.cuotaObservacion.findMany({
      where: { cuotaId },
      orderBy: { createdAt: 'desc' },
      include: {
        creadoPor: { select: { id: true, nombre: true } },
      },
    });
    res.json(observaciones);
  } catch (error) {
    console.error('Error al listar observaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── POST /:cuotaId/comprobantes - Subir comprobante ──────────────────────

router.post('/:cuotaId/comprobantes', authMiddleware, requirePermiso('COBRANZAS', 'editar'), uploadComprobante.single('comprobante'), async (req: Request, res: Response) => {
  try {
    const cuotaId = Number(req.params.cuotaId);
    const cuota = await prisma.cuota.findUnique({ where: { id: cuotaId } });
    if (!cuota) return res.status(404).json({ error: 'Cuota no encontrada' });
    if (!req.file) return res.status(400).json({ error: 'No se proporcionó archivo' });

    const comprobante = await prisma.cuotaComprobante.create({
      data: {
        cuotaId,
        url: (req.file as any).path,
        publicId: (req.file as any).filename,
      },
    });
    res.status(201).json(comprobante);
  } catch (error) {
    console.error('Error al subir comprobante:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── GET /:cuotaId/comprobantes - Listar comprobantes ─────────────────────

router.get('/:cuotaId/comprobantes', authMiddleware, requirePermiso('COBRANZAS', 'leer'), async (req: Request, res: Response) => {
  try {
    const cuotaId = Number(req.params.cuotaId);
    const comprobantes = await prisma.cuotaComprobante.findMany({
      where: { cuotaId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(comprobantes);
  } catch (error) {
    console.error('Error al listar comprobantes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── DELETE /:cuotaId/comprobantes/:comprobanteId - Eliminar comprobante ───

router.delete('/:cuotaId/comprobantes/:comprobanteId', authMiddleware, requirePermiso('COBRANZAS', 'eliminar'), async (req: Request, res: Response) => {
  try {
    const comp = await prisma.cuotaComprobante.findFirst({
      where: { id: Number(req.params.comprobanteId), cuotaId: Number(req.params.cuotaId) },
    });
    if (!comp) return res.status(404).json({ error: 'Comprobante no encontrado' });

    await cloudinary.uploader.destroy(comp.publicId);
    await prisma.cuotaComprobante.delete({ where: { id: comp.id } });
    res.json({ message: 'Comprobante eliminado' });
  } catch (error) {
    console.error('Error al eliminar comprobante:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
