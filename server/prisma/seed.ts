import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed...");

  // Crear usuario admin
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.usuario.upsert({
    where: { email: "admin@diparola.com" },
    update: {},
    create: {
      nombre: "Administrador",
      email: "admin@diparola.com",
      passwordHash: adminPassword,
      rol: "ADMIN",
    },
  });
  console.log("✅ Usuario admin creado:", admin.email);

  // Crear vendedor de prueba
  const vendedorPassword = await bcrypt.hash("vendedor123", 10);
  const vendedor = await prisma.usuario.upsert({
    where: { email: "vendedor@diparola.com" },
    update: {},
    create: {
      nombre: "Juan Vendedor",
      email: "vendedor@diparola.com",
      passwordHash: vendedorPassword,
      rol: "VENDEDOR",
    },
  });
  console.log("✅ Usuario vendedor creado:", vendedor.email);

  // Crear métodos de pago
  const metodosData = [
    { nombre: "Contado" },
    { nombre: "Financiación Propia" },
    { nombre: "Crédito Bancario" },
    { nombre: "Plan de Ahorro" },
  ];

  for (const metodo of metodosData) {
    await prisma.metodoPago.upsert({
      where: { id: metodosData.indexOf(metodo) + 1 },
      update: {},
      create: metodo,
    });
  }
  console.log("✅ Métodos de pago creados");

  // Obtener método "Financiación Propia" para crear planes
  const financiacion = await prisma.metodoPago.findFirst({
    where: { nombre: "Financiación Propia" },
  });

  if (financiacion) {
    // Crear planes de financiación
    const planesData = [
      { metodoPagoId: financiacion.id, cantidadCuotas: 6, porcentajeInteres: 15 },
      { metodoPagoId: financiacion.id, cantidadCuotas: 12, porcentajeInteres: 25 },
      { metodoPagoId: financiacion.id, cantidadCuotas: 18, porcentajeInteres: 35 },
      { metodoPagoId: financiacion.id, cantidadCuotas: 24, porcentajeInteres: 45 },
      { metodoPagoId: financiacion.id, cantidadCuotas: 36, porcentajeInteres: 60 },
    ];

    for (const plan of planesData) {
      await prisma.planFinanciacion.create({ data: plan });
    }
    console.log("✅ Planes de financiación creados");
  }

  // Crear vehículos de ejemplo
  const vehiculosData = [
    {
      marca: "Toyota",
      modelo: "Corolla 2.0 SEG",
      anio: 2023,
      tipo: "SEDAN" as const,
      descripcion: "Full equipo, único dueño, service oficial al día",
      precioBase: 28500000,
    },
    {
      marca: "Volkswagen",
      modelo: "Taos Highline",
      anio: 2022,
      tipo: "SUV" as const,
      descripcion: "Techo panorámico, asientos de cuero, navegador",
      precioBase: 31200000,
    },
    {
      marca: "Ford",
      modelo: "Ranger Limited 3.2",
      anio: 2021,
      tipo: "PICKUP" as const,
      descripcion: "4x4, automática, caja de 6ta",
      precioBase: 35000000,
    },
    {
      marca: "Honda",
      modelo: "Civic EXL",
      anio: 2020,
      tipo: "SEDAN" as const,
      descripcion: "Motor 2.0, automático, 38.000 km",
      precioBase: 24900000,
    },
    {
      marca: "Fiat",
      modelo: "Cronos Precision",
      anio: 2023,
      tipo: "SEDAN" as const,
      descripcion: "Pack premium, GNC 5ta generación",
      precioBase: 18500000,
    },
    {
      marca: "Chevrolet",
      modelo: "Tracker Premier",
      anio: 2022,
      tipo: "SUV" as const,
      descripcion: "Turbo, techo solar, 25.000 km",
      precioBase: 27800000,
    },
  ];

  for (const vehiculo of vehiculosData) {
    await prisma.vehiculo.create({ data: vehiculo });
  }
  console.log("✅ Vehículos de ejemplo creados");

  // Crear clientes de ejemplo
  const clientesData = [
    { nombre: "Ricardo", apellido: "Gómez", dni: "30123456", telefono: "1155551234", email: "ricardo@email.com" },
    { nombre: "María Luz", apellido: "Sosa", dni: "28987654", telefono: "1155555678", email: "maria@email.com" },
    { nombre: "Juan Pablo", apellido: "Martínez", dni: "35456789", telefono: "1155559012", email: "juanp@email.com" },
  ];

  for (const cliente of clientesData) {
    await prisma.cliente.create({ data: cliente });
  }
  console.log("✅ Clientes de ejemplo creados");

  console.log("\n🎉 Seed completado!");
  console.log("\n📋 Credenciales de acceso:");
  console.log("   Admin: admin@diparola.com / admin123");
  console.log("   Vendedor: vendedor@diparola.com / vendedor123");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
