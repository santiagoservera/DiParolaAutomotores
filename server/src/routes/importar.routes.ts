import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { authMiddleware, requirePermiso } from '../middlewares/auth.middleware.js';
import multer from 'multer';
import XLSX from 'xlsx';

const router = Router();
const prisma = new PrismaClient();

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.match(/\.(xlsx|xls)$/i)) cb(null, true);
    else cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
  },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalizarPeriodoPago(valor: string): string {
  if (!valor) return '1-10';
  const v = valor.toString().trim().toUpperCase().replace(/\s+/g, ' ');
  // Check "10 AL 20" / "10AL 20" / "10-20" first (contains both 10 and 20)
  if (v.includes('10') && v.includes('20')) return '10-20';
  // "20 AL 30" / "20-30" (contains 20 but not 10)
  if (v.includes('20') || v.includes('30')) return '20-30';
  // "1 AL 10" / "1-10"
  return '1-10';
}

function normalizarPuntoVenta(valor: string): string {
  if (!valor) return 'OTRO';
  const v = valor.toString().trim().toUpperCase();
  if (v.includes('ONLINE') || v.includes('ON LINE')) return 'ONLINE';
  if (v.includes('DOMICILIO')) return 'CASA_CLIENTE';
  if (v.includes('SALON') || v.includes('LOCAL')) return 'SALON';
  if (v.includes('STAND')) return 'STAND';
  return 'OTRO';
}

// Meses del año (0-indexed para JS Date)
const MESES_MAP: Record<string, number> = {
  'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3,
  'MAYO': 4, 'JUNIO': 5, 'JULIO': 6, 'AGOSTO': 7,
  'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11,
};

// Meses de las cuotas en la hoja CARGA DE CLIENTES (cols 13-20 = Feb-Sep)
const CUOTA_MESES = [1, 2, 3, 4, 5, 6, 7, 8]; // Feb=1, Mar=2, ..., Sep=8 (JS month index)
const CUOTA_ANIO = 2026;

function calcFechaVenc(periodoPago: string, mes: number, anio: number): Date {
  const dia = periodoPago === '1-10' ? 10 : periodoPago === '10-20' ? 20 : 28;
  const ultimoDia = new Date(anio, mes + 1, 0).getDate();
  return new Date(anio, mes, Math.min(dia, ultimoDia));
}

// ── Interfaces ──────────────────────────────────────────────────────────────

interface CuotaInfo {
  mes: number; // JS month (0-based): 1=Feb, 2=Mar, etc.
  monto: number | null; // null = sin pago
}

interface ClienteImportado {
  puntoVenta: string;
  numeroContrato: string;
  productorAsesor: string;
  solicitanteNombre: string;
  solicitanteDni: string;
  solicitanteDomicilio: string | null;
  solicitanteLocalidad: string | null;
  solicitanteCelular: string | null;
  solicitanteTelFijo: string | null;
  periodoPago: string;
  formaPago: string | null;
  anticipo: number;
  cuotas: CuotaInfo[]; // 8 cuotas (Feb-Sep), con monto o null
  observaciones: string | null;
  comoLlego: string | null;
}

interface CobranzaPago {
  mesIndex: number; // column index in cobranza sheet
  mes: number; // JS month
  monto: number;
}

interface CobranzaImportada {
  nombre: string;
  periodoPago: string;
  pagos: CobranzaPago[];
  notas: string | null;
}

// ── Parsers ─────────────────────────────────────────────────────────────────

function parsearHojaClientes(ws: XLSX.WorkSheet): ClienteImportado[] {
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  const clientes: ClienteImportado[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 6) continue;

    const col0 = String(row[0] || '').trim();
    const col4 = String(row[4] || '').trim();
    const col5 = row[5];

    if (col0.startsWith('VENTAS ') || col0 === 'LUGAR DE VENTA' || col0 === '') continue;
    if (!col4 || !col5) continue;

    const dni = String(col5).trim().replace(/\./g, '');
    if (!dni || !/^\d+$/.test(dni)) continue;

    // Cuotas se toman SOLO de la hoja COBRANZA, no de estas columnas
    const cuotas: CuotaInfo[] = [];
    for (let c = 0; c < 8; c++) {
      cuotas.push({ mes: CUOTA_MESES[c], monto: null });
    }

    // Anticipo = valor de CUOTA 1 (col 13) si existe, sino default
    const col13 = row[13];
    const anticipo = (typeof col13 === 'number' && col13 > 0) ? col13 : 300000;

    clientes.push({
      puntoVenta: normalizarPuntoVenta(col0),
      numeroContrato: String(row[1] || '').trim() || `IMP-${Date.now()}-${i}`,
      productorAsesor: String(row[3] || 'SIN ASIGNAR').trim(),
      solicitanteNombre: col4,
      solicitanteDni: dni,
      solicitanteDomicilio: String(row[6] || '').trim() || null,
      solicitanteLocalidad: String(row[7] || '').trim() || null,
      solicitanteCelular: String(row[8] || '').trim() || null,
      solicitanteTelFijo: String(row[9] || '').trim() || null,
      periodoPago: normalizarPeriodoPago(String(row[10] || '')),
      formaPago: String(row[11] || '').trim() || null,
      anticipo,
      cuotas,
      observaciones: String(row[21] || '').trim() || null,
      comoLlego: normalizarPuntoVenta(col0) === 'OTRO' ? col0 : null,
    });
  }

  return clientes;
}

