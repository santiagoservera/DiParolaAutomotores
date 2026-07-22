import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  userId?: number;
  userRolId?: number;
  userRolNombre?: string;
  userPermisos?: { modulo: string; leer: boolean; crear: boolean; editar: boolean; eliminar: boolean; verTodos: boolean }[];
}

interface JWTPayload {
  userId: number;
  email: string;
  rolId: number;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token no proporcionado" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as JWTPayload;

    req.userId = decoded.userId;
    req.userRolId = decoded.rolId;

    // Load ALL permisos for the role
    const permisos = await prisma.permiso.findMany({
      where: { rolId: decoded.rolId },
    });
    req.userPermisos = permisos.map(p => ({
      modulo: p.modulo,
      leer: p.leer,
      crear: p.crear,
      editar: p.editar,
      eliminar: p.eliminar,
      verTodos: p.verTodos,
    }));

    // Check if user is admin (has CONFIGURACION.leer permission)
    const configPermiso = permisos.find(p => p.modulo === 'CONFIGURACION');
    req.userRolNombre = configPermiso?.leer ? 'Administrador' : 'Vendedor';

    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
};

// ── Helpers para verificar visibilidad y propiedad ──────────────────────────

export function puedeVerTodos(req: AuthRequest, modulo: string): boolean {
  if (req.userRolNombre === 'Administrador') return true;
  const perm = req.userPermisos?.find(p => p.modulo === modulo);
  return perm?.verTodos ?? false;
}

export function esPropietario(req: AuthRequest, registradoPorId: number): boolean {
  return req.userId === registradoPorId;
}

// Módulos disponibles
export type Modulo = "VENTAS" | "COBRANZAS" | "RECEPCION" | "CONFIGURACION";
export type Accion = "leer" | "crear" | "editar" | "eliminar";

/**
 * Middleware que verifica si el usuario tiene el permiso requerido en el módulo.
 * Uso: requirePermiso("VENTAS", "crear")
 */
export const requirePermiso = (modulo: Modulo, accion: Accion) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userRolId) {
        return res.status(401).json({ error: "No autenticado" });
      }

      const permiso = await prisma.permiso.findUnique({
        where: {
          rolId_modulo: {
            rolId: req.userRolId,
            modulo,
          },
        },
      });

      if (!permiso || !permiso[accion]) {
        return res.status(403).json({
          error: `Sin permiso para ${accion} en ${modulo}`,
        });
      }

      next();
    } catch (error) {
      console.error("Error verificando permisos:", error);
      return res.status(500).json({ error: "Error al verificar permisos" });
    }
  };
};
