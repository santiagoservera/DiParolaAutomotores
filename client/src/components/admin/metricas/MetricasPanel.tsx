import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, CalendarRange, FileCheck2, Minus,
  RefreshCw, ShoppingBag, Sparkles, TrendingUp, Wallet2, X,
} from 'lucide-react';
import { Card } from '@/components/ui';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { contratosService, metricasService } from '@/services/api';
import { currencyFormat } from '@/lib/utils';
import type { ViewType } from '@/types';
import { KpiCard } from './KpiCard';
import { CobranzaCard, MoraCard } from './CobranzaMoraCards';
import { VentasChart } from './VentasChart';
import { RankingVendedores } from './RankingVendedores';
import { OrigenVentas } from './OrigenVentas';
import { CollapsibleCard } from './CollapsibleCard';
import { VencidasDetalle } from './VencidasDetalle';
import { colorCobranza } from './types';
import type { MetricasData, PeriodoMetricas } from './types';

const PERIODOS: { value: PeriodoMetricas; label: string }[] = [
  { value: 'mes', label: 'Este mes' },
  { value: 'mes_anterior', label: 'Mes anterior' },
  { value: 'anio', label: 'Este año' },
];
const LS_PERIODO = 'dashboard.metricas.periodo';
const LS_OPEN_METRICAS = 'dashboard.metricas.abierta';
const LS_OPEN_ACTIVIDAD = 'dashboard.actividad.abierta';

function leerPeriodo(): PeriodoMetricas {
  try {
    const v = localStorage.getItem(LS_PERIODO);
    if (v === 'mes' || v === 'mes_anterior' || v === 'anio') return v;
  } catch { /* noop */ }
  return 'mes';
}
function leerBool(key: string): boolean {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}
function guardar(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* noop */ }
}

const money = (n: number) => currencyFormat(Math.round(n));
const sk = 'bg-white/[0.06]';

interface Props {
  onNavigate: (view: ViewType) => void;
  /** Cuotas vencidas ya cargadas por el dashboard (se muestran dentro de "Actividad") */
  vencidas: any[];
}

