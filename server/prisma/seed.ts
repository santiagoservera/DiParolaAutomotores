import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const MODULOS = ["VENTAS", "COBRANZAS", "RECEPCION", "CONFIGURACION"] as const;

async function main() {
  console.log("Iniciando seed...");

  // ── Rol Administrador (acceso total) ────────────────────────────────────

  const rolAdmin = await prisma.rol.upsert({
    where: { nombre: "Administrador" },
    update: {},
    create: {
      nombre: "Administrador",
      descripcion: "Acceso completo a todos los modulos",
    },
  });

  // Permisos completos para admin
  for (const modulo of MODULOS) {
    await prisma.permiso.upsert({
      where: { rolId_modulo: { rolId: rolAdmin.id, modulo } },
      update: { leer: true, crear: true, editar: true, eliminar: true },
      create: {
        rolId: rolAdmin.id,
        modulo,
        leer: true,
        crear: true,
        editar: true,
        eliminar: true,
      },
    });
  }
  console.log("Rol Administrador creado con permisos completos");

  // ── Rol Vendedor (ventas + recepcion, sin configuracion) ────────────────

  const rolVendedor = await prisma.rol.upsert({
    where: { nombre: "Vendedor" },
    update: {},
    create: {
      nombre: "Vendedor",
      descripcion: "Acceso a ventas, cobranzas y recepcion",
    },
  });

  const permisosVendedor: Record<string, { leer: boolean; crear: boolean; editar: boolean; eliminar: boolean }> = {
    VENTAS: { leer: true, crear: true, editar: true, eliminar: false },
    COBRANZAS: { leer: true, crear: false, editar: true, eliminar: false },
    RECEPCION: { leer: true, crear: true, editar: true, eliminar: false },
    CONFIGURACION: { leer: false, crear: false, editar: false, eliminar: false },
  };

  for (const modulo of MODULOS) {
    const p = permisosVendedor[modulo];
    await prisma.permiso.upsert({
      where: { rolId_modulo: { rolId: rolVendedor.id, modulo } },
      update: p,
      create: { rolId: rolVendedor.id, modulo, ...p },
    });
  }
  console.log("Rol Vendedor creado con permisos limitados");

  // ── Usuarios Administradores ────────────────────────────────────────────

  const adminPassword = await bcrypt.hash("diparolagestion2026", 10);

  await prisma.usuario.upsert({
    where: { email: "carlos@diparola.com" },
    update: {},
    create: {
      nombre: "Carlos Diparola",
      email: "carlos@diparola.com",
      passwordHash: adminPassword,
      rolId: rolAdmin.id,
    },
  });
  console.log("Usuario admin creado: carlos@diparola.com");

  await prisma.usuario.upsert({
    where: { email: "matias@diparola.com" },
    update: {},
    create: {
      nombre: "Matias Contrera",
      email: "matias@diparola.com",
      passwordHash: adminPassword,
      rolId: rolAdmin.id,
    },
  });
  console.log("Usuario admin creado: matias@diparola.com");

  // ── Vendedor de prueba ──────────────────────────────────────────────────

  const vendedorPassword = await bcrypt.hash("vendedor123", 10);
  const vendedor = await prisma.usuario.upsert({
    where: { email: "vendedor@diparola.com" },
    update: {},
    create: {
      nombre: "Juan Vendedor",
      email: "vendedor@diparola.com",
      passwordHash: vendedorPassword,
      rolId: rolVendedor.id,
    },
  });
  console.log("Usuario vendedor creado: vendedor@diparola.com");

  // ── Contrato de ejemplo ─────────────────────────────────────────────────

  const contratoExistente = await prisma.contrato.findUnique({
    where: { numeroContrato: "00000001" },
  });

  if (!contratoExistente) {
    const contrato = await prisma.contrato.create({
      data: {
        numeroContrato: "00000001",
        puntoVenta: "SALON",
        productorAsesor: "Carlos Perez",
        tipoVehiculo: "AUTO",
        marca: "Toyota",
        modelo: "Corolla 2.0 SEG",
        anticipoMensual: new Prisma.Decimal(250000),
        periodoPago: "1-10",
        cantidadCuotas: 12,
        solicitanteNombre: "Ricardo Gomez",
        solicitanteDni: "30123456",
        solicitanteFechaNac: new Date("1985-03-15"),
        solicitanteEstadoCivil: "Casado",
        solicitanteDomicilio: "Av. San Martin 1234",
        solicitanteBarrio: "Centro",
        solicitanteLocalidad: "San Juan",
        solicitanteCp: "5400",
        solicitanteProvincia: "San Juan",
        solicitanteCelular: "2644551234",
        solicitanteOcupacion: "Comerciante",
        solicitanteEmail: "ricardo@email.com",
        conyugeNombre: "Maria Lopez",
        conyugeDni: "31456789",
        conyugeTelefono: "2644555678",
        tieneVehiculoUsado: true,
        usadoMarca: "Fiat",
        usadoModelo: "Cronos",
        usadoAnio: 2019,
        usadoColor: "Gris",
        usadoCombustible: "Nafta",
        comoLlego: "Recomendacion",
        registradoPorId: vendedor.id,
      },
    });

    const cuotasData = [];
    const fechaBase = new Date();
    for (let i = 1; i <= 12; i++) {
      const fecha = new Date(fechaBase);
      fecha.setMonth(fecha.getMonth() + i);
      const ultimoDia = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
      fecha.setDate(Math.min(10, ultimoDia));

      cuotasData.push({
        contratoId: contrato.id,
        numeroCuota: i,
        monto: new Prisma.Decimal(250000),
        fechaVencimiento: fecha,
      });
    }

    await prisma.cuota.createMany({ data: cuotasData });
    console.log("Contrato de ejemplo creado con 12 cuotas");
  }

  // ── Recepciones de ejemplo ──────────────────────────────────────────────

  const recepcionCount = await prisma.recepcion.count();
  if (recepcionCount === 0) {
    await prisma.recepcion.createMany({
      data: [
        {
          nombre: "Laura Martinez",
          telefono: "2644667788",
          email: "laura@email.com",
          medio: "PRESENCIAL",
          motivo: "Consulta por Toyota Corolla",
          estado: "PENDIENTE",
          registradoPorId: vendedor.id,
        },
        {
          nombre: "Pedro Sanchez",
          telefono: "2644998877",
          medio: "TELEFONO",
          motivo: "Consulta financiacion camioneta",
          estado: "CITA_AGENDADA",
          fechaCita: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          notasCita: "Viene a ver Ranger el jueves a las 10hs",
          registradoPorId: vendedor.id,
        },
        {
          nombre: "Ana Rodriguez",
          telefono: "2644112233",
          email: "ana.r@email.com",
          medio: "WHATSAPP",
          motivo: "Interesada en plan de ahorro",
          estado: "CONTACTADO",
          registradoPorId: vendedor.id,
        },
      ],
    });
    console.log("Recepciones de ejemplo creadas");
  }

  console.log("\nSeed completado!");
  console.log("\nCredenciales de acceso:");
  console.log("  Admin: carlos@diparola.com / diparolagestion2026");
  console.log("  Admin: matias@diparola.com / diparolagestion2026");
  console.log("  Vendedor: vendedor@diparola.com / vendedor123");
}

main()
  .catch((e) => {
    console.error("Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
