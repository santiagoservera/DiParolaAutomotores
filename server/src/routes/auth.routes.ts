import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../index.js";
import { authMiddleware, AuthRequest } from "../middlewares/auth.middleware.js";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña son requeridos" });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const validPassword = await bcrypt.compare(password, usuario.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = jwt.sign(
      { userId: usuario.id, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET || "secret",
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error("Error login:", error);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.userId },
      select: { id: true, nombre: true, email: true, rol: true },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener usuario" });
  }
});

// POST /api/auth/cambiar-password
router.post("/cambiar-password", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { passwordActual, passwordNueva } = req.body;

    const usuario = await prisma.usuario.findUnique({ where: { id: req.userId } });
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const validPassword = await bcrypt.compare(passwordActual, usuario.passwordHash);
    if (!validPassword) {
      return res.status(400).json({ error: "Contraseña actual incorrecta" });
    }

    const newHash = await bcrypt.hash(passwordNueva, 10);
    await prisma.usuario.update({
      where: { id: req.userId },
      data: { passwordHash: newHash },
    });

    res.json({ message: "Contraseña actualizada" });
  } catch (error) {
    res.status(500).json({ error: "Error al cambiar contraseña" });
  }
});

export default router;
