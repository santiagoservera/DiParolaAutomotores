import { Router, Request, Response } from "express";
import { prisma } from "../index.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

// GET /api/dashboard/stats
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [
      vehiculosDisponibles,
      vehiculosReservados,
      vehiculosVendidosMes,
      clientesTotal,
      operacionesSimulacion,
      operacionesReserva,
      ventasMes,
      cuentasAhorroActivas,
    ] = await Promise.all([
      prisma.vehiculo.count({ where: { estado: "DISPONIBLE", activo: true } }),
      prisma.vehiculo.count({ where: { estado: "RESERVADO", activo: true } }),
      prisma.operacion.count({
        where: {
          estado: "VENDIDO",
          fechaConfirmacion: { gte: new Date(new Date().setDate(1)) },
        },
      }),
      prisma.cliente.count({ where: { activo: true } }),
      prisma.operacion.count({ where: { estado: "SIMULACION" } }),
      prisma.operacion.count({ where: { estado: "RESERVA" } }),
      prisma.operacion.aggregate({
        where: {
          estado: "VENDIDO",
          fechaConfirmacion: { gte: new Date(new Date().setDate(1)) },
        },
        _sum: { precioBase: true },
      }),
      prisma.cuentaAhorro.count({ where: { estado: "ACTIVA" } }),
    ]);

    res.json({
      vehiculos: {
        disponibles: vehiculosDisponibles,
        reservados: vehiculosReservados,
        vendidosMes: vehiculosVendidosMes,
      },
      clientes: {
        total: clientesTotal,
      },
      operaciones: {
        simulaciones: operacionesSimulacion,
        reservas: operacionesReserva,
        ventasMes: vehiculosVendidosMes,
        montoVentasMes: ventasMes._sum.precioBase || 0,
      },
      cuentasAhorro: {
        activas: cuentasAhorroActivas,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

// GET /api/dashboard/ultimas-operaciones
router.get("/ultimas-operaciones", async (_req: Request, res: Response) => {
  try {
    const operaciones = await prisma.operacion.findMany({
      take: 10,
      orderBy: { fechaCreacion: "desc" },
      include: {
        cliente: { select: { nombre: true, apellido: true } },
        vehiculo: { select: { marca: true, modelo: true, anio: true } },
        registradoPor: { select: { nombre: true } },
      },
    });

    res.json(operaciones);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener últimas operaciones" });
  }
});

// GET /api/dashboard/ultimos-pagos
router.get("/ultimos-pagos", async (_req: Request, res: Response) => {
  try {
    const pagos = await prisma.pago.findMany({
      take: 10,
      orderBy: { fechaPago: "desc" },
      include: {
        metodoPago: true,
        operacion: {
          include: {
            cliente: { select: { nombre: true, apellido: true } },
          },
        },
        cuentaAhorro: {
          include: {
            cliente: { select: { nombre: true, apellido: true } },
          },
        },
      },
    });

    res.json(pagos);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener últimos pagos" });
  }
});

export default router;
