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
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET no configurado");
    return res.status(500).json({ error: "Error de configuración del servidor" });
  }

  const token = authHeader.split(" ")[1];
  let decoded: JWTPayload;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET) as JWTPayload;
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }

  try {
    // Estado y rol se leen siempre de la DB (no del JWT): un usuario desactivado o
    // con rol cambiado pierde/actualiza el acceso de inmediato.
    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.userId },
      select: { id: true, activo: true, rolId: true },
    });
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: "Usuario inactivo o inexistente" });
    }

    req.userId = usuario.id;
    req.userRolId = usuario.rolId;

    // Load ALL permisos for the role
    const permisos = await prisma.permiso.findMany({
      where: { rolId: usuario.rolId },
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
  } catch (error) {
    // Error transitorio de DB: NO devolver 401 para no desloguear al usuario
    console.error("Error verificando usuario en authMiddleware:", error);
    return res.status(503).json({ error: "Servicio momentáneamente no disponible. Intentá de nuevo en unos segundos." });
  }

  next();
};

// ── Helpers para verificar visibilidad y propiedad ──────────────────────────

export function esAdmin(req: AuthRequest): boolean {
  return req.userRolNombre === 'Administrador';
}

export function puedeVerTodos(req: AuthRequest, modulo: string): boolean {
  if (esAdmin(req)) return true;
  const perm = req.userPermisos?.find(p => p.modulo === modulo);
  return perm?.verTodos ?? false;
}

export function esPropietario(req: AuthRequest, registradoPorId: number): boolean {
  return req.userId === registradoPorId;
}

/**
 * Verifica acceso a un registro puntual según su dueño.
 * - Admin: siempre.
 * - 'leer' con verTodos en el módulo: sí.
 * - Si no, solo el dueño (ownerId === userId).
 */
export function puedeAcceder(
  req: AuthRequest,
  modulo: string,
  ownerId: number | null | undefined,
  accion: 'leer' | 'escribir',
): boolean {
  if (esAdmin(req)) return true;
  if (accion === 'leer' && puedeVerTodos(req, modulo)) return true;
  return ownerId != null && ownerId === req.userId;
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
