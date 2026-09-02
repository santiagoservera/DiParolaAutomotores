import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { authMiddleware, requirePermiso, AuthRequest } from "../middlewares/auth.middleware.js";
import { handleError } from '../utils/errorHandler.js';

const router = Router();
const prisma = new PrismaClient();

const MODULOS = ["VENTAS", "COBRANZAS", "RECEPCION", "CONFIGURACION"] as const;

// Todo el módulo requiere auth + permiso de CONFIGURACION
router.use(authMiddleware);

// ════════════════════════════════════════════════════════════════════════════
// ROLES
// ════════════════════════════════════════════════════════════════════════════

// GET /api/configuracion/roles
router.get("/roles", requirePermiso("CONFIGURACION", "leer"), async (_req: Request, res: Response) => {
  try {
    const roles = await prisma.rol.findMany({
      include: { permisos: true, _count: { select: { usuarios: true } } },
      orderBy: { nombre: "asc" },
    });
    res.json(roles);
  } catch (error: any) {
    handleError(error, 'listar roles', res);
  }
});

// GET /api/configuracion/roles/:id
router.get("/roles/:id", requirePermiso("CONFIGURACION", "leer"), async (req: Request, res: Response) => {
  try {
    const rol = await prisma.rol.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        permisos: true,
        usuarios: { select: { id: true, nombre: true, email: true, activo: true } },
      },
    });

    if (!rol) {
      return res.status(404).json({ error: "Rol no encontrado" });
    }

    res.json(rol);
  } catch (error: any) {
    handleError(error, 'obtener rol', res);
  }
});

// POST /api/configuracion/roles
const rolSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(50),
  descripcion: z.string().max(255).optional().nullable(),
  permisos: z.array(z.object({
    modulo: z.enum(MODULOS),
    leer: z.boolean().default(false),
    crear: z.boolean().default(false),
    editar: z.boolean().default(false),
    eliminar: z.boolean().default(false),
    verTodos: z.boolean().default(false),
  })).optional(),
});

router.post("/roles", requirePermiso("CONFIGURACION", "crear"), async (req: Request, res: Response) => {
  try {
    const parsed = rolSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
    }

    const { nombre, descripcion, permisos } = parsed.data;

    const rol = await prisma.$transaction(async (tx) => {
      const nuevoRol = await tx.rol.create({
        data: { nombre, descripcion },
      });

      // Si se envían permisos, crearlos; si no, crear todos los módulos con false
      const permisosData = permisos && permisos.length > 0
        ? permisos.map(p => ({ rolId: nuevoRol.id, ...p }))
        : MODULOS.map(modulo => ({
            rolId: nuevoRol.id,
            modulo,
            leer: false,
            crear: false,
            editar: false,
            eliminar: false,
          }));

      await tx.permiso.createMany({ data: permisosData });

      return tx.rol.findUnique({
        where: { id: nuevoRol.id },
        include: { permisos: true },
      });
    });

    res.status(201).json(rol);
  } catch (error: any) {
    handleError(error, 'crear rol', res);
  }
});

// PUT /api/configuracion/roles/:id
router.put("/roles/:id", requirePermiso("CONFIGURACION", "editar"), async (req: Request, res: Response) => {
  try {
    const rolId = Number(req.params.id);

    const rol = await prisma.rol.findUnique({ where: { id: rolId } });
    if (!rol) {
      return res.status(404).json({ error: "Rol no encontrado" });
    }

    const { nombre, descripcion, activo } = req.body;
    const updateData: any = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (activo !== undefined) updateData.activo = activo;

    const rolActualizado = await prisma.rol.update({
      where: { id: rolId },
      data: updateData,
      include: { permisos: true },
    });

    res.json(rolActualizado);
  } catch (error: any) {
    handleError(error, 'actualizar rol', res);
  }
});

