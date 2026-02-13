import { Router, Request, Response } from "express";
import { prisma } from "../index.js";
import { authMiddleware, AuthRequest } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

// GET /api/pagos
router.get("/", async (req: Request, res: Response) => {
  try {
    const { operacionId, cuentaAhorroId, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      ...(operacionId && { operacionId: Number(operacionId) }),
      ...(cuentaAhorroId && { cuentaAhorroId: Number(cuentaAhorroId) }),
    };

    const [pagos, total] = await Promise.all([
      prisma.pago.findMany({
        where,
        include: {
          metodoPago: true,
          registradoPor: { select: { id: true, nombre: true } },
          operacion: {
            select: { id: true, cliente: { select: { nombre: true, apellido: true } } },
          },
          cuentaAhorro: {
            select: { id: true, cliente: { select: { nombre: true, apellido: true } } },
          },
        },
        skip,
        take: Number(limit),
        orderBy: { fechaPago: "desc" },
      }),
      prisma.pago.count({ where }),
    ]);

    res.json({ data: pagos, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener pagos" });
  }
});

// POST /api/pagos/operacion - Registrar pago de cuota
router.post("/operacion", async (req: AuthRequest, res: Response) => {
  try {
    const { operacionId, monto, metodoPagoId, numeroCuota, observaciones } = req.body;

    if (!operacionId || !monto || !metodoPagoId) {
      return res.status(400).json({ error: "Operación, monto y método de pago son requeridos" });
    }

    const operacion = await prisma.operacion.findUnique({
      where: { id: operacionId },
    });

    if (!operacion) {
      return res.status(404).json({ error: "Operación no encontrada" });
    }

    if (operacion.estado !== "VENDIDO") {
      return res.status(400).json({ error: "Solo se pueden registrar pagos en ventas confirmadas" });
    }

    // Crear pago y actualizar saldo
    const [pago] = await prisma.$transaction([
      prisma.pago.create({
        data: {
          operacionId,
          monto,
          metodoPagoId,
          numeroCuota,
          observaciones,
          registradoPorUsuarioId: req.userId!,
        },
        include: { metodoPago: true },
      }),
      prisma.operacion.update({
        where: { id: operacionId },
        data: {
          saldoPendiente: { decrement: monto },
        },
      }),
    ]);

    res.status(201).json(pago);
  } catch (error) {
    res.status(500).json({ error: "Error al registrar pago" });
  }
});

// POST /api/pagos/ahorro - Registrar pago en cuenta de ahorro
router.post("/ahorro", async (req: AuthRequest, res: Response) => {
  try {
    const { cuentaAhorroId, monto, metodoPagoId, observaciones } = req.body;

    if (!cuentaAhorroId || !monto || !metodoPagoId) {
      return res.status(400).json({ error: "Cuenta, monto y método de pago son requeridos" });
    }

    const cuenta = await prisma.cuentaAhorro.findUnique({
      where: { id: cuentaAhorroId },
    });

    if (!cuenta) {
      return res.status(404).json({ error: "Cuenta de ahorro no encontrada" });
    }

    if (cuenta.estado !== "ACTIVA") {
      return res.status(400).json({ error: "La cuenta no está activa" });
    }

    // Crear pago y actualizar saldo
    const nuevoSaldo = Number(cuenta.saldoActual) + Number(monto);

    const [pago, cuentaActualizada] = await prisma.$transaction([
      prisma.pago.create({
        data: {
          cuentaAhorroId,
          monto,
          metodoPagoId,
          observaciones,
          registradoPorUsuarioId: req.userId!,
        },
        include: { metodoPago: true },
      }),
      prisma.cuentaAhorro.update({
        where: { id: cuentaAhorroId },
        data: { saldoActual: nuevoSaldo },
      }),
    ]);

    // Verificar si alcanzó el objetivo
    if (cuenta.montoObjetivo && nuevoSaldo >= Number(cuenta.montoObjetivo)) {
      await prisma.cuentaAhorro.update({
        where: { id: cuentaAhorroId },
        data: { estado: "COMPLETADA" },
      });
    }

    res.status(201).json({ pago, saldoActual: nuevoSaldo });
  } catch (error) {
    res.status(500).json({ error: "Error al registrar pago" });
  }
});

// DELETE /api/pagos/:id (solo admin, anular pago)
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const pago = await prisma.pago.findUnique({
      where: { id: Number(req.params.id) },
    });

    if (!pago) {
      return res.status(404).json({ error: "Pago no encontrado" });
    }

    // Revertir el pago
    await prisma.$transaction([
      prisma.pago.delete({ where: { id: pago.id } }),
      // Si era pago de operación, incrementar saldo pendiente
      ...(pago.operacionId
        ? [
            prisma.operacion.update({
              where: { id: pago.operacionId },
              data: { saldoPendiente: { increment: pago.monto } },
            }),
          ]
        : []),
      // Si era pago de ahorro, decrementar saldo
      ...(pago.cuentaAhorroId
        ? [
            prisma.cuentaAhorro.update({
              where: { id: pago.cuentaAhorroId },
              data: { saldoActual: { decrement: pago.monto } },
            }),
          ]
        : []),
    ]);

    res.json({ message: "Pago anulado" });
  } catch (error) {
    res.status(500).json({ error: "Error al anular pago" });
  }
});

export default router;
