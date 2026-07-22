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

dotenv.config();

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
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
    console.log("Conectado a SQL Server");

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