// DELETE /api/configuracion/roles/:id
router.delete("/roles/:id", requirePermiso("CONFIGURACION", "eliminar"), async (req: Request, res: Response) => {
  try {
    const rolId = Number(req.params.id);

    const usuariosConRol = await prisma.usuario.count({ where: { rolId } });
    if (usuariosConRol > 0) {
      return res.status(400).json({
        error: `No se puede eliminar: hay ${usuariosConRol} usuario(s) con este rol`,
      });
    }

    await prisma.rol.delete({ where: { id: rolId } });
    res.json({ message: "Rol eliminado correctamente" });
  } catch (error: any) {
    handleError(error, 'eliminar rol', res);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// PERMISOS DE UN ROL
// ════════════════════════════════════════════════════════════════════════════

// PUT /api/configuracion/roles/:id/permisos
// Actualiza todos los permisos de un rol de una vez
const permisosUpdateSchema = z.array(z.object({
  modulo: z.enum(MODULOS),
  leer: z.boolean(),
  crear: z.boolean(),
  editar: z.boolean(),
  eliminar: z.boolean(),
  verTodos: z.boolean().default(false),
}));

router.put("/roles/:id/permisos", requirePermiso("CONFIGURACION", "editar"), async (req: Request, res: Response) => {
  try {
    const rolId = Number(req.params.id);

    const rol = await prisma.rol.findUnique({ where: { id: rolId } });
    if (!rol) {
      return res.status(404).json({ error: "Rol no encontrado" });
    }

    const parsed = permisosUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
    }

    // Upsert cada permiso
    const permisos = await prisma.$transaction(
      parsed.data.map(p =>
        prisma.permiso.upsert({
          where: { rolId_modulo: { rolId, modulo: p.modulo } },
          update: { leer: p.leer, crear: p.crear, editar: p.editar, eliminar: p.eliminar, verTodos: p.verTodos },
          create: { rolId, modulo: p.modulo, leer: p.leer, crear: p.crear, editar: p.editar, eliminar: p.eliminar, verTodos: p.verTodos },
        })
      )
    );

    res.json(permisos);
  } catch (error: any) {
    handleError(error, 'actualizar permisos', res);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// USUARIOS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/configuracion/usuarios
router.get("/usuarios", requirePermiso("CONFIGURACION", "leer"), async (_req: Request, res: Response) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        passwordVisible: true,
        activo: true,
        fechaCreacion: true,
        rol: { select: { id: true, nombre: true } },
      },
      orderBy: { fechaCreacion: "desc" },
    });
    res.json(usuarios);
  } catch (error: any) {
    handleError(error, 'listar usuarios', res);
  }
});

// POST /api/configuracion/usuarios
const usuarioSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  rolId: z.number().int().positive("Rol requerido"),
});

router.post("/usuarios", requirePermiso("CONFIGURACION", "crear"), async (req: Request, res: Response) => {
  try {
    const parsed = usuarioSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
    }

    const { nombre, email, password, rolId } = parsed.data;

    // Verificar que el rol existe
    const rol = await prisma.rol.findUnique({ where: { id: rolId } });
    if (!rol) {
      return res.status(400).json({ error: "El rol especificado no existe" });
    }

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) {
      return res.status(409).json({ error: "El email ya está registrado" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const usuario = await prisma.usuario.create({
      data: { nombre, email, passwordHash, passwordVisible: password, rolId },
      select: {
        id: true,
        nombre: true,
        email: true,
        activo: true,
        rol: { select: { id: true, nombre: true } },
      },
    });

    res.status(201).json(usuario);
  } catch (error: any) {
    handleError(error, 'crear usuario', res);
  }
});

// PUT /api/configuracion/usuarios/:id
router.put("/usuarios/:id", requirePermiso("CONFIGURACION", "editar"), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);

    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const updateData: any = {};
    if (req.body.nombre !== undefined) updateData.nombre = req.body.nombre;
    if (req.body.email !== undefined) updateData.email = req.body.email;
    if (req.body.rolId !== undefined) updateData.rolId = req.body.rolId;
    if (req.body.activo !== undefined) updateData.activo = req.body.activo;
    if (req.body.password) {
      updateData.passwordHash = await bcrypt.hash(req.body.password, 10);
      updateData.passwordVisible = req.body.password;
    }

    const usuarioActualizado = await prisma.usuario.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nombre: true,
        email: true,
        activo: true,
        rol: { select: { id: true, nombre: true } },
      },
    });

    res.json(usuarioActualizado);
  } catch (error: any) {
    handleError(error, 'actualizar usuario', res);
  }
});

// DELETE /api/configuracion/usuarios/:id (soft delete)
router.delete("/usuarios/:id", requirePermiso("CONFIGURACION", "eliminar"), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (id === req.userId) {
      return res.status(400).json({ error: "No podés desactivarte a vos mismo" });
    }

    await prisma.usuario.update({
      where: { id },
      data: { activo: false },
    });

    res.json({ message: "Usuario desactivado" });
  } catch (error: any) {
    handleError(error, 'desactivar usuario', res);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// MÓDULOS (listado para el frontend)
// ════════════════════════════════════════════════════════════════════════════

// GET /api/configuracion/modulos - lista los módulos disponibles
router.get("/modulos", requirePermiso("CONFIGURACION", "leer"), async (_req: Request, res: Response) => {
  res.json(MODULOS);
});

export default router;
