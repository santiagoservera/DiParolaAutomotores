import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: number;
  userRol?: string;
}

interface JWTPayload {
  userId: number;
  email: string;
  rol: string;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token no proporcionado" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as JWTPayload;

    req.userId = decoded.userId;
    req.userRol = decoded.rol;

    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
};

export const requireRol = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRol || !roles.includes(req.userRol)) {
      return res.status(403).json({ error: "Sin permisos para esta acción" });
    }
    next();
  };
};
