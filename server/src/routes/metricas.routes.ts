import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, requirePermiso, esAdmin, AuthRequest } from '../middlewares/auth.middleware.js';
import { handleError } from '../utils/errorHandler.js';
import { partesFechaAR, inicioDiaAR, finDiaAR, limiteVencimiento } from '../utils/fechas.js';
import { parseId } from '../utils/paginacion.js';

const router = Router();
const prisma = new PrismaClient();

// ── Tipos ───────────────────────────────────────────────────────────────────

export type TipoPeriodo = 'mes' | 'mes_anterior' | 'anio';

/** Rango de fechas calendario (inclusive) en formato 'YYYY-MM-DD'. */
export interface Rango { desde: string; hasta: string }

export interface CuotaMetrica {
  numeroCuota: number;
  monto: number;
  tipo: string;
  estado: string;
  montoPagado: number | null;
  fechaVencimiento: Date;
  sumaPagos: number;
}

export interface ContratoMetrica {
  id: number;
  registradoPorId: number;
  fechaCreacion: Date;
  anticipoMensual: number;
  comoLlego: string | null;
  cuotas: CuotaMetrica[];
}

// ── Helpers puros ───────────────────────────────────────────────────────────

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const round2 = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (anio: number, mes: number, dia: number) => `${anio}-${pad(mes + 1)}-${pad(dia)}`;
const ultimoDiaMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();

/** Normaliza (anio, mes) cuando mes queda fuera de 0..11. */
function normMes(anio: number, mes: number): { anio: number; mes: number } {
  const d = new Date(Date.UTC(anio, mes, 1));
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() };
}

function rangoMes(anio: number, mes: number): Rango {
  const n = normMes(anio, mes);
  return { desde: ymd(n.anio, n.mes, 1), hasta: ymd(n.anio, n.mes, ultimoDiaMes(n.anio, n.mes)) };
}

/** Período pedido y período anterior para comparar, relativos a `hoy` (fecha AR). */
export function calcularPeriodos(
  tipo: TipoPeriodo,
  hoy: { anio: number; mes: number; dia: number },
): { actual: Rango; anterior: Rango; label: string } {
  if (tipo === 'mes') {
    return { actual: rangoMes(hoy.anio, hoy.mes), anterior: rangoMes(hoy.anio, hoy.mes - 1), label: `${MESES[hoy.mes]} ${hoy.anio}` };
  }
  if (tipo === 'mes_anterior') {
    const n = normMes(hoy.anio, hoy.mes - 1);
    return { actual: rangoMes(n.anio, n.mes), anterior: rangoMes(n.anio, n.mes - 1), label: `${MESES[n.mes]} ${n.anio}` };
  }
  // anio: 1/1 hasta hoy; anterior: mismo rango del año pasado (29/2 → 28/2)
  const diaAnt = Math.min(hoy.dia, ultimoDiaMes(hoy.anio - 1, hoy.mes));
  return {
    actual: { desde: ymd(hoy.anio, 0, 1), hasta: ymd(hoy.anio, hoy.mes, hoy.dia) },
    anterior: { desde: ymd(hoy.anio - 1, 0, 1), hasta: ymd(hoy.anio - 1, hoy.mes, diaAnt) },
    label: `Año ${hoy.anio}`,
  };
}

/** fechaCreacion (timestamp) dentro del rango, en hora AR. */
function creadoEnRango(fecha: Date, r: Rango): boolean {
  return fecha >= inicioDiaAR(r.desde) && fecha <= finDiaAR(r.hasta);
}

/** Vencimiento (fecha calendario, día UTC) dentro del rango. */
function venceEnRango(fecha: Date, r: Rango): boolean {
  return fecha >= new Date(`${r.desde}T00:00:00.000Z`) && fecha <= new Date(`${r.hasta}T23:59:59.999Z`);
}

/** Valor de la cuota mensual (sin sellado): misma regla que el scheduler. */
export function valorCuota(c: ContratoMetrica): number {
  const cuota2 = c.cuotas.find(q => q.numeroCuota === 2 && q.tipo !== 'FINANCIAMIENTO');
  return cuota2 ? cuota2.monto : c.anticipoMensual;
}

/** Monto pagado de una cuota: max(suma CuotaPago, montoPagado); PAGADA sin registros = monto completo. */
export function pagadoCuota(q: CuotaMetrica): number {
  const pagado = Math.max(q.sumaPagos, q.montoPagado ?? 0);
  if (q.estado === 'PAGADA' && pagado === 0) return q.monto;
  return pagado;
}

export function calcularVentas(contratos: ContratoMetrica[], r: Rango): number {
  return contratos.filter(c => creadoEnRango(c.fechaCreacion, r)).length;
}

