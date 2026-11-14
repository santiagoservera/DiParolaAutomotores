import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware, requirePermiso, puedeVerTodos, puedeAcceder, esAdmin, AuthRequest } from '../middlewares/auth.middleware.js';
import { uploadComprobante, destruirSubida } from '../middlewares/upload.middleware.js';
import cloudinary from '../config/cloudinary.js';
import { handleError, HttpError } from '../utils/errorHandler.js';
import {
  parseFechaAR, esFechaValida, limiteVencimiento, fechaCalendarioAR, partesFechaAR,
  filtroDesdeCalendario, filtroHastaCalendario,
} from '../utils/fechas.js';
import { parsePaginacion, parseId } from '../utils/paginacion.js';

const router = Router();
const prisma = new PrismaClient();

const FORMAS_PAGO = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'DEBITO', 'CHEQUE', 'DEPOSITO'] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Monto ya pagado de una cuota: max(suma de CuotaPago, montoPagado). Cubre cuotas legacy sin CuotaPago. */
function calcularPagado(cuota: { estado: string; monto: Prisma.Decimal; montoPagado: Prisma.Decimal | null }, sumaPagos: number): number {
  const pagado = Math.max(sumaPagos, Number(cuota.montoPagado || 0));
  // Cuota legacy marcada PAGADA sin registros de pago (anticipo, importadas): se considera paga completa
  if (cuota.estado === 'PAGADA' && pagado === 0) return Number(cuota.monto);
  return pagado;
}

function calcularEstadoCuota(monto: number, pagado: number, fechaVencimiento: Date): string {
  if (pagado >= monto - 0.01) return 'PAGADA';
  if (pagado > 0.009) return 'PARCIAL';
  if (fechaVencimiento < limiteVencimiento()) return 'VENCIDA';
  return 'PENDIENTE';
}

/**
 * Carga la cuota con el dueño del contrato y verifica acceso.
 * Si no corresponde, responde (400/404/403) y devuelve null.
 */
async function cargarCuotaConAcceso(req: Request, res: Response, accion: 'leer' | 'escribir') {
  const cuotaId = parseId(req.params.cuotaId);
  if (!cuotaId) {
    res.status(400).json({ error: 'ID de cuota inválido' });
    return null;
  }
  const cuota = await prisma.cuota.findUnique({
    where: { id: cuotaId },
    select: { id: true, contratoId: true, contrato: { select: { registradoPorId: true } } },
  });
  if (!cuota) {
    res.status(404).json({ error: 'Cuota no encontrada' });
    return null;
  }
  if (!puedeAcceder(req as AuthRequest, 'COBRANZAS', cuota.contrato.registradoPorId, accion)) {
    res.status(403).json({
      error: accion === 'leer'
        ? 'No tenés permiso para ver esta cuota'
        : 'No tenés permiso para modificar esta cuota',
    });
    return null;
  }
  return cuota;
}

// ── GET / - Listar cuotas ───────────────────────────────────────────────────

