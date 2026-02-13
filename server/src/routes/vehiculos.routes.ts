import { Router, Request, Response } from "express";
import { prisma } from "../index.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

// GET /api/vehiculos/publicos - Para la landing (sin auth)
router.get("/publicos", async (req: Request, res: Response) => {
  try {
    const { marca, tipo, limit = 12 } = req.query;

    const vehiculos = await prisma.vehiculo.findMany({
      where: {
        estado: "DISPONIBLE",
        activo: true,
        ...(marca && { marca: { contains: String(marca) } }),
        ...(tipo && { tipo: tipo as any }),
      },
      include: {
        imagenes: { where: { esPrincipal: true }, take: 1 },
      },
      take: Number(limit),
      orderBy: { fechaCreacion: "desc" },
    });

    res.json(vehiculos);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener vehículos" });
  }
});

// Rutas protegidas
router.use(authMiddleware);

// GET /api/vehiculos
router.get("/", async (req: Request, res: Response) => {
  try {
    const { search, estado, tipo, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      activo: true,
      ...(search && {
        OR: [
          { marca: { contains: String(search) } },
          { modelo: { contains: String(search) } },
        ],
      }),
      ...(estado && { estado: estado as any }),
      ...(tipo && { tipo: tipo as any }),
    };

    const [vehiculos, total] = await Promise.all([
      prisma.vehiculo.findMany({
        where,
        include: { imagenes: true },
        skip,
        take: Number(limit),
        orderBy: { fechaCreacion: "desc" },
      }),
      prisma.vehiculo.count({ where }),
    ]);

    res.json({ data: vehiculos, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener vehículos" });
  }
});

// GET /api/vehiculos/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        imagenes: { orderBy: { orden: "asc" } },
        operaciones: {
          include: { cliente: true },
          orderBy: { fechaCreacion: "desc" },
          take: 10,
        },
      },
    });

    if (!vehiculo) {
      return res.status(404).json({ error: "Vehículo no encontrado" });
    }

    res.json(vehiculo);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener vehículo" });
  }
});

// POST /api/vehiculos
router.post("/", async (req: Request, res: Response) => {
  try {
    const { marca, modelo, anio, tipo, descripcion, precioBase, imagenes } = req.body;

    if (!marca || !modelo || !anio || !precioBase) {
      return res.status(400).json({ error: "Marca, modelo, año y precio son requeridos" });
    }

    const vehiculo = await prisma.vehiculo.create({
      data: {
        marca,
        modelo,
        anio,
        tipo: tipo || "SEDAN",
        descripcion,
        precioBase,
        imagenes: imagenes?.length
          ? { create: imagenes.map((img: any, i: number) => ({ urlImagen: img.url, esPrincipal: i === 0, orden: i })) }
          : undefined,
      },
      include: { imagenes: true },
    });

    res.status(201).json(vehiculo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear vehículo" });
  }
});

// PUT /api/vehiculos/:id
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { imagenes, ...data } = req.body;

    const vehiculo = await prisma.vehiculo.update({
      where: { id: Number(req.params.id) },
      data,
      include: { imagenes: true },
    });

    res.json(vehiculo);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar vehículo" });
  }
});

// DELETE /api/vehiculos/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id: Number(req.params.id) },
    });

    if (vehiculo?.estado === "VENDIDO") {
      return res.status(400).json({ error: "No se puede eliminar un vehículo vendido" });
    }

    await prisma.vehiculo.update({
      where: { id: Number(req.params.id) },
      data: { activo: false },
    });

    res.json({ message: "Vehículo eliminado" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar vehículo" });
  }
});

// POST /api/vehiculos/:id/imagenes
router.post("/:id/imagenes", async (req: Request, res: Response) => {
  try {
    const { urlImagen, esPrincipal = false } = req.body;

    if (esPrincipal) {
      await prisma.vehiculoImagen.updateMany({
        where: { vehiculoId: Number(req.params.id) },
        data: { esPrincipal: false },
      });
    }

    const imagen = await prisma.vehiculoImagen.create({
      data: {
        vehiculoId: Number(req.params.id),
        urlImagen,
        esPrincipal,
      },
    });

    res.status(201).json(imagen);
  } catch (error) {
    res.status(500).json({ error: "Error al agregar imagen" });
  }
});

// DELETE /api/vehiculos/:id/imagenes/:imagenId
router.delete("/:id/imagenes/:imagenId", async (req: Request, res: Response) => {
  try {
    await prisma.vehiculoImagen.delete({
      where: { id: Number(req.params.imagenId) },
    });
    res.json({ message: "Imagen eliminada" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar imagen" });
  }
});

export default router;