export function calcularCartera(contratos: ContratoMetrica[]): { contratosActivos: number; cuotaPromedio: number; carteraMensual: number } {
  const cartera = contratos.reduce((s, c) => s + valorCuota(c), 0);
  return {
    contratosActivos: contratos.length,
    carteraMensual: round2(cartera),
    cuotaPromedio: contratos.length > 0 ? round2(cartera / contratos.length) : 0,
  };
}

export function calcularCobranza(contratos: ContratoMetrica[], r: Rango): { esperado: number; cobrado: number; porcentaje: number } {
  let esperado = 0;
  let cobrado = 0;
  for (const c of contratos) {
    for (const q of c.cuotas) {
      if (q.numeroCuota === 1 || !venceEnRango(q.fechaVencimiento, r)) continue;
      esperado += q.monto;
      cobrado += Math.min(pagadoCuota(q), q.monto);
    }
  }
  return {
    esperado: round2(esperado),
    cobrado: round2(cobrado),
    porcentaje: esperado > 0 ? Math.round((cobrado / esperado) * 1000) / 10 : 0,
  };
}

export function calcularMora(contratos: ContratoMetrica[], limite: Date): { cuotas: number; monto: number; contratos: number } {
  let cuotas = 0;
  let monto = 0;
  const ids = new Set<number>();
  for (const c of contratos) {
    for (const q of c.cuotas) {
      const enMora = q.estado === 'VENCIDA' || (q.estado === 'PARCIAL' && q.fechaVencimiento < limite);
      if (!enMora) continue;
      cuotas++;
      monto += Math.max(0, q.monto - pagadoCuota(q));
      ids.add(c.id);
    }
  }
  return { cuotas, monto: round2(monto), contratos: ids.size };
}

export function calcularVentasPorMes(
  contratos: ContratoMetrica[],
  hoy: { anio: number; mes: number },
  usuarios: Map<number, string> | null,
): { mes: string; label: string; total: number; porVendedor: { vendedorId: number; nombre: string; total: number }[] }[] {
  const meses: { key: string; mes: number; anio: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const n = normMes(hoy.anio, hoy.mes - i);
    meses.push({ key: `${n.anio}-${pad(n.mes + 1)}`, mes: n.mes, anio: n.anio });
  }
  const totales = new Map<string, number>();
  const porVend = new Map<string, Map<number, number>>();
  for (const c of contratos) {
    const p = partesFechaAR(c.fechaCreacion);
    const key = `${p.anio}-${pad(p.mes + 1)}`;
    totales.set(key, (totales.get(key) ?? 0) + 1);
    if (usuarios) {
      if (!porVend.has(key)) porVend.set(key, new Map());
      const m = porVend.get(key)!;
      m.set(c.registradoPorId, (m.get(c.registradoPorId) ?? 0) + 1);
    }
  }
  return meses.map(m => ({
    mes: m.key,
    label: MESES_CORTOS[m.mes],
    total: totales.get(m.key) ?? 0,
    porVendedor: usuarios
      ? Array.from(porVend.get(m.key)?.entries() ?? [])
          .map(([vendedorId, total]) => ({ vendedorId, nombre: usuarios.get(vendedorId) ?? `Usuario #${vendedorId}`, total }))
          .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre))
      : [],
  }));
}

