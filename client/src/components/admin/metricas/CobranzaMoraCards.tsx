import { AlertTriangle, ArrowRight, PartyPopper, Wallet } from 'lucide-react';
import { Card } from '@/components/ui';
import { currencyFormat } from '@/lib/utils';
import { useCountUp } from './KpiCard';
import { colorCobranza } from './types';
import type { MetricasData } from './types';

export function CobranzaCard({ cobranza }: { cobranza: MetricasData['resumen']['cobranza'] }) {
  const pct = Math.max(0, Math.min(100, cobranza.porcentaje || 0));
  const animado = useCountUp(pct);
  const c = colorCobranza(pct);
  const R = 42;
  const circ = 2 * Math.PI * R;
  const sinEsperado = !cobranza.esperado;

  return (
    <Card className="p-4 sm:p-5 border-[#4a6fd4]/8 bg-[#131729] shadow-none">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white text-sm sm:text-base flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#7b9ae8]" /> Cobranza del período
        </h3>
      </div>
      {sinEsperado ? (
        <p className="text-sm text-[#8892b0] py-6 text-center">No hay cuotas con vencimiento en este período</p>
      ) : (
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
              <circle cx="50" cy="50" r={R} fill="none" stroke={c.stroke} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={circ * (1 - animado / 100)} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-xl sm:text-2xl font-bold tabular-nums ${c.text}`}>{Math.round(animado)}%</span>
              <span className="text-[9px] uppercase tracking-wide text-[#8892b0]">cobrado</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <div className="text-[11px] text-[#8892b0]">Cobrado</div>
              <div className="text-base sm:text-lg font-bold text-white tabular-nums break-words">{currencyFormat(cobranza.cobrado)}</div>
            </div>
            <div>
              <div className="text-[11px] text-[#8892b0]">Esperado</div>
              <div className="text-sm sm:text-base font-semibold text-[#c5cde8] tabular-nums break-words">{currencyFormat(cobranza.esperado)}</div>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className={`h-full rounded-full ${c.bg} transition-all duration-700`} style={{ width: `${pct}%` }} />
            </div>
            <div className="text-[11px] text-[#8892b0]">
              Falta {currencyFormat(Math.max(0, cobranza.esperado - cobranza.cobrado))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export function MoraCard({ mora, onClick }: { mora: MetricasData['resumen']['mora']; onClick?: () => void }) {
  const sinMora = !mora.cuotas && !mora.monto;
  const clickable = !sinMora && !!onClick;

  if (sinMora) {
    return (
      <Card className="p-4 sm:p-5 border-emerald-500/20 bg-[#131729] shadow-none relative">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent" />
        <div className="relative h-full flex flex-col items-center justify-center text-center py-4 gap-2">
          <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <PartyPopper className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-400">Sin mora 🎉</div>
          <p className="text-xs text-[#8892b0]">No hay cuotas vencidas impagas. ¡Excelente!</p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      onClick={clickable ? onClick : undefined}
      className={`p-4 sm:p-5 border-red-500/20 bg-[#131729] shadow-none relative ${clickable ? 'cursor-pointer hover:border-red-500/40 transition-colors group' : ''}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h3 className="font-semibold text-red-400 text-sm sm:text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Mora
          </h3>
          {clickable && (
            <span className="text-xs text-red-400/80 group-hover:text-red-300 flex items-center gap-1">
              Ver en Cobranzas <ArrowRight className="w-3 h-3" />
            </span>
          )}
        </div>
        <div className="text-[11px] text-[#8892b0]">Monto adeudado</div>
        <div className="text-xl sm:text-2xl font-bold text-white tabular-nums break-words">{currencyFormat(mora.monto)}</div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-3">
          <div className="rounded-lg bg-red-500/[0.06] border border-red-500/10 p-2.5">
            <div className="text-lg font-bold text-red-400 tabular-nums">{mora.cuotas}</div>
            <div className="text-[10px] sm:text-[11px] text-[#8892b0]">cuotas vencidas</div>
          </div>
          <div className="rounded-lg bg-red-500/[0.06] border border-red-500/10 p-2.5">
            <div className="text-lg font-bold text-red-400 tabular-nums">{mora.contratos}</div>
            <div className="text-[10px] sm:text-[11px] text-[#8892b0]">contratos afectados</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
