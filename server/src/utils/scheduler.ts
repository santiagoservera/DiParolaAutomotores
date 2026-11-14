import cron from 'node-cron';
import { PrismaClient, Prisma } from '@prisma/client';
import { TZ_AR, partesFechaAR, fechaCalendarioAR, limiteVencimiento } from './fechas.js';

const prisma = new PrismaClient();

/**
 * Genera la cuota del mes actual (AR) para cada contrato ACTIVO que todavía no tenga una.
 * Idempotente: si el contrato ya tiene una cuota con vencimiento en el mes, no hace nada.
 * Cada contrato se procesa en una transacción con lock de fila (SELECT ... FOR UPDATE)
 * para que dos procesos corriendo a la vez no generen cuotas duplicadas.
 */
export async function generarCuotasDelMes() {
  console.log('[Scheduler] Generación automática de cuotas iniciada');
  const { anio, mes } = partesFechaAR();

  // Rango del mes en días UTC: contiene vencimientos legacy (00:00Z) y nuevos (12:00 AR = 15:00Z)
  const inicioMes = new Date(Date.UTC(anio, mes, 1));
  const inicioMesSiguiente = new Date(Date.UTC(anio, mes + 1, 1));

  const contratos = await prisma.contrato.findMany({
    where: { estado: 'ACTIVO' },
    select: { id: true },
  });

  let cuotasCreadas = 0;

  for (const { id } of contratos) {
    try {
      const creada = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM contratos WHERE id = ${id} FOR UPDATE`;

        const contrato = await tx.contrato.findUnique({
          where: { id },
          include: { cuotas: { orderBy: { numeroCuota: 'asc' } } },
        });
        if (!contrato || contrato.estado !== 'ACTIVO') return false;

        const cuota2 = contrato.cuotas.find(c => c.numeroCuota === 2);
        const montoBase = cuota2 ? Number(cuota2.monto) : Number(contrato.anticipoMensual);
        if (!(montoBase > 0)) return false;

        const yaExiste = contrato.cuotas.some(c => {
          const fv = new Date(c.fechaVencimiento);
          return fv >= inicioMes && fv < inicioMesSiguiente;
        });
        if (yaExiste) return false;

        const maxCuota = contrato.cuotas.length > 0
          ? Math.max(...contrato.cuotas.map(c => c.numeroCuota))
          : 0;

        const dia = contrato.periodoPago === '1-10' ? 10 : contrato.periodoPago === '10-20' ? 20 : 28;
        const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
        const fechaVenc = fechaCalendarioAR(anio, mes, Math.min(dia, ultimoDia));

        await tx.cuota.create({
          data: {
            contratoId: contrato.id,
            numeroCuota: maxCuota + 1,
            monto: new Prisma.Decimal(montoBase),
            fechaVencimiento: fechaVenc,
            estado: 'PENDIENTE',
          },
        });

        await tx.contrato.update({
          where: { id: contrato.id },
          data: { cantidadCuotas: maxCuota + 1 },
        });
        return true;
      });
      if (creada) cuotasCreadas++;
    } catch (err: any) {
      console.error(`[Scheduler] Error contrato ${id}: ${err.message}`);
    }
  }

  console.log(`[Scheduler] Generación completada: ${cuotasCreadas} cuotas en ${cuotasCreadas} contratos`);
}

/**
 * Marca cuotas PENDIENTE vencidas como VENCIDA y pasa a DE_BAJA los contratos ACTIVO
 * con 4 o más cuotas vencidas. (Antes se hacía en cada GET /cobranzas.)
 */
export async function procesarVencimientosYBajas() {
  const marcadas = await prisma.cuota.updateMany({
    where: { estado: 'PENDIENTE', fechaVencimiento: { lt: limiteVencimiento() } },
    data: { estado: 'VENCIDA' },
  });

  const contratosParaBaja = await prisma.contrato.findMany({
    where: { estado: 'ACTIVO' },
    select: { id: true, _count: { select: { cuotas: { where: { estado: 'VENCIDA' } } } } },
  });
  const idsParaBaja = contratosParaBaja.filter(c => c._count.cuotas >= 4).map(c => c.id);
  if (idsParaBaja.length > 0) {
    await prisma.contrato.updateMany({
      where: { id: { in: idsParaBaja }, estado: 'ACTIVO' },
      data: { estado: 'DE_BAJA' },
    });
  }

  console.log(`[Scheduler] Vencimientos: ${marcadas.count} cuotas marcadas VENCIDA, ${idsParaBaja.length} contratos pasados a DE_BAJA`);
}

export function initScheduler() {
  // 1ro de cada mes a las 00:05 (hora Argentina)
  cron.schedule('5 0 1 * *', async () => {
    try {
      await generarCuotasDelMes();
    } catch (error: any) {
      console.error('[Scheduler] Error en generación automática:', error.message);
    }
  }, { timezone: TZ_AR });

  // Todos los días a las 00:15 (hora Argentina): vencimientos + auto-baja
  cron.schedule('15 0 * * *', async () => {
    try {
      await procesarVencimientosYBajas();
    } catch (error: any) {
      console.error('[Scheduler] Error procesando vencimientos/bajas:', error.message);
    }
  }, { timezone: TZ_AR });

  console.log('[Scheduler] Crons configurados: cuotas (1ro de cada mes 00:05 AR) y vencimientos/bajas (diario 00:15 AR)');

  // Al iniciar el server: ponerse al día (ambos procesos son idempotentes).
  // La generación solo se recupera en los primeros 5 días del mes (cron del 1ro perdido por caída);
  // más tarde crearía cuotas del mes en curso a contratos que el cron del 1ro no hubiera alcanzado.
  setTimeout(async () => {
    if (partesFechaAR().dia <= 5) {
      try {
        await generarCuotasDelMes();
      } catch (error: any) {
        console.error('[Scheduler] Error en generación al iniciar:', error.message);
      }
    }
    try {
      await procesarVencimientosYBajas();
    } catch (error: any) {
      console.error('[Scheduler] Error procesando vencimientos/bajas al iniciar:', error.message);
    }
  }, 5000);
}
