import { Router, Request, Response } from "express";
import { prisma } from "../index.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

// GET /api/clientes
router.get("/", async (req: Request, res: Response) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = search
      ? {
          OR: [
            { nombre: { contains: String(search) } },
            { apellido: { contains: String(search) } },
            { dni: { contains: String(search) } },
            { telefono: { contains: String(search) } },
          ],
          activo: true,
        }
      : { activo: true };

    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { fechaCreacion: "desc" },
      }),
      prisma.cliente.count({ where }),
    ]);

    res.json({ data: clientes, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener clientes" });
  }
});

// GET /api/clientes/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        operaciones: {
          include: { vehiculo: true, metodoPago: true },
          orderBy: { fechaCreacion: "desc" },
        },
        cuentasAhorro: {
          include: { vehiculoObjetivo: true, pagos: true },
        },
      },
    });

    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    res.json(cliente);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener cliente" });
  }
});

// POST /api/clientes
router.post("/", async (req: Request, res: Response) => {
  try {
    const { nombre, apellido, dni, telefono, email, direccion } = req.body;

    if (!nombre || !apellido || !dni) {
      return res.status(400).json({ error: "Nombre, apellido y DNI son requeridos" });
    }

    const existe = await prisma.cliente.findUnique({ where: { dni } });
    if (existe) {
      return res.status(400).json({ error: "Ya existe un cliente con ese DNI" });
    }

    const cliente = await prisma.cliente.create({
      data: { nombre, apellido, dni, telefono, email, direccion },
    });

    res.status(201).json(cliente);
  } catch (error) {
    res.status(500).json({ error: "Error al crear cliente" });
  }
});

// PUT /api/clientes/:id
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const cliente = await prisma.cliente.update({
      where: { id: Number(req.params.id) },
      data: req.body,
    });
    res.json(cliente);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar cliente" });
  }
});

// DELETE /api/clientes/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await prisma.cliente.update({
      where: { id: Number(req.params.id) },
      data: { activo: false },
    });
    res.json({ message: "Cliente eliminado" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar cliente" });
  }
});

export default router;
