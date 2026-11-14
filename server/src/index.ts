import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Routes
import authRoutes from "./routes/auth.routes.js";
import contratosRoutes from "./routes/contratos.routes.js";
import cobranzasRoutes from "./routes/cobranzas.routes.js";
import recepcionRoutes from "./routes/recepcion.routes.js";
import configuracionRoutes from "./routes/configuracion.routes.js";
import importarRoutes from "./routes/importar.routes.js";
import metricasRoutes from "./routes/metricas.routes.js";
import { initScheduler } from "./utils/scheduler.js";
import { migrarPasswordsVisibles } from "./utils/passwordCrypto.js";
import multer from "multer";
import { FormatoNoPermitidoError, ExcelFormatoError, MENSAJE_FORMATO_NO_PERMITIDO } from "./middlewares/upload.middleware.js";

dotenv.config();

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3001;

// Detrás de Nginx: req.ip toma la IP real del cliente (X-Forwarded-For)
app.set("trust proxy", 1);

// Middlewares
app.use(cors({
  origin: (process.env.FRONTEND_URL || "http://localhost:5173").split(",").map(s => s.trim()),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/contratos", contratosRoutes);
app.use("/api/cobranzas", cobranzasRoutes);
app.use("/api/recepcion", recepcionRoutes);
app.use("/api/configuracion", configuracionRoutes);
app.use("/api/importar", importarRoutes);
app.use("/api/metricas", metricasRoutes);

// Errores de upload (multer / Cloudinary / fileFilter) → 400 con mensaje claro
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "El archivo supera los 10MB" });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ error: `Campo de archivo inesperado: ${err.field || ""}`.trim() });
    }
    return res.status(400).json({ error: `Error al subir el archivo: ${err.message}` });
  }
  if (err instanceof FormatoNoPermitidoError) {
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof ExcelFormatoError) {
    return res.status(400).json({ error: err.message });
  }
  // Cloudinary rechaza formatos fuera de allowed_formats con http_code 400 ("... format ... not allowed")
  const msg = String(err?.message || "");
  if ((err?.http_code === 400 && /format/i.test(msg)) || /file format .* not allowed/i.test(msg)) {
    return res.status(400).json({ error: MENSAJE_FORMATO_NO_PERMITIDO });
  }
  if (err?.http_code) {
    console.error("Error de Cloudinary:", err);
    return res.status(502).json({ error: "Error al procesar el archivo en el servidor de imágenes. Intentá de nuevo." });
  }
  // JSON mal formado en el body
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo de la solicitud no es un JSON válido" });
  }
  next(err);
});

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Error interno del servidor",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

async function main() {
  try {
    await prisma.$connect();
    console.log("Conectado a PostgreSQL");

    // Cifrar contraseñas visibles legacy en texto plano (idempotente; no bloquea el arranque)
    migrarPasswordsVisibles(prisma).catch(err => console.error("[passwordCrypto] Error en migración:", err?.message || err));

    initScheduler();

    app.listen(PORT, () => {
      console.log(`Server: http://localhost:${PORT}`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("Error de conexion:", error);
    process.exit(1);
  }
}

main();

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