export function MetricasPanel({ onNavigate, vencidas }: Props) {
  const { tienePermiso } = useAuth();
  const esAdmin = tienePermiso('CONFIGURACION', 'leer');
  const puedeCobranzas = tienePermiso('COBRANZAS', 'leer');

  const [periodo, setPeriodo] = useState<PeriodoMetricas>(leerPeriodo);
  const [vendedorId, setVendedorId] = useState<number | null>(null);
  const [vendedores, setVendedores] = useState<{ id: number; nombre: string }[]>([]);
  const [data, setData] = useState<MetricasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMetricas, setOpenMetricas] = useState(() => leerBool(LS_OPEN_METRICAS));
  const [openActividad, setOpenActividad] = useState(() => leerBool(LS_OPEN_ACTIVIDAD));
  const reqId = useRef(0);

  useEffect(() => {
    if (!esAdmin) return;
    contratosService.listarVendedores()
      .then(r => setVendedores(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
      .catch(() => setVendedores([]));
  }, [esAdmin]);

  const cargar = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const params: { periodo: PeriodoMetricas; vendedorId?: number } = { periodo };
      if (esAdmin && vendedorId) params.vendedorId = vendedorId;
      const r = await metricasService.obtener(params);
      if (id !== reqId.current) return;
      setData(r.data as MetricasData);
    } catch (err: any) {
      if (id !== reqId.current) return;
      const status = err?.response?.status;
      setError(status === 404
        ? 'Las métricas todavía no están disponibles en el servidor.'
        : err?.response?.data?.error || 'No se pudieron cargar las métricas.');
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [periodo, vendedorId, esAdmin]);

  useEffect(() => { cargar(); }, [cargar]);

  function cambiarPeriodo(p: PeriodoMetricas) {
    setPeriodo(p);
    guardar(LS_PERIODO, p);
  }
  function toggleMetricas() {
    setOpenMetricas(o => { guardar(LS_OPEN_METRICAS, o ? '0' : '1'); return !o; });
  }
  function toggleActividad() {
    setOpenActividad(o => { guardar(LS_OPEN_ACTIVIDAD, o ? '0' : '1'); return !o; });
  }

  const vistaGlobal = esAdmin && !vendedorId;
  const nombreVendedor = data?.alcance.vendedor?.nombre
    || vendedores.find(v => v.id === vendedorId)?.nombre;
  const primeraCarga = loading && !data;

  // ── Resúmenes de una línea (tarjetas cerradas) ───────────────────────────────
  const resumenMetricas: ReactNode = primeraCarga ? <span className="block h-3 w-48 max-w-full mt-1 rounded animate-pulse bg-white/[0.06]" />
    : error ? <span className="text-[#8892b0]">No disponible</span>
    : data ? (
      <span className="flex flex-wrap gap-x-1.5 gap-y-0.5">
        <span><b className="text-white tabular-nums">{data.resumen.ventasPeriodo}</b> {data.resumen.ventasPeriodo === 1 ? 'venta' : 'ventas'}</span>
        <span aria-hidden>·</span>
        <span>Cuota prom. <b className="text-[#c4b5fd] tabular-nums">{money(data.resumen.cuotaPromedio)}</b></span>
        <span aria-hidden className="hidden min-[400px]:inline">·</span>
        <span className="hidden min-[400px]:inline">Cartera <b className="text-white tabular-nums">{money(data.resumen.carteraMensual)}</b></span>
      </span>
    ) : null;

  const pctCobranza = data?.resumen.cobranza.porcentaje ?? 0;
  const sinEsperado = !data?.resumen.cobranza.esperado;
  const moraMonto = data?.resumen.mora.monto ?? 0;
  const resumenActividad: ReactNode = primeraCarga ? <span className="block h-3 w-40 max-w-full mt-1 rounded animate-pulse bg-white/[0.06]" />
    : error ? (
      vencidas.length > 0
        ? <span className="text-red-400">{vencidas.length} cuotas vencidas</span>
        : <span className="text-[#8892b0]">No disponible</span>
    ) : data ? (
      <span className="flex flex-wrap gap-x-1.5 gap-y-0.5">
        <span>Cobranza <b className={`tabular-nums ${sinEsperado ? 'text-[#8892b0]' : colorCobranza(pctCobranza).text}`}>
          {sinEsperado ? '—' : `${Math.round(pctCobranza)}%`}</b></span>
        <span aria-hidden>·</span>
        {moraMonto > 0
          ? <span>Mora <b className="text-red-400 tabular-nums">{money(moraMonto)}</b></span>
          : <span className="text-emerald-400 font-medium">Sin mora</span>}
      </span>
    ) : null;

  // ── Controles de filtro ──────────────────────────────────────────────────────
  const selectorPeriodo = (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="grid grid-cols-3 p-1 rounded-full bg-[#1a2040] border border-[#4a6fd4]/10">
          {PERIODOS.map(p => (
            <button key={p.value} type="button" onClick={() => cambiarPeriodo(p.value)}
              className={`px-2 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${periodo === p.value
                ? 'bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white shadow-md shadow-[#2648a1]/30'
                : 'text-[#8892b0] hover:text-white'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {esAdmin && (
          <Select value={vendedorId ? String(vendedorId) : 'ALL'}
            onValueChange={v => setVendedorId(v === 'ALL' ? null : Number(v))}>
            <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-9 w-full sm:w-[200px] rounded-full text-xs cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
              <SelectItem value="ALL" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Todos los vendedores</SelectItem>
              {vendedores.map(v => (
                <SelectItem key={v.id} value={String(v.id)} className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">{v.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <p className="text-xs text-[#8892b0] flex items-center gap-1.5 flex-wrap">
        <CalendarRange className="w-3.5 h-3.5" />
        <span className="capitalize">{data?.periodo.label || '—'}</span>
        {!esAdmin && <span>· tus resultados</span>}
        {esAdmin && vendedorId && nombreVendedor && (
          <button type="button" onClick={() => setVendedorId(null)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#4a6fd4]/15 text-[#7b9ae8] text-[11px] font-medium hover:bg-[#4a6fd4]/25 cursor-pointer">
            {nombreVendedor} <X className="w-3 h-3" />
          </button>
        )}
      </p>
    </div>
  );

  const errorBox = error && !loading ? (
    <div className="rounded-lg border border-[#4a6fd4]/10 bg-[#0b0e18]/40 p-5 text-center">
      <BarChart3 className="w-9 h-9 mx-auto text-[#4a6fd4]/40 mb-2" />
      <p className="text-sm text-white font-medium">{error}</p>
      <p className="text-xs text-[#8892b0] mt-1">El resto del panel sigue funcionando normalmente.</p>
      <button type="button" onClick={cargar}
        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4a6fd4]/15 text-[#7b9ae8] text-sm font-semibold hover:bg-[#4a6fd4]/25 transition-colors cursor-pointer">
        <RefreshCw className="w-4 h-4" /> Reintentar
      </button>
    </div>
  ) : null;

  return (
    <section className="space-y-3">
      {/* ── Métricas ── */}
      <CollapsibleCard title="Métricas" icon={TrendingUp} summary={resumenMetricas}
        open={openMetricas} onToggle={toggleMetricas}>
        {selectorPeriodo}
        {errorBox ?? (primeraCarga ? <SkeletonMetricas global={vistaGlobal} /> : data && (
          <div className={`space-y-4 transition-opacity duration-300 ${loading ? 'opacity-60' : ''}`}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <KpiCard label="Ventas" value={data.resumen.ventasPeriodo} icon={ShoppingBag}
                gradient="from-[#2648a1]/30 to-[#4a6fd4]/5" iconColor="text-[#7b9ae8]"
                title="Contratos activos registrados en el período"
                footer={<Delta actual={data.resumen.ventasPeriodo} anterior={data.resumen.ventasPeriodoAnterior}
                  texto={data.periodo.tipo === 'anio' ? 'vs año anterior' : 'vs mes anterior'} />} />
              <KpiCard label="Contratos activos" value={data.resumen.contratosActivos} icon={FileCheck2}
                gradient="from-emerald-500/25 to-emerald-500/5" iconColor="text-emerald-400"
                subtitle="Cartera vigente" title="Total de contratos en estado ACTIVO" />
              <KpiCard label="Cuota promedio" value={data.resumen.cuotaPromedio} format={money} icon={Sparkles}
                gradient="from-[#4a6fd4]/40 to-[#a78bfa]/10" iconColor="text-[#c4b5fd]" highlight
                subtitle="Sin sellado · contratos activos"
                title="Suma de la cuota mensual (sin sellado) de los contratos activos / cantidad" />
              <KpiCard label="Cartera mensual" value={data.resumen.carteraMensual} format={money} icon={Wallet2}
                gradient="from-cyan-500/25 to-cyan-500/5" iconColor="text-cyan-300"
                subtitle="Suma de cuotas mensuales"
                title="Suma de la cuota mensual (sin sellado) de todos los contratos activos" />
            </div>

            <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${vistaGlobal && data.origen ? 'lg:grid-cols-3' : ''}`}>
              <div className={vistaGlobal && data.origen ? 'lg:col-span-2 min-w-0' : 'min-w-0'}>
                <VentasChart ventasPorMes={data.ventasPorMes || []} apilado={vistaGlobal} />
              </div>
              {vistaGlobal && data.origen && <OrigenVentas origen={data.origen} />}
            </div>

            {vistaGlobal && data.ranking && (
              <RankingVendedores ranking={data.ranking} onSelect={id => setVendedorId(id)} />
            )}
          </div>
        ))}
      </CollapsibleCard>

      {/* ── Actividad ── */}
      <CollapsibleCard title="Actividad" icon={Activity} iconClass="text-amber-400" summary={resumenActividad}
        open={openActividad} onToggle={toggleActividad}>
        {!openMetricas && selectorPeriodo}
        {errorBox ?? (primeraCarga ? <SkeletonActividad /> : data && (
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 transition-opacity duration-300 ${loading ? 'opacity-60' : ''}`}>
            <CobranzaCard cobranza={data.resumen.cobranza} />
            <MoraCard mora={data.resumen.mora}
              onClick={puedeCobranzas ? () => onNavigate('admin-cobranzas') : undefined} />
          </div>
        ))}
        {puedeCobranzas && <VencidasDetalle vencidas={vencidas} onVerTodas={() => onNavigate('admin-cobranzas')} />}
      </CollapsibleCard>
    </section>
  );
}

function SkeletonMetricas({ global }: { global: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[0, 1, 2, 3].map(i => (
          <Card key={i} className="p-3.5 sm:p-5 border-[#4a6fd4]/8 bg-[#131729] shadow-none space-y-3">
            <div className="flex justify-between"><Skeleton className={`h-3 w-16 ${sk}`} /><Skeleton className={`h-7 w-7 rounded-lg ${sk}`} /></div>
            <Skeleton className={`h-7 w-24 ${sk}`} />
            <Skeleton className={`h-3 w-20 ${sk}`} />
          </Card>
        ))}
      </div>
      <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${global ? 'lg:grid-cols-3' : ''}`}>
        <Card className={`p-4 sm:p-5 border-[#4a6fd4]/8 bg-[#131729] shadow-none ${global ? 'lg:col-span-2' : ''}`}>
          <Skeleton className={`h-4 w-40 mb-4 ${sk}`} />
          <div className="h-[200px] flex items-end gap-3">
            {[45, 70, 55, 85, 60, 95].map((h, i) => <Skeleton key={i} className={`flex-1 rounded-t-md rounded-b-none ${sk}`} style={{ height: `${h}%` }} />)}
          </div>
        </Card>
        {global && (
          <Card className="p-4 sm:p-5 border-[#4a6fd4]/8 bg-[#131729] shadow-none flex flex-col items-center gap-4">
            <Skeleton className={`h-4 w-32 self-start ${sk}`} />
            <Skeleton className={`h-[150px] w-[150px] rounded-full ${sk}`} />
          </Card>
        )}
      </div>
    </div>
  );
}

function SkeletonActividad() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
      {[0, 1].map(i => (
        <Card key={i} className="p-4 sm:p-5 border-[#4a6fd4]/8 bg-[#131729] shadow-none flex items-center gap-4">
          <Skeleton className={`h-24 w-24 rounded-full shrink-0 ${sk}`} />
          <div className="flex-1 space-y-2"><Skeleton className={`h-4 w-3/4 ${sk}`} /><Skeleton className={`h-4 w-1/2 ${sk}`} /><Skeleton className={`h-2 w-full ${sk}`} /></div>
        </Card>
      ))}
    </div>
  );
}

function Delta({ actual, anterior, texto }: { actual: number; anterior: number; texto: string }) {
  const diff = actual - anterior;
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-[#8892b0]">
        <Minus className="w-3 h-3" /> igual {texto}
      </span>
    );
  }
  const sube = diff > 0;
  const pct = anterior > 0 ? Math.round((Math.abs(diff) / anterior) * 100) : null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium flex-wrap ${sube ? 'text-emerald-400' : 'text-red-400'}`}>
      {sube ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
      <span className="tabular-nums">{sube ? '+' : '−'}{Math.abs(diff)}{pct !== null ? ` (${pct}%)` : ''}</span>
      <span className="text-[#8892b0] font-normal">{texto}</span>
    </span>
  );
}

