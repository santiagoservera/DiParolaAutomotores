import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../index.js";
import { authMiddleware, requireRol, AuthRequest } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);
router.use(requireRol("ADMIN"));

// GET /api/usuarios
router.get("/", async (req: Request, res: Response) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: { id: true, nombre: true, email: true, rol: true, activo: true, fechaCreacion: true },
      orderBy: { fechaCreacion: "desc" },
    });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

// POST /api/usuarios
router.post("/", async (req: Request, res: Response) => {
  try {
    const { nombre, email, password, rol = "VENDEDOR" } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: "Nombre, email y contraseña son requeridos" });
    }

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) {
      return res.status(400).json({ error: "El email ya está registrado" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const usuario = await prisma.usuario.create({
      data: { nombre, email, passwordHash, rol },
      select: { id: true, nombre: true, email: true, rol: true },
    });

    res.status(201).json(usuario);
  } catch (error) {
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

// PUT /api/usuarios/:id
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, email, rol, activo, password } = req.body;

    const data: any = {};
    if (nombre) data.nombre = nombre;
    if (email) data.email = email;
    if (rol) data.rol = rol;
    if (activo !== undefined) data.activo = activo;
    if (password) data.passwordHash = await bcrypt.hash(password, 10);

    const usuario = await prisma.usuario.update({
      where: { id: Number(id) },
      data,
      select: { id: true, nombre: true, email: true, rol: true, activo: true },
    });

    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

// DELETE /api/usuarios/:id (soft delete)
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (Number(id) === req.userId) {
      return res.status(400).json({ error: "No podés eliminarte a vos mismo" });
    }

    await prisma.usuario.update({
      where: { id: Number(id) },
      data: { activo: false },
    });

    res.json({ message: "Usuario desactivado" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

export default router;
