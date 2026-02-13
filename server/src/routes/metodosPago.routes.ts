import { Router, Request, Response } from "express";
import { prisma } from "../index.js";
import { authMiddleware, requireRol } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

// GET /api/metodos-pago
router.get("/", async (_req: Request, res: Response) => {
  try {
    const metodos = await prisma.metodoPago.findMany({
      where: { activo: true },
      include: {
        planesFinanciacion: {
          where: { activo: true },
          orderBy: { cantidadCuotas: "asc" },
        },
      },
    });
    res.json(metodos);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener métodos de pago" });
  }
});

// POST /api/metodos-pago (solo admin)
router.post("/", requireRol("ADMIN"), async (req: Request, res: Response) => {
  try {
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: "Nombre es requerido" });
    }

    const metodo = await prisma.metodoPago.create({
      data: { nombre },
    });

    res.status(201).json(metodo);
  } catch (error) {
    res.status(500).json({ error: "Error al crear método de pago" });
  }
});

// PUT /api/metodos-pago/:id
router.put("/:id", requireRol("ADMIN"), async (req: Request, res: Response) => {
  try {
    const metodo = await prisma.metodoPago.update({
      where: { id: Number(req.params.id) },
      data: req.body,
    });
    res.json(metodo);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar método de pago" });
  }
});

// DELETE /api/metodos-pago/:id
router.delete("/:id", requireRol("ADMIN"), async (req: Request, res: Response) => {
  try {
    await prisma.metodoPago.update({
      where: { id: Number(req.params.id) },
      data: { activo: false },
    });
    res.json({ message: "Método de pago desactivado" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar método de pago" });
  }
});

export default router;
