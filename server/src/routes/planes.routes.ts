import { Router, Request, Response } from "express";
import { prisma } from "../index.js";
import { authMiddleware, requireRol } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

// GET /api/planes
router.get("/", async (_req: Request, res: Response) => {
  try {
    const planes = await prisma.planFinanciacion.findMany({
      where: { activo: true },
      include: { metodoPago: true },
      orderBy: { cantidadCuotas: "asc" },
    });
    res.json(planes);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener planes" });
  }
});

// GET /api/planes/por-metodo/:metodoPagoId
router.get("/por-metodo/:metodoPagoId", async (req: Request, res: Response) => {
  try {
    const planes = await prisma.planFinanciacion.findMany({
      where: {
        metodoPagoId: Number(req.params.metodoPagoId),
        activo: true,
      },
      orderBy: { cantidadCuotas: "asc" },
    });
    res.json(planes);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener planes" });
  }
});

// POST /api/planes (solo admin)
router.post("/", requireRol("ADMIN"), async (req: Request, res: Response) => {
  try {
    const { metodoPagoId, cantidadCuotas, porcentajeInteres } = req.body;

    if (!metodoPagoId || !cantidadCuotas || porcentajeInteres === undefined) {
      return res.status(400).json({ error: "Todos los campos son requeridos" });
    }

    const plan = await prisma.planFinanciacion.create({
      data: { metodoPagoId, cantidadCuotas, porcentajeInteres },
      include: { metodoPago: true },
    });

    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: "Error al crear plan" });
  }
});

// PUT /api/planes/:id
router.put("/:id", requireRol("ADMIN"), async (req: Request, res: Response) => {
  try {
    const plan = await prisma.planFinanciacion.update({
      where: { id: Number(req.params.id) },
      data: req.body,
      include: { metodoPago: true },
    });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar plan" });
  }
});

// DELETE /api/planes/:id
router.delete("/:id", requireRol("ADMIN"), async (req: Request, res: Response) => {
  try {
    await prisma.planFinanciacion.update({
      where: { id: Number(req.params.id) },
      data: { activo: false },
    });
    res.json({ message: "Plan desactivado" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar plan" });
  }
});

export default router;