router.get('/', authMiddleware, requirePermiso('COBRANZAS', 'leer'), async (req: Request, res: Response) => {
  try {
    const { estado, estadoContrato, contratoId, desde, hasta, asesor } = req.query;
    const pag = parsePaginacion(req.query, 1000);
    if (typeof pag === 'string') return res.status(400).json({ error: pag });
    const { page, limit, skip } = pag;

    // Auto-mark overdue cuotas as VENCIDA (la auto-baja de contratos corre en el scheduler diario)
    await prisma.cuota.updateMany({
      where: {
        estado: 'PENDIENTE',
        fechaVencimiento: { lt: limiteVencimiento() },
      },
      data: { estado: 'VENCIDA' },
    });

    const where: any = {};

    // Filtro de visibilidad por permisos
    if (!puedeVerTodos(req as AuthRequest, 'COBRANZAS')) {
      where.contrato = { ...where.contrato, registradoPorId: (req as any).userId };
    }

    // Filtro por asesor
    if (asesor && typeof asesor === 'string') {
      where.contrato = { ...where.contrato, productorAsesor: { contains: asesor, mode: 'insensitive' } };
    }

    // Filtro por estado del contrato
    if (estadoContrato && typeof estadoContrato === 'string') {
      where.contrato = { ...where.contrato, estado: estadoContrato };
    }

    if (estado && typeof estado === 'string') {
      where.estado = estado;
    }

    if (contratoId) {
      const cid = parseId(contratoId);
      if (!cid) return res.status(400).json({ error: 'El parámetro "contratoId" es inválido' });
      where.contratoId = cid;
    }

    if (desde || hasta) {
      where.fechaVencimiento = {};
      if (desde && typeof desde === 'string') {
        const d = filtroDesdeCalendario(desde);
        if (!esFechaValida(d)) return res.status(400).json({ error: 'Fecha "desde" inválida' });
        where.fechaVencimiento.gte = d;
      }
      if (hasta && typeof hasta === 'string') {
        const h = filtroHastaCalendario(hasta);
        if (!esFechaValida(h)) return res.status(400).json({ error: 'Fecha "hasta" inválida' });
        where.fechaVencimiento.lte = h;
      }
    }

    const [cuotas, total] = await Promise.all([
      prisma.cuota.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ fechaVencimiento: 'asc' }, { numeroCuota: 'asc' }, { id: 'asc' }],
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
              anticipoMensual: true,
              periodoPago: true,
              estado: true,
              productorAsesor: true,
              registradoPorId: true,
              montoDevolucion: true,
              tipoFinanciamiento: true,
            },
          },
          pagos: {
            orderBy: { createdAt: 'desc' },
            include: { registradoPor: { select: { id: true, nombre: true } } },
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
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    handleError(error, 'listar cuotas', res);
  }
});

// ── GET /vencidas - Cuotas vencidas con detalle ────────────────────────────

