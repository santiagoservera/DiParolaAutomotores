export type PeriodoMetricas = 'mes' | 'mes_anterior' | 'anio';

export interface RankingVendedor {
  vendedorId: number;
  nombre: string;
  ventasPeriodo: number;
  contratosActivos: number;
  cuotaPromedio: number;
  carteraMensual: number;
  cobranzaPorcentaje: number;
  moraMonto: number;
}

export interface VentasMes {
  mes: string;
  label: string;
  total: number;
  porVendedor: { vendedorId: number; nombre: string; total: number }[];
}

export interface MetricasData {
  periodo: { tipo: PeriodoMetricas; desde: string; hasta: string; label: string };
  alcance: { esAdmin: boolean; vendedor: { id: number; nombre: string } | null };
  resumen: {
    ventasPeriodo: number;
    ventasPeriodoAnterior: number;
    contratosActivos: number;
    cuotaPromedio: number;
    carteraMensual: number;
    cobranza: { esperado: number; cobrado: number; porcentaje: number };
    mora: { cuotas: number; monto: number; contratos: number };
  };
  ventasPorMes: VentasMes[];
  ranking: RankingVendedor[] | null;
  origen: { comoLlego: string; cantidad: number }[] | null;
}

/** Paleta armónica: azules de la marca + complementarios */
export const PALETA = [
  '#4a6fd4', '#7b9ae8', '#2dd4bf', '#a78bfa', '#f59e0b',
  '#38bdf8', '#f472b6', '#34d399', '#c084fc', '#fb7185',
];

export function colorCobranza(pct: number) {
  if (pct >= 80) return { text: 'text-emerald-400', stroke: '#34d399', bg: 'bg-emerald-400' };
  if (pct >= 50) return { text: 'text-amber-400', stroke: '#fbbf24', bg: 'bg-amber-400' };
  return { text: 'text-red-400', stroke: '#f87171', bg: 'bg-red-400' };
}

export function formatPct(n: number) {
  return `${Math.round(n)}%`;
}
