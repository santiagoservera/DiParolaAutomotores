import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui';
import { PALETA } from './types';
import type { VentasMes } from './types';

interface Props {
  ventasPorMes: VentasMes[];
  apilado: boolean;
}

function DarkTooltip({ active, payload, label, apilado }: any) {
  if (!active || !payload?.length) return null;
  const items = (payload as any[]).filter(p => Number(p.value) > 0);
  const total = (payload as any[]).reduce((s, p) => s + (Number(p.value) || 0), 0);
  return (
    <div className="rounded-lg border border-[#4a6fd4]/20 bg-[#0b0e18]/95 px-3 py-2 shadow-xl text-xs min-w-[140px]">
      <div className="font-semibold text-white mb-1 capitalize">{label}</div>
      {apilado ? (
        <>
          {items.map(p => (
            <div key={p.dataKey} className="flex items-center justify-between gap-3 text-[#c5cde8]">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.color }} />
                <span className="truncate">{p.name}</span>
              </span>
              <span className="tabular-nums font-medium">{p.value}</span>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t border-white/10 mt-1 pt-1 text-white font-semibold">
            <span>Total</span><span className="tabular-nums">{total}</span>
          </div>
        </>
      ) : (
        <div className="text-[#c5cde8]"><span className="text-white font-bold tabular-nums">{total}</span> {total === 1 ? 'venta' : 'ventas'}</div>
      )}
    </div>
  );
}

export function VentasChart({ ventasPorMes, apilado }: Props) {
  const { rows, series } = useMemo(() => {
    const totales = new Map<number, { nombre: string; total: number }>();
    if (apilado) {
      for (const m of ventasPorMes) {
        for (const v of m.porVendedor || []) {
          const prev = totales.get(v.vendedorId);
          totales.set(v.vendedorId, { nombre: v.nombre, total: (prev?.total || 0) + v.total });
        }
      }
    }
    const series = [...totales.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([id, v], i) => ({ key: `v${id}`, id, nombre: v.nombre, color: PALETA[i % PALETA.length] }));

    const rows = ventasPorMes.map(m => {
      const row: Record<string, string | number> = { label: m.label, total: m.total };
      if (apilado) {
        for (const s of series) row[s.key] = 0;
        for (const v of m.porVendedor || []) row[`v${v.vendedorId}`] = v.total;
      }
      return row;
    });
    return { rows, series };
  }, [ventasPorMes, apilado]);

  const usarApilado = apilado && series.length > 0;
  const vacio = ventasPorMes.every(m => !m.total);

  return (
    <Card className="p-4 sm:p-5 border-[#4a6fd4]/8 bg-[#131729] shadow-none">
      <h3 className="font-semibold text-white text-sm sm:text-base flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-[#7b9ae8]" /> Ventas últimos 6 meses
      </h3>
      {vacio ? (
        <div className="h-[220px] flex flex-col items-center justify-center text-center gap-2">
          <BarChart3 className="w-8 h-8 text-[#4a6fd4]/40" />
          <p className="text-sm text-[#8892b0]">Todavía no hay ventas en los últimos 6 meses</p>
        </div>
      ) : (
        <div className={usarApilado ? 'h-[280px] sm:h-[300px]' : 'h-[220px] sm:h-[260px]'}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={{ stroke: 'rgba(136,146,176,0.2)' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip cursor={{ fill: 'rgba(74,111,212,0.08)' }} content={<DarkTooltip apilado={usarApilado} />} />
              {usarApilado && series.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.nombre} stackId="v" fill={s.color} maxBarSize={44}
                  radius={i === series.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} />
              ))}
              {usarApilado && (
                <Legend verticalAlign="bottom" iconType="circle" iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: '#8892b0', paddingTop: 8 }} />
              )}
              {!usarApilado && (
                <Bar dataKey="total" name="Ventas" fill="#4a6fd4" radius={[6, 6, 0, 0]} maxBarSize={44} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
