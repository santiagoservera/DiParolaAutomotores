import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** Tarjeta acordeón en el flujo normal: anima la altura (grid 0fr → 1fr) y empuja el contenido de abajo. */
export function CollapsibleCard({ title, icon: Icon, iconClass = 'text-[#7b9ae8]', summary, open, onToggle, children }: Props) {
  const contentId = useId();
  // Monta el contenido recién al abrir por primera vez (evita renderizar gráficos ocultos)
  const [montado, setMontado] = useState(open);
  useEffect(() => { if (open) setMontado(true); }, [open]);

  return (
    <div className={`rounded-xl border bg-[#131729] transition-colors ${open ? 'border-[#4a6fd4]/25' : 'border-[#4a6fd4]/10 hover:border-[#4a6fd4]/25'}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={contentId}
        className="w-full min-h-[60px] flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a6fd4]/50">
        <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2648a1]/30 to-[#4a6fd4]/5 flex items-center justify-center shrink-0">
          <Icon className={`w-[18px] h-[18px] ${iconClass}`} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm sm:text-base font-semibold text-white">{title}</span>
          <span className="block text-[11px] sm:text-xs text-[#8892b0] mt-0.5 min-w-0">{summary}</span>
        </span>
        <ChevronDown className={`w-5 h-5 text-[#8892b0] shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id={contentId} role="region" aria-label={title} aria-hidden={!open} inert={!open}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden min-h-0">
          {montado && <div className="px-3 sm:px-5 pb-4 sm:pb-5 pt-1 space-y-4">{children}</div>}
        </div>
      </div>
    </div>
  );
}
