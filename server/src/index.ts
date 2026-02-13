import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Routes
import authRoutes from "./routes/auth.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";
import clientesRoutes from "./routes/clientes.routes.js";
import vehiculosRoutes from "./routes/vehiculos.routes.js";
import metodosPagoRoutes from "./routes/metodosPago.routes.js";
import planesRoutes from "./routes/planes.routes.js";
import operacionesRoutes from "./routes/operaciones.routes.js";
import cuentasAhorroRoutes from "./routes/cuentasAhorro.routes.js";
import pagosRoutes from "./routes/pagos.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

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
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/vehiculos", vehiculosRoutes);
app.use("/api/metodos-pago", metodosPagoRoutes);
app.use("/api/planes", planesRoutes);
app.use("/api/operaciones", operacionesRoutes);
app.use("/api/cuentas-ahorro", cuentasAhorroRoutes);
app.use("/api/pagos", pagosRoutes);
app.use("/api/dashboard", dashboardRoutes);

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
    console.log("✅ Conectado a SQL Server");

    app.listen(PORT, () => {
      console.log(`🚀 Server: http://localhost:${PORT}`);
      console.log(`📋 Health: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("❌ Error de conexión:", error);
    process.exit(1);
  }
}

main();

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