router.get('/vencidas', authMiddleware, requirePermiso('COBRANZAS', 'leer'), async (req: Request, res: Response) => {
  try {
    // Auto-mark overdue
    await prisma.cuota.updateMany({
      where: { estado: 'PENDIENTE', fechaVencimiento: { lt: limiteVencimiento() } },
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
  } catch (error: any) {
    handleError(error, 'listar cuotas vencidas', res);
  }
});

// ── GET /contrato/:contratoId - Cuotas de un contrato ───────────────────────

router.get('/contrato/:contratoId', authMiddleware, requirePermiso('COBRANZAS', 'leer'), async (req: Request, res: Response) => {
  try {
    const contratoId = parseId(req.params.contratoId);
    if (!contratoId) return res.status(400).json({ error: 'ID de contrato inválido' });

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
        registradoPorId: true,
        montoDevolucion: true,
        tipoFinanciamiento: true,
      },
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    if (!puedeAcceder(req as AuthRequest, 'COBRANZAS', contrato.registradoPorId, 'leer')) {
      return res.status(403).json({ error: 'No tenés permiso para ver las cuotas de este contrato' });
    }

    const cuotas = await prisma.cuota.findMany({
      where: { contratoId },
      orderBy: { numeroCuota: 'asc' },
      include: {
        pagos: {
          orderBy: { createdAt: 'desc' },
          include: { registradoPor: { select: { id: true, nombre: true } } },
        },
        registradoPor: { select: { id: true, nombre: true } },
      },
    });

    const totalCuotas = cuotas.length;
    const cuotasPagadas = cuotas.filter(c => c.estado === 'PAGADA').length;
    const cuotasPendientes = cuotas.filter(c => c.estado === 'PENDIENTE').length;
    const cuotasVencidas = cuotas.filter(c => c.estado === 'VENCIDA').length;
    const cuotasParciales = cuotas.filter(c => c.estado === 'PARCIAL').length;
    const montoPagado = cuotas.reduce((sum, c) => {
      if (c.estado === 'PAGADA') return sum + Number(c.monto);
      if (c.estado === 'PARCIAL') return sum + Number(c.montoPagado || 0);
      return sum;
    }, 0);
    const montoPendiente = cuotas.reduce((sum, c) => {
      if (c.estado === 'PAGADA') return sum;
      if (c.estado === 'PARCIAL') return sum + (Number(c.monto) - Number(c.montoPagado || 0));
      return sum + Number(c.monto);
    }, 0);

    res.json({
      contrato,
      cuotas,
      resumen: {
        totalCuotas,
        cuotasPagadas,
        cuotasPendientes,
        cuotasVencidas,
        cuotasParciales,
        montoPagado,
        montoPendiente,
      },
    });
  } catch (error: any) {
    handleError(error, 'obtener cuotas del contrato', res);
  }
});

// ── POST /contrato/:contratoId - Agregar cuota a un contrato ───────────────

router.post('/contrato/:contratoId', authMiddleware, requirePermiso('COBRANZAS', 'editar'), async (req: Request, res: Response) => {
  try {
    const contratoId = parseId(req.params.contratoId);
    if (!contratoId) return res.status(400).json({ error: 'ID de contrato inválido' });
    const { fechaVencimiento, formaPago, observaciones } = req.body;
    const monto = Number(req.body.monto);

    if (!Number.isFinite(monto) || monto <= 0) {
      return res.status(400).json({ error: 'El monto es requerido y debe ser positivo' });
    }
    if (observaciones && String(observaciones).length > 500) {
      return res.status(400).json({ error: 'Las observaciones no pueden superar los 500 caracteres' });
    }
    if (formaPago && !(FORMAS_PAGO as readonly string[]).includes(formaPago)) {
      return res.status(400).json({ error: `Forma de pago inválida. Opciones: ${FORMAS_PAGO.join(', ')}` });
    }

    let fechaVenc: Date;
    if (fechaVencimiento) {
      fechaVenc = parseFechaAR(fechaVencimiento);
      if (!esFechaValida(fechaVenc)) {
        return res.status(400).json({ error: 'Fecha de vencimiento inválida', campo: 'fechaVencimiento' });
      }
    } else {
      const hoy = partesFechaAR();
      fechaVenc = fechaCalendarioAR(hoy.anio, hoy.mes, hoy.dia);
    }

    const contrato = await prisma.contrato.findUnique({
      where: { id: contratoId },
    });

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Vendedores solo pueden agregar cuotas a sus propios contratos
    if (!puedeAcceder(req as AuthRequest, 'COBRANZAS', contrato.registradoPorId, 'escribir')) {
      return res.status(403).json({ error: 'No tenés permiso para modificar este contrato' });
    }

    if (contrato.estado !== 'ACTIVO') {
      return res.status(400).json({ error: `No se pueden agregar cuotas a un contrato ${contrato.estado.toLowerCase()}` });
    }

    const cuota = await prisma.$transaction(async (tx) => {
      // Lock del contrato para que dos altas concurrentes no tomen el mismo número de cuota
      await tx.$queryRaw`SELECT id FROM contratos WHERE id = ${contratoId} FOR UPDATE`;

      const ultimaCuota = await tx.cuota.findFirst({
        where: { contratoId },
        orderBy: { numeroCuota: 'desc' },
      });
      const nuevaNumeroCuota = (ultimaCuota?.numeroCuota || 0) + 1;

      const nuevaCuota = await tx.cuota.create({
        data: {
          contratoId,
          numeroCuota: nuevaNumeroCuota,
          monto: new Prisma.Decimal(monto),
          fechaVencimiento: fechaVenc,
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
  } catch (error: any) {
    handleError(error, 'agregar cuota', res);
  }
});

// ── PUT /:cuotaId/pagar - Registrar pago de cuota ───────────────────────────

const lineaPagoSchema = z.object({
  monto: z.coerce.number({ invalid_type_error: 'Monto inválido' }).finite().positive('El monto debe ser mayor a 0'),
  formaPago: z.enum(FORMAS_PAGO, { errorMap: () => ({ message: `Forma de pago inválida. Opciones: ${FORMAS_PAGO.join(', ')}` }) }),
});

const pagarSchema = z.object({
  // Nuevo: varias líneas de pago registradas atómicamente
  pagos: z.array(lineaPagoSchema).min(1, 'Ingresá al menos una línea de pago').max(10, 'Máximo 10 líneas de pago').optional(),
  // Compatibilidad: una sola línea
  formaPago: z.string().optional().nullable(),
  monto: z.union([z.number(), z.string(), z.null()]).optional(),
  fechaPago: z.string().max(40).optional().nullable(),
  observaciones: z.string().max(500, 'Las observaciones no pueden superar los 500 caracteres').optional().nullable(),
});

router.put('/:cuotaId/pagar', authMiddleware, requirePermiso('COBRANZAS', 'editar'), async (req: Request, res: Response) => {
  try {
    const cuotaId = parseId(req.params.cuotaId);
    if (!cuotaId) return res.status(400).json({ error: 'ID de cuota inválido' });

    const parsed = pagarSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return res.status(400).json({ error: issue?.message || 'Datos de pago inválidos', detalles: parsed.error.flatten() });
    }
    const { pagos, formaPago, monto: montoBody, fechaPago, observaciones } = parsed.data;

    // Líneas de pago: array nuevo o línea única (monto opcional → saldo restante)
    let lineas: { monto: number | null; formaPago: string }[];
    if (pagos && pagos.length > 0) {
      lineas = pagos.map(p => ({ monto: round2(p.monto), formaPago: p.formaPago }));
    } else {
      if (!formaPago) {
        return res.status(400).json({ error: 'Forma de pago requerida' });
      }
      if (!(FORMAS_PAGO as readonly string[]).includes(formaPago)) {
        return res.status(400).json({ error: `Forma de pago inválida. Opciones: ${FORMAS_PAGO.join(', ')}` });
      }
      let m: number | null = null;
      if (montoBody !== undefined && montoBody !== null && montoBody !== '') {
        m = Number(montoBody);
        if (!Number.isFinite(m)) return res.status(400).json({ error: 'Monto inválido' });
        if (m <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
        m = round2(m);
      }
      lineas = [{ monto: m, formaPago }];
    }

    let fechaPagoDate = new Date();
    if (fechaPago) {
      fechaPagoDate = parseFechaAR(fechaPago);
      if (!esFechaValida(fechaPagoDate)) {
        return res.status(400).json({ error: 'Fecha de pago inválida', campo: 'fechaPago' });
      }
    }

    // Verificación de acceso antes de abrir la transacción
    const acceso = await cargarCuotaConAcceso(req, res, 'escribir');
    if (!acceso) return;

    const userId = (req as any).userId;

    const result = await prisma.$transaction(async (tx) => {
      // Lock de la fila de la cuota: serializa pagos concurrentes sobre la misma cuota
      await tx.$queryRaw`SELECT id FROM cuotas WHERE id = ${cuotaId} FOR UPDATE`;

      const cuota = await tx.cuota.findUnique({
        where: { id: cuotaId },
        include: { contrato: { select: { estado: true } }, pagos: { select: { monto: true } } },
      });
      if (!cuota) throw new HttpError(404, 'Cuota no encontrada');
      if (cuota.estado === 'PAGADA') throw new HttpError(400, 'Esta cuota ya fue pagada');
      if (cuota.contrato.estado === 'CANCELADO') {
        throw new HttpError(400, 'No se puede pagar cuotas de un contrato cancelado');
      }

      const montoTotal = Number(cuota.monto);
      const sumaPagos = cuota.pagos.reduce((s, p) => s + Number(p.monto), 0);
      const pagadoPrevio = calcularPagado(cuota, sumaPagos);
      const restante = round2(montoTotal - pagadoPrevio);

      if (restante <= 0) throw new HttpError(400, 'Esta cuota no tiene saldo pendiente');

      const lineasFinales = lineas.map(l => ({ monto: l.monto ?? restante, formaPago: l.formaPago }));
      const totalNuevo = round2(lineasFinales.reduce((s, l) => s + l.monto, 0));
      if (totalNuevo > restante + 0.01) {
        throw new HttpError(400, `El monto excede el saldo restante (${restante.toFixed(2)})`);
      }

      const nuevoMontoPagado = round2(pagadoPrevio + totalNuevo);
      const quedaCompleta = nuevoMontoPagado >= montoTotal - 0.01;

      for (const linea of lineasFinales) {
        await tx.cuotaPago.create({
          data: {
            cuotaId,
            monto: new Prisma.Decimal(linea.monto),
            formaPago: linea.formaPago,
            fechaPago: fechaPagoDate,
            observaciones: observaciones || null,
            registradoPorId: userId,
          },
        });
      }

      return tx.cuota.update({
        where: { id: cuotaId },
        data: {
          estado: quedaCompleta ? 'PAGADA' : 'PARCIAL',
          montoPagado: new Prisma.Decimal(nuevoMontoPagado),
          formaPago: lineasFinales[lineasFinales.length - 1].formaPago,
          fechaPago: fechaPagoDate,
          registradoPorId: userId,
          observaciones: observaciones || null,
        },
        include: {
          pagos: {
            orderBy: { createdAt: 'desc' },
            include: { registradoPor: { select: { id: true, nombre: true } } },
          },
          registradoPor: { select: { id: true, nombre: true } },
          contrato: {
            select: {
              id: true, numeroContrato: true, solicitanteNombre: true,
              solicitanteCelular: true, marca: true, modelo: true,
              productorAsesor: true, anticipoMensual: true,
            },
          },
        },
      });
    });

    res.json(result);
  } catch (error: any) {
    handleError(error, 'registrar pago', res);
  }
});

// ── GET /:cuotaId/pagos - Listar pagos de una cuota ─────────────────────────

router.get('/:cuotaId/pagos', authMiddleware, requirePermiso('COBRANZAS', 'leer'), async (req: Request, res: Response) => {
  try {
    const cuota = await cargarCuotaConAcceso(req, res, 'leer');
    if (!cuota) return;
    const pagos = await prisma.cuotaPago.findMany({
      where: { cuotaId: cuota.id },
      orderBy: { createdAt: 'desc' },
      include: {
        registradoPor: { select: { id: true, nombre: true } },
      },
    });
    res.json(pagos);
  } catch (error: any) {
    handleError(error, 'listar pagos', res);
  }
});

// ── PUT /:cuotaId - Editar cuota ────────────────────────────────────────────

router.put('/:cuotaId', authMiddleware, requirePermiso('COBRANZAS', 'editar'), async (req: Request, res: Response) => {
  try {
    const acceso = await cargarCuotaConAcceso(req, res, 'escribir');
    if (!acceso) return;
    const cuotaId = acceso.id;

    if (req.body.montoPagado !== undefined) {
      return res.status(400).json({ error: 'El monto pagado no se edita manualmente: registrá un pago' });
    }

    const cuota = await prisma.cuota.findUnique({
      where: { id: cuotaId },
      include: { pagos: { select: { monto: true } } },
    });

    if (!cuota) {
      return res.status(404).json({ error: 'Cuota no encontrada' });
    }

    const updateData: any = {};

    let nuevoMonto = Number(cuota.monto);
    if (req.body.monto !== undefined) {
      nuevoMonto = Number(req.body.monto);
      if (!Number.isFinite(nuevoMonto) || nuevoMonto <= 0) {
        return res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
      }
      nuevoMonto = round2(nuevoMonto);
      updateData.monto = new Prisma.Decimal(nuevoMonto);
    }

    let nuevaFecha = cuota.fechaVencimiento;
    if (req.body.fechaVencimiento !== undefined && req.body.fechaVencimiento !== null && req.body.fechaVencimiento !== '') {
      nuevaFecha = parseFechaAR(req.body.fechaVencimiento);
      if (!esFechaValida(nuevaFecha)) {
        return res.status(400).json({ error: 'Fecha de vencimiento inválida', campo: 'fechaVencimiento' });
      }
      updateData.fechaVencimiento = nuevaFecha;
    }

    if (req.body.observaciones !== undefined) {
      if (req.body.observaciones && String(req.body.observaciones).length > 500) {
        return res.status(400).json({ error: 'Las observaciones no pueden superar los 500 caracteres' });
      }
      updateData.observaciones = req.body.observaciones;
    }

    // Estado: se recalcula a partir de monto, pagado real y vencimiento.
    // Solo DE_BAJA se puede fijar manualmente (no se deriva de los pagos).
    const sumaPagos = cuota.pagos.reduce((s, p) => s + Number(p.monto), 0);
    const pagado = calcularPagado(cuota, sumaPagos);
    const estadoCalculado = calcularEstadoCuota(nuevoMonto, pagado, nuevaFecha);

    if (req.body.estado !== undefined) {
      const estadosValidos = ['PENDIENTE', 'PAGADA', 'VENCIDA', 'PARCIAL', 'DE_BAJA'];
      if (!estadosValidos.includes(req.body.estado)) {
        return res.status(400).json({ error: `Estado inválido. Opciones: ${estadosValidos.join(', ')}` });
      }
      if (req.body.estado === 'PAGADA' && estadoCalculado !== 'PAGADA') {
        return res.status(400).json({ error: 'No se puede marcar la cuota como pagada sin pagos registrados: usá "Pagar"' });
      }
    }

    if (req.body.estado === 'DE_BAJA') {
      updateData.estado = 'DE_BAJA';
    } else if (cuota.estado === 'DE_BAJA' && req.body.estado === undefined) {
      // Se mantiene DE_BAJA si no se pide otro estado
    } else {
      updateData.estado = estadoCalculado;
    }
    if (pagado > 0) {
      updateData.montoPagado = new Prisma.Decimal(round2(pagado));
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
  } catch (error: any) {
    handleError(error, 'editar cuota', res);
  }
});

// ── DELETE /:cuotaId - Eliminar cuota ──────────────────────────────────────

router.delete('/:cuotaId', authMiddleware, requirePermiso('COBRANZAS', 'eliminar'), async (req: Request, res: Response) => {
  try {
    const cuotaId = parseId(req.params.cuotaId);
    if (!cuotaId) return res.status(400).json({ error: 'ID de cuota inválido' });

    const cuota = await prisma.cuota.findUnique({
      where: { id: cuotaId },
      include: { contrato: true },
    });

    if (!cuota) {
      return res.status(404).json({ error: 'Cuota no encontrada' });
    }

    // Vendedores solo pueden eliminar cuotas de sus contratos
    if (!puedeAcceder(req as AuthRequest, 'COBRANZAS', cuota.contrato.registradoPorId, 'escribir')) {
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
  } catch (error: any) {
    handleError(error, 'eliminar cuota', res);
  }
});

// ── POST /generar-masivo - Generar cuotas para todos los contratos activos ──

const generarMasivoSchema = z.object({
  meses: z.array(z.number().int('Los meses deben ser enteros').min(0, 'Mes inválido (0-11)').max(11, 'Mes inválido (0-11)'))
    .min(1, 'Seleccioná al menos un mes')
    .max(12, 'Máximo 12 meses'),
  anio: z.coerce.number().int('Año inválido').min(2000, 'Año inválido').max(2100, 'Año inválido'),
});

router.post('/generar-masivo', authMiddleware, requirePermiso('COBRANZAS', 'crear'), async (req: Request, res: Response) => {
  try {
    if (!esAdmin(req as AuthRequest)) {
      return res.status(403).json({ error: 'Solo un administrador puede generar cuotas masivamente' });
    }

    const parsed = generarMasivoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Meses (array) y año son requeridos' });
    }
    const anio = parsed.data.anio;
    const meses = Array.from(new Set(parsed.data.meses)).sort((a, b) => a - b);
    const userId = (req as any).userId;

    const contratos = await prisma.contrato.findMany({
      where: { estado: 'ACTIVO' },
      select: { id: true, solicitanteNombre: true },
    });

    let cuotasCreadas = 0;
    let contratosAfectados = 0;
    const errores: string[] = [];

    for (const { id, solicitanteNombre } of contratos) {
      try {
        const creadas = await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM contratos WHERE id = ${id} FOR UPDATE`;

          const contrato = await tx.contrato.findUnique({
            where: { id },
            include: { cuotas: { orderBy: { numeroCuota: 'asc' } } },
          });
          if (!contrato || contrato.estado !== 'ACTIVO') return 0;

          // Obtener monto base: 2da cuota si existe, sino la 1ra, sino el anticipo
          const cuota2 = contrato.cuotas.find(c => c.numeroCuota === 2);
          const cuota1 = contrato.cuotas.find(c => c.numeroCuota === 1);
          const montoBase = cuota2 ? Number(cuota2.monto) : cuota1 ? Number(cuota1.monto) : Number(contrato.anticipoMensual);

          if (!(montoBase > 0)) return 0;

          let siguienteNumero = contrato.cuotas.length > 0
            ? Math.max(...contrato.cuotas.map(c => c.numeroCuota)) + 1
            : 1;

          let n = 0;
          for (const mesActual of meses) {
            // Verificar si ya existe cuota para ese mes/año (rango en días UTC: cubre fechas legacy y nuevas)
            const inicioMes = new Date(Date.UTC(anio, mesActual, 1));
            const inicioMesSiguiente = new Date(Date.UTC(anio, mesActual + 1, 1));
            const yaExiste = contrato.cuotas.some(c => {
              const fv = new Date(c.fechaVencimiento);
              return fv >= inicioMes && fv < inicioMesSiguiente;
            });
            if (yaExiste) continue;

            const dia = contrato.periodoPago === '1-10' ? 10 : contrato.periodoPago === '10-20' ? 20 : 28;
            const ultimoDia = new Date(Date.UTC(anio, mesActual + 1, 0)).getUTCDate();

            await tx.cuota.create({
              data: {
                contratoId: contrato.id,
                numeroCuota: siguienteNumero++,
                monto: new Prisma.Decimal(montoBase),
                fechaVencimiento: fechaCalendarioAR(anio, mesActual, Math.min(dia, ultimoDia)),
                estado: 'PENDIENTE',
                registradoPorId: userId,
              },
            });
            n++;
          }

          if (n > 0) {
            const totalCuotas = await tx.cuota.count({ where: { contratoId: contrato.id } });
            await tx.contrato.update({
              where: { id: contrato.id },
              data: { cantidadCuotas: totalCuotas },
            });
          }
          return n;
        });

        if (creadas > 0) {
          contratosAfectados++;
          cuotasCreadas += creadas;
        }
      } catch (err: any) {
        errores.push(`${solicitanteNombre}: ${err.message}`);
      }
    }

    res.json({
      message: `Se generaron ${cuotasCreadas} cuotas en ${contratosAfectados} contratos`,
      cuotasCreadas,
      contratosAfectados,
      totalContratos: contratos.length,
      errores: errores.length > 0 ? errores : undefined,
    });
  } catch (error: any) {
    handleError(error, 'generar cuotas masivo', res);
  }
});

// ── POST /:cuotaId/observaciones - Agregar observación ────────────────────

router.post('/:cuotaId/observaciones', authMiddleware, requirePermiso('COBRANZAS', 'editar'), async (req: Request, res: Response) => {
  try {
    const { texto } = req.body;
    if (!texto || typeof texto !== 'string' || !texto.trim()) {
      return res.status(400).json({ error: 'El texto es requerido' });
    }
    if (texto.trim().length > 500) {
      return res.status(400).json({ error: 'La observación no puede superar los 500 caracteres' });
    }
    const cuota = await cargarCuotaConAcceso(req, res, 'escribir');
    if (!cuota) return;

    const obs = await prisma.cuotaObservacion.create({
      data: {
        cuotaId: cuota.id,
        texto: texto.trim(),
        creadoPorId: (req as any).userId,
      },
      include: {
        creadoPor: { select: { id: true, nombre: true } },
      },
    });
    res.status(201).json(obs);
  } catch (error: any) {
    handleError(error, 'agregar observación', res);
  }
});

// ── GET /:cuotaId/observaciones - Listar observaciones ────────────────────

router.get('/:cuotaId/observaciones', authMiddleware, requirePermiso('COBRANZAS', 'leer'), async (req: Request, res: Response) => {
  try {
    const cuota = await cargarCuotaConAcceso(req, res, 'leer');
    if (!cuota) return;
    const observaciones = await prisma.cuotaObservacion.findMany({
      where: { cuotaId: cuota.id },
      orderBy: { createdAt: 'desc' },
      include: {
        creadoPor: { select: { id: true, nombre: true } },
      },
    });
    res.json(observaciones);
  } catch (error: any) {
    handleError(error, 'listar observaciones', res);
  }
});

// ── POST /:cuotaId/comprobantes - Subir comprobante ──────────────────────

router.post(
  '/:cuotaId/comprobantes',
  authMiddleware,
  requirePermiso('COBRANZAS', 'editar'),
  // Validar existencia y dueño ANTES de subir a Cloudinary
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cuota = await cargarCuotaConAcceso(req, res, 'escribir');
      if (!cuota) return;
      next();
    } catch (error: any) {
      handleError(error, 'subir comprobante', res);
    }
  },
  uploadComprobante.single('comprobante'),
  async (req: Request, res: Response) => {
    try {
      const cuotaId = Number(req.params.cuotaId);
      if (!req.file) return res.status(400).json({ error: 'No se proporcionó archivo' });

      const comprobante = await prisma.cuotaComprobante.create({
        data: {
          cuotaId,
          url: (req.file as any).path,
          publicId: (req.file as any).filename,
        },
      });
      res.status(201).json(comprobante);
    } catch (error: any) {
      await destruirSubida(req.file);
      handleError(error, 'subir comprobante', res);
    }
  },
);

// ── GET /:cuotaId/comprobantes - Listar comprobantes ─────────────────────

router.get('/:cuotaId/comprobantes', authMiddleware, requirePermiso('COBRANZAS', 'leer'), async (req: Request, res: Response) => {
  try {
    const cuota = await cargarCuotaConAcceso(req, res, 'leer');
    if (!cuota) return;
    const comprobantes = await prisma.cuotaComprobante.findMany({
      where: { cuotaId: cuota.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(comprobantes);
  } catch (error: any) {
    handleError(error, 'listar comprobantes', res);
  }
});

// ── DELETE /:cuotaId/comprobantes/:comprobanteId - Eliminar comprobante ───

router.delete('/:cuotaId/comprobantes/:comprobanteId', authMiddleware, requirePermiso('COBRANZAS', 'eliminar'), async (req: Request, res: Response) => {
  try {
    const cuota = await cargarCuotaConAcceso(req, res, 'escribir');
    if (!cuota) return;

    const comp = await prisma.cuotaComprobante.findFirst({
      where: { id: Number(req.params.comprobanteId) || 0, cuotaId: cuota.id },
    });
    if (!comp) return res.status(404).json({ error: 'Comprobante no encontrado' });

    await cloudinary.uploader.destroy(comp.publicId);
    await prisma.cuotaComprobante.delete({ where: { id: comp.id } });
    res.json({ message: 'Comprobante eliminado' });
  } catch (error: any) {
    handleError(error, 'eliminar comprobante', res);
  }
});

export default router;