export function calcularOrigen(contratos: ContratoMetrica[], r: Rango): { comoLlego: string; cantidad: number }[] {
  const map = new Map<string, number>();
  for (const c of contratos) {
    if (!creadoEnRango(c.fechaCreacion, r)) continue;
    const k = c.comoLlego?.trim() || 'Sin dato';
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([comoLlego, cantidad]) => ({ comoLlego, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.comoLlego.localeCompare(b.comoLlego));
}

export function calcularRanking(
  contratos: ContratoMetrica[],
  usuarios: { id: number; nombre: string }[],
  r: Rango,
  limite: Date,
) {
  const porVendedor = new Map<number, ContratoMetrica[]>();
  for (const c of contratos) {
    if (!porVendedor.has(c.registradoPorId)) porVendedor.set(c.registradoPorId, []);
    porVendedor.get(c.registradoPorId)!.push(c);
  }
  return usuarios
    .filter(u => (porVendedor.get(u.id)?.length ?? 0) > 0)
    .map(u => {
      const propios = porVendedor.get(u.id)!;
      const cartera = calcularCartera(propios);
      return {
        vendedorId: u.id,
        nombre: u.nombre,
        ventasPeriodo: calcularVentas(propios, r),
        contratosActivos: cartera.contratosActivos,
        cuotaPromedio: cartera.cuotaPromedio,
        carteraMensual: cartera.carteraMensual,
        cobranzaPorcentaje: calcularCobranza(propios, r).porcentaje,
        moraMonto: calcularMora(propios, limite).monto,
      };
    })
    .sort((a, b) => b.ventasPeriodo - a.ventasPeriodo || b.contratosActivos - a.contratosActivos || a.nombre.localeCompare(b.nombre));
}

// ── GET / ───────────────────────────────────────────────────────────────────

const PERIODOS: TipoPeriodo[] = ['mes', 'mes_anterior', 'anio'];

router.get('/', authMiddleware, requirePermiso('VENTAS', 'leer'), async (req: AuthRequest, res: Response) => {
  try {
    const tipo = (req.query.periodo ?? 'mes') as TipoPeriodo;
    if (typeof tipo !== 'string' || !PERIODOS.includes(tipo)) {
      return res.status(400).json({ error: 'Período inválido. Valores permitidos: mes, mes_anterior, anio' });
    }

    const admin = esAdmin(req);
    let vendedor: { id: number; nombre: string } | null = null;

    if (admin) {
      const raw = req.query.vendedorId;
      if (raw !== undefined && raw !== '') {
        const id = parseId(raw);
        if (!id) return res.status(400).json({ error: 'vendedorId inválido' });
        const u = await prisma.usuario.findUnique({ where: { id }, select: { id: true, nombre: true } });
        if (!u) return res.status(400).json({ error: 'El vendedor indicado no existe' });
        vendedor = u;
      }
    } else {
      // Vendedor: siempre solo sus métricas (se ignoran vendedorId y verTodos)
      const u = await prisma.usuario.findUnique({ where: { id: req.userId! }, select: { id: true, nombre: true } });
      vendedor = u ?? { id: req.userId!, nombre: '' };
    }

    const vistaGlobal = admin && !vendedor;
    const hoy = partesFechaAR();
    const { actual, anterior, label } = calcularPeriodos(tipo, hoy);
    const limite = limiteVencimiento();

    const rows = await prisma.contrato.findMany({
      where: { estado: 'ACTIVO', ...(vendedor ? { registradoPorId: vendedor.id } : {}) },
      select: {
        id: true,
        registradoPorId: true,
        fechaCreacion: true,
        anticipoMensual: true,
        comoLlego: true,
        cuotas: {
          select: {
            numeroCuota: true,
            monto: true,
            tipo: true,
            estado: true,
            montoPagado: true,
            fechaVencimiento: true,
            pagos: { select: { monto: true } },
          },
        },
      },
    });

    const contratos: ContratoMetrica[] = rows.map(c => ({
      id: c.id,
      registradoPorId: c.registradoPorId,
      fechaCreacion: c.fechaCreacion,
      anticipoMensual: Number(c.anticipoMensual),
      comoLlego: c.comoLlego,
      cuotas: c.cuotas.map(q => ({
        numeroCuota: q.numeroCuota,
        monto: Number(q.monto),
        tipo: q.tipo,
        estado: q.estado,
        montoPagado: q.montoPagado != null ? Number(q.montoPagado) : null,
        fechaVencimiento: q.fechaVencimiento,
        sumaPagos: q.pagos.reduce((s, p) => s + Number(p.monto), 0),
      })),
    }));

    let usuarios: { id: number; nombre: string }[] = [];
    if (vistaGlobal) {
      usuarios = await prisma.usuario.findMany({ where: { activo: true }, select: { id: true, nombre: true } });
    }
    // Para porVendedor se usan todos los usuarios con contratos (aunque estén inactivos)
    let nombres: Map<number, string> | null = null;
    if (vistaGlobal) {
      const ids = Array.from(new Set(contratos.map(c => c.registradoPorId)));
      const todos = ids.length > 0
        ? await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } })
        : [];
      nombres = new Map(todos.map(u => [u.id, u.nombre]));
    }

    const cartera = calcularCartera(contratos);

    res.json({
      periodo: { tipo, desde: actual.desde, hasta: actual.hasta, label },
      alcance: { esAdmin: admin, vendedor },
      resumen: {
        ventasPeriodo: calcularVentas(contratos, actual),
        ventasPeriodoAnterior: calcularVentas(contratos, anterior),
        contratosActivos: cartera.contratosActivos,
        cuotaPromedio: cartera.cuotaPromedio,
        carteraMensual: cartera.carteraMensual,
        cobranza: calcularCobranza(contratos, actual),
        mora: calcularMora(contratos, limite),
      },
      ventasPorMes: calcularVentasPorMes(contratos, hoy, nombres),
      ranking: vistaGlobal ? calcularRanking(contratos, usuarios, actual, limite) : null,
      origen: vistaGlobal ? calcularOrigen(contratos, actual) : null,
    });
  } catch (error) {
    handleError(error, 'obtener métricas', res);
  }
});

export default router;
