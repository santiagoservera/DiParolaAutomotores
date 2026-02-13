import { Router, Request, Response } from "express";
import { prisma } from "../index.js";
import { authMiddleware, AuthRequest } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

// GET /api/operaciones
router.get("/", async (req: Request, res: Response) => {
  try {
    const { estado, clienteId, vehiculoId, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      ...(estado && { estado: estado as any }),
      ...(clienteId && { clienteId: Number(clienteId) }),
      ...(vehiculoId && { vehiculoId: Number(vehiculoId) }),
    };

    const [operaciones, total] = await Promise.all([
      prisma.operacion.findMany({
        where,
        include: {
          cliente: { select: { id: true, nombre: true, apellido: true, dni: true } },
          vehiculo: { select: { id: true, marca: true, modelo: true, anio: true } },
          metodoPago: true,
          planFinanciacion: true,
          registradoPor: { select: { id: true, nombre: true } },
        },
        skip,
        take: Number(limit),
        orderBy: { fechaCreacion: "desc" },
      }),
      prisma.operacion.count({ where }),
    ]);

    res.json({ data: operaciones, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener operaciones" });
  }
});

// GET /api/operaciones/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const operacion = await prisma.operacion.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        cliente: true,
        vehiculo: { include: { imagenes: true } },
        metodoPago: true,
        planFinanciacion: true,
        registradoPor: { select: { id: true, nombre: true } },
        pagos: { orderBy: { numeroCuota: "asc" } },
      },
    });

    if (!operacion) {
      return res.status(404).json({ error: "Operación no encontrada" });
    }

    res.json(operacion);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener operación" });
  }
});

// POST /api/operaciones/simular - Crear simulación
router.post("/simular", async (req: AuthRequest, res: Response) => {
  try {
    const { clienteId, vehiculoId, metodoPagoId, planFinanciacionId, montoEntregaInicial = 0 } = req.body;

    if (!clienteId || !vehiculoId || !metodoPagoId) {
      return res.status(400).json({ error: "Cliente, vehículo y método de pago son requeridos" });
    }

    // Obtener vehículo
    const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
    if (!vehiculo || vehiculo.estado !== "DISPONIBLE") {
      return res.status(400).json({ error: "Vehículo no disponible" });
    }

    // Calcular financiación
    let cantidadCuotas = null;
    let porcentajeInteres = null;
    let totalFinanciado = null;
    let valorCuota = null;

    const precioBase = Number(vehiculo.precioBase);
    let saldoPendiente = precioBase - Number(montoEntregaInicial);

    if (planFinanciacionId) {
      const plan = await prisma.planFinanciacion.findUnique({ where: { id: planFinanciacionId } });
      if (!plan || !plan.activo) {
        return res.status(400).json({ error: "Plan de financiación no válido" });
      }

      cantidadCuotas = plan.cantidadCuotas;
      porcentajeInteres = Number(plan.porcentajeInteres);
      totalFinanciado = saldoPendiente * (1 + porcentajeInteres / 100);
      valorCuota = totalFinanciado / cantidadCuotas;
      saldoPendiente = totalFinanciado;
    }

    const operacion = await prisma.operacion.create({
      data: {
        clienteId,
        vehiculoId,
        metodoPagoId,
        planFinanciacionId,
        precioBase: vehiculo.precioBase,
        cantidadCuotas,
        porcentajeInteres,
        totalFinanciado,
        valorCuota,
        montoEntregaInicial,
        saldoPendiente,
        estado: "SIMULACION",
        registradoPorUsuarioId: req.userId!,
      },
      include: {
        cliente: true,
        vehiculo: true,
        metodoPago: true,
        planFinanciacion: true,
      },
    });

    res.status(201).json(operacion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear simulación" });
  }
});

// POST /api/operaciones/:id/reservar - Pasar de simulación a reserva
router.post("/:id/reservar", async (req: AuthRequest, res: Response) => {
  try {
    const operacion = await prisma.operacion.findUnique({
      where: { id: Number(req.params.id) },
      include: { vehiculo: true },
    });

    if (!operacion) {
      return res.status(404).json({ error: "Operación no encontrada" });
    }

    if (operacion.estado !== "SIMULACION") {
      return res.status(400).json({ error: "Solo se pueden reservar simulaciones" });
    }

    if (operacion.vehiculo.estado !== "DISPONIBLE") {
      return res.status(400).json({ error: "El vehículo ya no está disponible" });
    }

    const [updated] = await prisma.$transaction([
      prisma.operacion.update({
        where: { id: operacion.id },
        data: { estado: "RESERVA" },
      }),
      prisma.vehiculo.update({
        where: { id: operacion.vehiculoId },
        data: { estado: "RESERVADO" },
      }),
    ]);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Error al reservar" });
  }
});

// POST /api/operaciones/:id/confirmar - Confirmar venta
router.post("/:id/confirmar", async (req: AuthRequest, res: Response) => {
  try {
    const operacion = await prisma.operacion.findUnique({
      where: { id: Number(req.params.id) },
      include: { vehiculo: true },
    });

    if (!operacion) {
      return res.status(404).json({ error: "Operación no encontrada" });
    }

    if (!["SIMULACION", "RESERVA"].includes(operacion.estado)) {
      return res.status(400).json({ error: "Esta operación no puede ser confirmada" });
    }

    if (!["DISPONIBLE", "RESERVADO"].includes(operacion.vehiculo.estado)) {
      return res.status(400).json({ error: "El vehículo ya no está disponible" });
    }

    const [updated] = await prisma.$transaction([
      prisma.operacion.update({
        where: { id: operacion.id },
        data: {
          estado: "VENDIDO",
          fechaConfirmacion: new Date(),
        },
      }),
      prisma.vehiculo.update({
        where: { id: operacion.vehiculoId },
        data: { estado: "VENDIDO" },
      }),
    ]);

    res.json({ message: "Venta confirmada", operacion: updated });
  } catch (error) {
    res.status(500).json({ error: "Error al confirmar venta" });
  }
});

// POST /api/operaciones/:id/cancelar
router.post("/:id/cancelar", async (req: Request, res: Response) => {
  try {
    const operacion = await prisma.operacion.findUnique({
      where: { id: Number(req.params.id) },
    });

    if (!operacion) {
      return res.status(404).json({ error: "Operación no encontrada" });
    }

    if (operacion.estado === "VENDIDO") {
      return res.status(400).json({ error: "No se puede cancelar una venta confirmada" });
    }

    const [updated] = await prisma.$transaction([
      prisma.operacion.update({
        where: { id: operacion.id },
        data: { estado: "CANCELADO" },
      }),
      // Si estaba reservado, liberar el vehículo
      ...(operacion.estado === "RESERVA"
        ? [
            prisma.vehiculo.update({
              where: { id: operacion.vehiculoId },
              data: { estado: "DISPONIBLE" },
            }),
          ]
        : []),
    ]);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Error al cancelar operación" });
  }
});

export default router;
