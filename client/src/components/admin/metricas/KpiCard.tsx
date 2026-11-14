import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui';

/** Animación de conteo suave con requestAnimationFrame (easeOutCubic). */
export function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const destino = Number.isFinite(target) ? target : 0;
    let reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* noop */ }
    const from = fromRef.current;
    if (reduce || from === destino) {
      fromRef.current = destino;
      setVal(destino);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      const v = from + (destino - from) * e;
      fromRef.current = v;
      setVal(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return val;
}

interface KpiCardProps {
  label: string;
  value: number;
  format?: (n: number) => string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  iconColor: string;
  subtitle?: ReactNode;
  footer?: ReactNode;
  highlight?: boolean;
  title?: string;
}

export function KpiCard({ label, value, format, icon: Icon, gradient, iconColor, subtitle, footer, highlight, title }: KpiCardProps) {
  const animado = useCountUp(value);
  const texto = format ? format(animado) : Math.round(animado).toLocaleString('es-AR');

  return (
    <Card
      className={`relative p-3.5 sm:p-5 bg-[#131729] shadow-none ${highlight
        ? 'border-[#4a6fd4]/40 ring-1 ring-[#4a6fd4]/20 shadow-lg shadow-[#2648a1]/10'
        : 'border-[#4a6fd4]/8'}`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${gradient} opacity-40`} />
      <div className="relative" title={title}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] sm:text-xs font-medium text-[#8892b0] uppercase tracking-wide truncate">{label}</span>
          <div className={`p-1.5 sm:p-2 rounded-lg bg-gradient-to-br ${gradient} shrink-0`}>
            <Icon className={`w-4 h-4 ${iconColor}`} />
          </div>
        </div>
        <div className="mt-2 sm:mt-3 text-lg min-[400px]:text-xl sm:text-2xl lg:text-[28px] font-bold text-white tabular-nums leading-tight break-words">
          {texto}
        </div>
        {subtitle && <div className="mt-1 text-[10px] sm:text-xs text-[#8892b0]">{subtitle}</div>}
        {footer && <div className="mt-2">{footer}</div>}
      </div>
    </Card>
  );
}