function parsearHojaCobranza(ws: XLSX.WorkSheet): CobranzaImportada[] {
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  const cobranzas: CobranzaImportada[] = [];

  // Find the month header row and map columns to months
  let mesesCols: { col: number; mes: number }[] = [];
  let anio = CUOTA_ANIO;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const col0 = String(row[0] || '').trim().toUpperCase();
    if (col0.startsWith('COBRANZA')) {
      const match = col0.match(/\d{4}/);
      if (match) anio = parseInt(match[0]);

      // Map columns to months
      for (let c = 2; c < row.length; c++) {
        const mesStr = String(row[c] || '').trim().toUpperCase();
        if (mesStr && MESES_MAP[mesStr] !== undefined) {
          mesesCols.push({ col: c, mes: MESES_MAP[mesStr] });
        }
      }
      continue;
    }

    if (col0 === 'CLIENTE' || col0 === '' || col0.startsWith('TOTAL') ||
        col0.startsWith('INGRESO') || col0.startsWith('COMISION')) continue;

    const periodoPago = normalizarPeriodoPago(String(row[2] || ''));
    const pagos: CobranzaPago[] = [];

    for (const { col, mes } of mesesCols) {
      const val = row[col];
      if (val && typeof val === 'number' && val > 0) {
        pagos.push({ mesIndex: col, mes, monto: val });
      }
    }

    // Notes from last non-numeric column
    let notas: string | null = null;
    for (let c = row.length - 1; c >= 0; c--) {
      const val = row[c];
      if (val && typeof val === 'string' && val.trim().length > 2) {
        notas = val.trim();
        break;
      }
    }

    if (pagos.length > 0 || col0) {
      cobranzas.push({ nombre: col0, periodoPago, pagos, notas });
    }
  }

  return cobranzas;
}

// ── POST /preview ──────────────────────────────────────────────────────────

router.post(
  '/preview',
  authMiddleware,
  requirePermiso('CONFIGURACION', 'leer'),
  uploadExcel.single('archivo'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No se proporcionó un archivo Excel' });

      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      // Tomar las últimas hojas de cada tipo (las más actualizadas)
      const hojasClientes = wb.SheetNames.filter(n => n.toUpperCase().includes('CARGA') || n.toUpperCase().includes('CLIENTE'));
      const hojasCobranza = wb.SheetNames.filter(n => n.toUpperCase().includes('COBRANZA'));
      const hojaClientes = hojasClientes.length > 0 ? hojasClientes[hojasClientes.length - 1] : null;
      const hojaCobranza = hojasCobranza.length > 0 ? hojasCobranza[hojasCobranza.length - 1] : null;

      const clientes = hojaClientes ? parsearHojaClientes(wb.Sheets[hojaClientes]) : [];
      const cobranzas = hojaCobranza ? parsearHojaCobranza(wb.Sheets[hojaCobranza]) : [];

      const dnis = clientes.map(c => c.solicitanteDni);
      const existentes = await prisma.contrato.findMany({
        where: { solicitanteDni: { in: dnis } },
        select: { solicitanteDni: true },
      });
      const dnisExistentes = new Set(existentes.map(e => e.solicitanteDni));

      res.json({
        hojas: wb.SheetNames,
        hojaClientesUsada: hojaClientes || null,
        hojaCobranzaUsada: hojaCobranza || null,
        hojasDisponibles: { clientes: hojasClientes, cobranza: hojasCobranza },
        clientes: clientes.map(c => ({
          ...c,
          yaExiste: dnisExistentes.has(c.solicitanteDni),
        })),
        cobranzas: cobranzas.map(c => ({
          nombre: c.nombre,
          periodoPago: c.periodoPago,
          cantidadPagos: c.pagos.length,
          totalPagado: c.pagos.reduce((sum, p) => sum + p.monto, 0),
          notas: c.notas,
        })),
        resumen: {
          totalClientes: clientes.length,
          nuevos: clientes.length - clientes.filter(c => dnisExistentes.has(c.solicitanteDni)).length,
          existentes: clientes.filter(c => dnisExistentes.has(c.solicitanteDni)).length,
          totalCobranzas: cobranzas.length,
        },
      });
    } catch (error: any) {
      console.error('Error al previsualizar Excel:', error);
      res.status(500).json({ error: 'Error al procesar el archivo', detalle: error.message });
    }
  }
);

