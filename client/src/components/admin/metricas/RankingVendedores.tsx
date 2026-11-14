import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Trophy } from 'lucide-react';
import { Card } from '@/components/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { currencyFormat } from '@/lib/utils';
import { colorCobranza, formatPct } from './types';
import type { RankingVendedor } from './types';

type Col = keyof Omit<RankingVendedor, 'vendedorId'>;

const COLS: { key: Col; label: string; corto: string; numeric: boolean; menorEsMejor?: boolean }[] = [
  { key: 'nombre', label: 'Vendedor', corto: 'Vendedor', numeric: false },
  { key: 'ventasPeriodo', label: 'Ventas', corto: 'Ventas', numeric: true },
  { key: 'contratosActivos', label: 'Activos', corto: 'Activos', numeric: true },
  { key: 'cuotaPromedio', label: 'Cuota prom.', corto: 'Cuota prom.', numeric: true },
  { key: 'carteraMensual', label: 'Cartera mensual', corto: 'Cartera', numeric: true },
  { key: 'cobranzaPorcentaje', label: '% Cobranza', corto: '% Cobranza', numeric: true },
  { key: 'moraMonto', label: 'Mora', corto: 'Mora', numeric: true, menorEsMejor: true },
];

const MEDALLAS = ['🥇', '🥈', '🥉'];

interface Props {
  ranking: RankingVendedor[];
  onSelect: (vendedorId: number) => void;
}

