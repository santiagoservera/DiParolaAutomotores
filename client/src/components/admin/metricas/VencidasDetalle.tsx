import { AlertTriangle, ArrowRight, Phone } from 'lucide-react';
import { Card } from '@/components/ui';
import { currencyFormat, dateFormat, parseFechaLocal } from '@/lib/utils';

const diasVencida = (fecha: string) =>
  Math.floor((Date.now() - parseFechaLocal(fecha).getTime()) / (1000 * 60 * 60 * 24));

/** Detalle de cuotas vencidas (antes estaba suelto en el dashboard). */
export function VencidasDetalle({ vencidas, onVerTodas }: { vencidas: any[]; onVerTodas: () => void }) {
  if (vencidas.length === 0) return null;
  return (
    <Card className="border-red-500/20 bg-[#131729] shadow-none overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-red-500/10 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-red-400 flex items-center gap-2 text-sm sm:text-base">
          <AlertTriangle className="w-4 h-4" />
          Cuotas Vencidas ({vencidas.length})
        </h3>
        <button onClick={onVerTodas}
          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer shrink-0">
          Ver en Cobranzas <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <div className="divide-y divide-red-500/5">
        {vencidas.slice(0, 8).map((c: any) => (
          <div key={c.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-red-500/[0.03] transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  #{c.contrato?.numeroContrato} - {c.contrato?.solicitanteNombre}
                </div>
                <div className="text-xs text-[#8892b0] flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>Cuota {c.numeroCuota} · {currencyFormat(c.monto)}</span>
                  <span>Venció: {dateFormat(c.fechaVencimiento)}</span>
                  {c.contrato?.solicitanteCelular && (
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.contrato.solicitanteCelular}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 sm:ml-2">
              <span className="px-2 py-1 rounded-md bg-red-500/10 text-red-400 text-[10px] font-bold whitespace-nowrap">
                {diasVencida(c.fechaVencimiento)} días
              </span>
            </div>
          </div>
        ))}
      </div>
      {vencidas.length > 8 && (
        <div className="p-3 text-center border-t border-red-500/10">
          <button onClick={onVerTodas} className="text-xs text-red-400 hover:text-red-300 cursor-pointer">
            Ver todas las {vencidas.length} cuotas vencidas →
          </button>
        </div>
      )}
    </Card>
  );
}