// ── POST / - Importar ──────────────────────────────────────────────────────

router.post(
  '/',
  authMiddleware,
  requirePermiso('CONFIGURACION', 'crear'),
  uploadExcel.single('archivo'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No se proporcionó un archivo Excel' });

      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const hojasClientes = wb.SheetNames.filter(n => n.toUpperCase().includes('CARGA') || n.toUpperCase().includes('CLIENTE'));
      const hojasCobranza = wb.SheetNames.filter(n => n.toUpperCase().includes('COBRANZA'));
      const hojaClientes = hojasClientes.length > 0 ? hojasClientes[hojasClientes.length - 1] : null;
      const hojaCobranza = hojasCobranza.length > 0 ? hojasCobranza[hojasCobranza.length - 1] : null;

      if (!hojaClientes && !hojaCobranza) {
        return res.status(400).json({
          error: 'No se encontraron hojas válidas.',
          hojasEncontradas: wb.SheetNames,
        });
      }

      const result = {
        contratosCreados: 0,
        contratosExistentes: 0,
        cuotasCreadas: 0,
        cuotasActualizadas: 0,
        errores: [] as string[],
      };

      const userId = (req as any).userId;
      const clientes = hojaClientes ? parsearHojaClientes(wb.Sheets[hojaClientes]) : [];
      const cobranzas = hojaCobranza ? parsearHojaCobranza(wb.Sheets[hojaCobranza]) : [];

      // Map nombre → cobranza data for matching
      const cobranzaMap = new Map<string, CobranzaImportada>();
      for (const cob of cobranzas) {
        cobranzaMap.set(cob.nombre.toUpperCase().trim(), cob);
      }

      // Map DNI → cobranza: usar la hoja de clientes para vincular nombre↔DNI
      const dniCobranzaMap = new Map<string, CobranzaImportada>();
      for (const cliente of clientes) {
        const nombreKey = cliente.solicitanteNombre.toUpperCase().trim();
        const partes = nombreKey.split(/\s+/).filter(p => p.length > 2);

        // 1. Match exacto
        let cob = cobranzaMap.get(nombreKey);

        // 2. Uno contiene al otro
        if (!cob) {
          for (const [key, c] of cobranzaMap.entries()) {
            if (key.includes(nombreKey) || nombreKey.includes(key)) { cob = c; break; }
          }
        }

        // 3. Al menos 2 palabras coinciden
        if (!cob) {
          let bestScore = 0;
          for (const [key, c] of cobranzaMap.entries()) {
            const partesKey = key.split(/\s+/).filter(p => p.length > 2);
            const score = partes.filter(p => partesKey.includes(p)).length;
            if (score >= 2 && score > bestScore) { bestScore = score; cob = c; }
          }
        }

        if (cob) dniCobranzaMap.set(cliente.solicitanteDni, cob);
      }

      // ── Import clients + cuotas ──────────────────────────────────────────

      for (const cliente of clientes) {
        try {
          // Check if contract already exists (solo por DNI, es único por persona)
          let contrato = await prisma.contrato.findFirst({
            where: { solicitanteDni: cliente.solicitanteDni },
            include: { cuotas: true },
          });

          if (contrato) {
            result.contratosExistentes++;
            continue;
          }

          // Verificar que el número de contrato no esté duplicado
          const contratoConMismoNumero = await prisma.contrato.findFirst({
            where: { numeroContrato: cliente.numeroContrato },
          });
          if (contratoConMismoNumero) {
            cliente.numeroContrato = `${cliente.numeroContrato}-${cliente.solicitanteDni}`;
          }

          // Create new contract
          contrato = await prisma.contrato.create({
            data: {
              numeroContrato: cliente.numeroContrato,
              puntoVenta: cliente.puntoVenta,
              productorAsesor: cliente.productorAsesor,
              tipoVehiculo: 'AUTO',
              marca: 'A definir',
              modelo: '',
              anticipoMensual: new Prisma.Decimal(cliente.anticipo),
              periodoPago: cobranzaMap.get(cliente.solicitanteNombre.toUpperCase().trim())?.periodoPago || cliente.periodoPago,
              cantidadCuotas: 0,
              solicitanteNombre: cliente.solicitanteNombre,
              solicitanteDni: cliente.solicitanteDni,
              solicitanteDomicilio: cliente.solicitanteDomicilio,
              solicitanteLocalidad: cliente.solicitanteLocalidad,
              solicitanteCelular: cliente.solicitanteCelular,
              solicitanteTelFijo: cliente.solicitanteTelFijo,
              comoLlego: cliente.comoLlego,
              observaciones: [
                cliente.observaciones,
                cliente.formaPago ? `Forma de pago: ${cliente.formaPago}` : null,
              ].filter(Boolean).join(' | ') || null,
              registradoPorId: userId,
            },
            include: { cuotas: true },
          });

          result.contratosCreados++;

          // Create cuotas
          await crearCuotasParaContrato(contrato.id, [], cliente, dniCobranzaMap, userId, result);

        } catch (error: any) {
          if (error.code === 'P2002') {
            result.contratosExistentes++;
          } else {
            result.errores.push(`Error "${cliente.solicitanteNombre}": ${error.message}`);
          }
        }
      }

      res.json({
        message: 'Importación completada',
        resultados: result,
        resumen: {
          hojasProcessadas: [hojaClientes, hojaCobranza].filter(Boolean),
          clientesEncontrados: clientes.length,
          cobranzasEncontradas: cobranzas.length,
        },
      });
    } catch (error: any) {
      console.error('Error al importar Excel:', error);
      res.status(500).json({ error: 'Error al procesar el archivo', detalle: error.message });
    }
  }
);