export function RankingVendedores({ ranking, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<Col>('ventasPeriodo');
  const [asc, setAsc] = useState(false);

  const ordenados = useMemo(() => {
    const arr = [...ranking];
    arr.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const cmp = typeof va === 'string' ? va.localeCompare(String(vb), 'es') : (va as number) - (vb as number);
      return asc ? cmp : -cmp;
    });
    return arr;
  }, [ranking, sortKey, asc]);

  // Medallas: top 3 según la columna activa (por "mejor" valor, no por dirección de orden)
  const medallas = useMemo(() => {
    const col = COLS.find(c => c.key === sortKey);
    const key: Col = col?.numeric ? sortKey : 'ventasPeriodo';
    const menorEsMejor = col?.numeric ? !!col.menorEsMejor : false;
    const elegibles = ranking.filter(r => menorEsMejor || Number(r[key]) > 0);
    const top = [...elegibles]
      .sort((a, b) => menorEsMejor ? Number(a[key]) - Number(b[key]) : Number(b[key]) - Number(a[key]))
      .slice(0, 3);
    const m = new Map<number, string>();
    top.forEach((r, i) => m.set(r.vendedorId, MEDALLAS[i]));
    return m;
  }, [ranking, sortKey]);

  function toggleSort(key: Col) {
    if (key === sortKey) setAsc(a => !a);
    else {
      setSortKey(key);
      const col = COLS.find(c => c.key === key);
      setAsc(key === 'nombre' || !!col?.menorEsMejor);
    }
  }

  const fmt = (key: Col, r: RankingVendedor) => {
    switch (key) {
      case 'cuotaPromedio':
      case 'carteraMensual':
      case 'moraMonto':
        return currencyFormat(r[key]);
      case 'cobranzaPorcentaje':
        return formatPct(r[key]);
      default:
        return String(r[key]);
    }
  };

  return (
    <Card className="border-[#4a6fd4]/8 bg-[#131729] shadow-none">
      <div className="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-white text-sm sm:text-base flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" /> Ranking de vendedores
        </h3>
        {/* Orden en mobile */}
        <div className="lg:hidden flex items-center gap-1.5">
          <Select value={sortKey} onValueChange={v => toggleSort(v as Col)}>
            <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-8 text-xs w-[130px] cursor-pointer"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
              {COLS.map(c => (
                <SelectItem key={c.key} value={c.key} className="text-white text-xs focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">{c.corto}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button onClick={() => setAsc(a => !a)} aria-label="Invertir orden"
            className="h-8 w-8 flex items-center justify-center rounded-md bg-[#1a2040] border border-[#4a6fd4]/10 text-[#7b9ae8] cursor-pointer">
            {asc ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {ranking.length === 0 ? (
        <p className="text-sm text-[#8892b0] text-center py-8">No hay vendedores con actividad</p>
      ) : (
        <>
          {/* Tabla desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-[#8892b0]">
                  {COLS.map(c => (
                    <th key={c.key} className={`px-3 lg:px-4 py-2.5 font-medium ${c.numeric ? 'text-right' : 'text-left'}`}>
                      <button onClick={() => toggleSort(c.key)}
                        className={`inline-flex items-center gap-1 cursor-pointer hover:text-white transition-colors ${sortKey === c.key ? 'text-[#7b9ae8]' : ''}`}>
                        {c.label}
                        {sortKey === c.key && (asc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                      </button>
                    </th>
                  ))}
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {ordenados.map(r => {
                  const cc = colorCobranza(r.cobranzaPorcentaje);
                  return (
                    <tr key={r.vendedorId} onClick={() => onSelect(r.vendedorId)}
                      className="hover:bg-[#4a6fd4]/[0.06] cursor-pointer transition-colors group">
                      <td className="px-3 lg:px-4 py-3 text-white font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-5 text-center">{medallas.get(r.vendedorId) || ''}</span>
                          {r.nombre}
                        </span>
                      </td>
                      <td className="px-3 lg:px-4 py-3 text-right tabular-nums text-white font-semibold">{r.ventasPeriodo}</td>
                      <td className="px-3 lg:px-4 py-3 text-right tabular-nums text-[#c5cde8]">{r.contratosActivos}</td>
                      <td className="px-3 lg:px-4 py-3 text-right tabular-nums text-[#c5cde8]">{currencyFormat(r.cuotaPromedio)}</td>
                      <td className="px-3 lg:px-4 py-3 text-right tabular-nums text-[#c5cde8]">{currencyFormat(r.carteraMensual)}</td>
                      <td className={`px-3 lg:px-4 py-3 text-right tabular-nums font-semibold ${cc.text}`}>{formatPct(r.cobranzaPorcentaje)}</td>
                      <td className={`px-3 lg:px-4 py-3 text-right tabular-nums ${r.moraMonto > 0 ? 'text-red-400 font-semibold' : 'text-[#8892b0]'}`}>{currencyFormat(r.moraMonto)}</td>
                      <td className="pr-3"><ChevronRight className="w-4 h-4 text-[#8892b0] opacity-0 group-hover:opacity-100 transition-opacity" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards mobile */}
          <div className="lg:hidden divide-y divide-white/[0.04]">
            {ordenados.map(r => {
              const cc = colorCobranza(r.cobranzaPorcentaje);
              const activa = COLS.find(c => c.key === sortKey);
              return (
                <button key={r.vendedorId} onClick={() => onSelect(r.vendedorId)}
                  className="w-full text-left p-4 hover:bg-[#4a6fd4]/[0.06] transition-colors cursor-pointer">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      {medallas.get(r.vendedorId) && <span className="text-lg leading-none">{medallas.get(r.vendedorId)}</span>}
                      <span className="text-sm font-semibold text-white truncate">{r.nombre}</span>
                    </span>
                    {activa?.numeric && activa.key !== 'ventasPeriodo' ? (
                      <span className="text-xs text-[#7b9ae8] tabular-nums shrink-0">{activa.corto}: {fmt(activa.key, r)}</span>
                    ) : (
                      <span className="text-xs text-[#8892b0] shrink-0"><span className="text-white font-bold tabular-nums">{r.ventasPeriodo}</span> ventas</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[11px]">
                    <span className="text-[#8892b0]">Activos <span className="text-[#c5cde8] tabular-nums">{r.contratosActivos}</span></span>
                    <span className="text-[#8892b0] truncate">Cuota prom. <span className="text-[#c5cde8] tabular-nums">{currencyFormat(r.cuotaPromedio)}</span></span>
                    <span className="text-[#8892b0]">Cobranza <span className={`font-semibold tabular-nums ${cc.text}`}>{formatPct(r.cobranzaPorcentaje)}</span></span>
                    <span className="text-[#8892b0] truncate">Mora <span className={`tabular-nums ${r.moraMonto > 0 ? 'text-red-400 font-semibold' : 'text-[#c5cde8]'}`}>{currencyFormat(r.moraMonto)}</span></span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}
