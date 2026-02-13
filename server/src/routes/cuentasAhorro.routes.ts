import { Router, Request, Response } from "express";
import { prisma } from "../index.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

// GET /api/cuentas-ahorro
router.get("/", async (req: Request, res: Response) => {
  try {
    const { estado, clienteId } = req.query;

    const cuentas = await prisma.cuentaAhorro.findMany({
      where: {
        ...(estado && { estado: estado as any }),
        ...(clienteId && { clienteId: Number(clienteId) }),
      },
      include: {
        cliente: { select: { id: true, nombre: true, apellido: true, dni: true } },
        vehiculoObjetivo: { select: { id: true, marca: true, modelo: true, precioBase: true } },
        _count: { select: { pagos: true } },
      },
      orderBy: { fechaCreacion: "desc" },
    });

    res.json(cuentas);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener cuentas de ahorro" });
  }
});

// GET /api/cuentas-ahorro/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const cuenta = await prisma.cuentaAhorro.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        cliente: true,
        vehiculoObjetivo: { include: { imagenes: { where: { esPrincipal: true } } } },
        pagos: {
          include: { metodoPago: true, registradoPor: { select: { nombre: true } } },
          orderBy: { fechaPago: "desc" },
        },
      },
    });

    if (!cuenta) {
      return res.status(404).json({ error: "Cuenta de ahorro no encontrada" });
    }

    res.json(cuenta);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener cuenta de ahorro" });
  }
});

// GET /api/cuentas-ahorro/cliente/:clienteId
router.get("/cliente/:clienteId", async (req: Request, res: Response) => {
  try {
    const cuentas = await prisma.cuentaAhorro.findMany({
      where: { clienteId: Number(req.params.clienteId) },
      include: {
        vehiculoObjetivo: true,
        pagos: { orderBy: { fechaPago: "desc" } },
      },
    });

    res.json(cuentas);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener cuentas del cliente" });
  }
});

// POST /api/cuentas-ahorro
router.post("/", async (req: Request, res: Response) => {
  try {
    const { clienteId, vehiculoObjetivoId, montoObjetivo } = req.body;

    if (!clienteId) {
      return res.status(400).json({ error: "Cliente es requerido" });
    }

    // Verificar si ya tiene cuenta activa
    const cuentaExistente = await prisma.cuentaAhorro.findFirst({
      where: { clienteId, estado: "ACTIVA" },
    });

    if (cuentaExistente) {
      return res.status(400).json({ error: "El cliente ya tiene una cuenta de ahorro activa" });
    }

    const cuenta = await prisma.cuentaAhorro.create({
      data: {
        clienteId,
        vehiculoObjetivoId,
        montoObjetivo,
      },
      include: { cliente: true, vehiculoObjetivo: true },
    });

    res.status(201).json(cuenta);
  } catch (error) {
    res.status(500).json({ error: "Error al crear cuenta de ahorro" });
  }
});

// PUT /api/cuentas-ahorro/:id
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { vehiculoObjetivoId, montoObjetivo } = req.body;

    const cuenta = await prisma.cuentaAhorro.update({
      where: { id: Number(req.params.id) },
      data: { vehiculoObjetivoId, montoObjetivo },
      include: { vehiculoObjetivo: true },
    });

    res.json(cuenta);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar cuenta" });
  }
});

// POST /api/cuentas-ahorro/:id/cancelar
router.post("/:id/cancelar", async (req: Request, res: Response) => {
  try {
    const cuenta = await prisma.cuentaAhorro.update({
      where: { id: Number(req.params.id) },
      data: { estado: "CANCELADA" },
    });

    res.json(cuenta);
  } catch (error) {
    res.status(500).json({ error: "Error al cancelar cuenta" });
  }
});

export default router;
