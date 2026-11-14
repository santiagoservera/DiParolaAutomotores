import { useMemo } from 'react';
import { Compass } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui';
import { PALETA } from './types';

interface Props {
  origen: { comoLlego: string; cantidad: number }[];
}

function labelOrigen(s: string | null | undefined) {
  if (!s) return 'Sin dato';
  const t = s.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function DonutTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const pct = total ? Math.round((Number(p.value) / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-[#4a6fd4]/20 bg-[#0b0e18]/95 px-3 py-2 shadow-xl text-xs">
      <div className="font-semibold text-white">{p.name}</div>
      <div className="text-[#c5cde8] tabular-nums">{p.value} · {pct}%</div>
    </div>
  );
}

export function OrigenVentas({ origen }: Props) {
  const datos = useMemo(() =>
    [...origen]
      .filter(o => o.cantidad > 0)
      .sort((a, b) => b.cantidad - a.cantidad)
      .map((o, i) => ({ name: labelOrigen(o.comoLlego), value: o.cantidad, color: PALETA[i % PALETA.length] })),
  [origen]);
  const total = datos.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="p-4 sm:p-5 border-[#4a6fd4]/8 bg-[#131729] shadow-none">
      <h3 className="font-semibold text-white text-sm sm:text-base flex items-center gap-2 mb-4">
        <Compass className="w-4 h-4 text-[#2dd4bf]" /> Origen de ventas
      </h3>
      {total === 0 ? (
        <div className="h-[200px] flex flex-col items-center justify-center text-center gap-2">
          <Compass className="w-8 h-8 text-[#4a6fd4]/40" />
          <p className="text-sm text-[#8892b0]">Sin datos de origen en este período</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-4">
          <div className="relative w-[170px] h-[170px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={datos} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80}
                  paddingAngle={datos.length > 1 ? 2 : 0} stroke="none" isAnimationActive>
                  {datos.map(d => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip content={<DonutTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white tabular-nums">{total}</span>
              <span className="text-[10px] uppercase tracking-wide text-[#8892b0]">ventas</span>
            </div>
          </div>
          <ul className="w-full space-y-1.5 min-w-0">
            {datos.map(d => {
              const pct = Math.round((d.value / total) * 100);
              return (
                <li key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-[#c5cde8] truncate flex-1 min-w-0">{d.name}</span>
                  <span className="text-white font-semibold tabular-nums">{d.value}</span>
                  <span className="text-[#8892b0] tabular-nums w-9 text-right">{pct}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
