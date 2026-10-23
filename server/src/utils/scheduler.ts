import cron from 'node-cron';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export function initScheduler() {
  // 1ro de cada mes a las 00:05 (5 min de margen)
  cron.schedule('5 0 1 * *', async () => {
    console.log('[Scheduler] Generación automática de cuotas iniciada');
    try {
      const now = new Date();
      const mes = now.getMonth();
      const anio = now.getFullYear();

      const contratos = await prisma.contrato.findMany({
        where: { estado: 'ACTIVO' },
        include: { cuotas: { orderBy: { numeroCuota: 'asc' } } },
      });

      let cuotasCreadas = 0;
      let contratosAfectados = 0;

      for (const contrato of contratos) {
        try {
          const cuota2 = contrato.cuotas.find(c => c.numeroCuota === 2);
          const cuota1 = contrato.cuotas.find(c => c.numeroCuota === 1);
          const montoBase = cuota2 ? Number(cuota2.monto) : cuota1 ? Number(cuota1.monto) : Number(contrato.anticipoMensual);

          if (montoBase <= 0) continue;

          // Verificar si ya existe cuota para este mes
          const inicioMes = new Date(anio, mes, 1);
          const finMes = new Date(anio, mes + 1, 0, 23, 59, 59);
          const yaExiste = contrato.cuotas.some(c => {
            const fv = new Date(c.fechaVencimiento);
            return fv >= inicioMes && fv <= finMes;
          });
          if (yaExiste) continue;

          const maxCuota = contrato.cuotas.length > 0
            ? Math.max(...contrato.cuotas.map(c => c.numeroCuota))
            : 0;

          const dia = contrato.periodoPago === '1-10' ? 10 : contrato.periodoPago === '10-20' ? 20 : 28;
          const ultimoDia = new Date(anio, mes + 1, 0).getDate();
          const fechaVenc = new Date(anio, mes, Math.min(dia, ultimoDia));

          await prisma.cuota.create({
            data: {
              contratoId: contrato.id,
              numeroCuota: maxCuota + 1,
              monto: new Prisma.Decimal(montoBase),
              fechaVencimiento: fechaVenc,
              estado: 'PENDIENTE',
            },
          });

          await prisma.contrato.update({
            where: { id: contrato.id },
            data: { cantidadCuotas: maxCuota + 1 },
          });

          cuotasCreadas++;
          contratosAfectados++;
        } catch (err: any) {
          console.error(`[Scheduler] Error contrato ${contrato.id}: ${err.message}`);
        }
      }

      console.log(`[Scheduler] Generación completada: ${cuotasCreadas} cuotas en ${contratosAfectados} contratos`);
    } catch (error: any) {
      console.error('[Scheduler] Error en generación automática:', error.message);
    }
  });

  console.log('[Scheduler] Cron de generación de cuotas configurado (1ro de cada mes 00:05)');
}