// ── Create cuotas for a contract ────────────────────────────────────────────

async function crearCuotasParaContrato(
  contratoId: number,
  cuotasExistentes: any[],
  cliente: ClienteImportado,
  cobranzaMap: Map<string, CobranzaImportada>,
  userId: number,
  result: { cuotasCreadas: number; cuotasActualizadas: number; errores: string[] }
) {
  // Find matching cobranza data by DNI (pre-mapped)
  const cobranza = cobranzaMap.get(cliente.solicitanteDni);

  // Build cobranza payment map (month → amount) - ONLY actual payments
  const cobranzaPagos = new Map<number, number>();
  if (cobranza) {
    for (const pago of cobranza.pagos) {
      cobranzaPagos.set(pago.mes, pago.monto);
    }
  }

  // Get the next cuota number (after any existing cuotas)
  const maxExistingNum = cuotasExistentes.length > 0
    ? Math.max(...cuotasExistentes.map((c: any) => c.numeroCuota))
    : 0;

  // SOLO crear cuotas desde la hoja de COBRANZA (pagos reales)
  console.log(`[IMPORT] ${cliente.solicitanteNombre} → cobranza: ${cobranza ? 'SÍ' : 'NO'}, pagos: ${JSON.stringify(Object.fromEntries(cobranzaPagos))}`);
  let cuotaNum = maxExistingNum;
  for (let mesIdx = 0; mesIdx < 8; mesIdx++) {
    const mes = CUOTA_MESES[mesIdx];

    const montoCobranza = cobranzaPagos.get(mes);

    // Solo crear si hay un pago real en la cobranza
    if (montoCobranza === undefined) continue;

    cuotaNum++;
    const monto = montoCobranza;
    // Periodo de la hoja COBRANZA tiene prioridad
    const periodoReal = cobranza?.periodoPago || cliente.periodoPago;
    const fechaVenc = calcFechaVenc(periodoReal, mes, CUOTA_ANIO);

    await prisma.cuota.create({
      data: {
        contratoId,
        numeroCuota: cuotaNum,
        monto: new Prisma.Decimal(monto),
        fechaVencimiento: fechaVenc,
        estado: 'PAGADA',
        formaPago: 'TRANSFERENCIA',
        fechaPago: fechaVenc,
        registradoPorId: userId,
        observaciones: cobranza?.notas || null,
      },
    });
    result.cuotasCreadas++;
  }

  // Update cantidadCuotas on contract
  const totalCuotas = await prisma.cuota.count({ where: { contratoId } });
  await prisma.contrato.update({
    where: { id: contratoId },
    data: { cantidadCuotas: totalCuotas },
  });
}

export default router;
