"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./utils";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

interface CalendarProps {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  defaultMonth?: Date;
  startMonth?: Date;
  endMonth?: Date;
  className?: string;
  mode?: "single";
  showOutsideDays?: boolean;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function Calendar({
  selected,
  onSelect,
  defaultMonth,
  startMonth,
  endMonth,
  className,
}: CalendarProps) {
  const now = new Date();
  const [viewMonth, setViewMonth] = React.useState(defaultMonth?.getMonth() ?? now.getMonth());
  const [viewYear, setViewYear] = React.useState(defaultMonth?.getFullYear() ?? now.getFullYear());
  const [picker, setPicker] = React.useState<'days' | 'months' | 'years'>('days');
  const [yearPageStart, setYearPageStart] = React.useState(() => {
    const y = defaultMonth?.getFullYear() ?? now.getFullYear();
    return y - (y % 12);
  });

  const minYear = startMonth?.getFullYear() ?? 1940;
  const maxYear = endMonth?.getFullYear() ?? now.getFullYear() + 5;

  // Navigation
  const canPrevMonth = !startMonth || new Date(viewYear, viewMonth - 1) >= new Date(startMonth.getFullYear(), startMonth.getMonth());
  const canNextMonth = !endMonth || new Date(viewYear, viewMonth + 1) <= new Date(endMonth.getFullYear(), endMonth.getMonth());

  const goMonth = (dir: -1 | 1) => {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    if (y >= minYear && y <= maxYear) { setViewMonth(m); setViewYear(y); }
  };

  const selectMonth = (m: number) => { setViewMonth(m); setPicker('days'); };
  const selectYear = (y: number) => { setViewYear(y); setPicker('months'); };

  // Build calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1);

  const cells: { day: number; month: number; year: number; outside: boolean }[] = [];
  // Previous month fill
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ day: d, month: m, year: y, outside: true });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month: viewMonth, year: viewYear, outside: false });
  }
  // Next month fill
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ day: d, month: m, year: y, outside: true });
  }

  const handleDayClick = (cell: typeof cells[0]) => {
    if (cell.outside) {
      setViewMonth(cell.month);
      setViewYear(cell.year);
    }
    onSelect?.(new Date(cell.year, cell.month, cell.day));
  };

  // ── YEARS VIEW ─────────────────────────────────────────────────────────

  if (picker === 'years') {
    const years = Array.from({ length: 12 }, (_, i) => yearPageStart + i).filter(y => y >= minYear && y <= maxYear);
    const canPrevYears = yearPageStart - 12 >= minYear;
    const canNextYears = yearPageStart + 12 <= maxYear;

    return (
      <div className={cn("p-3 w-[280px]", className)}>
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => canPrevYears && setYearPageStart(p => p - 12)} disabled={!canPrevYears}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#4a6fd4]/20 text-white opacity-60 hover:opacity-100 hover:bg-[#4a6fd4]/10 transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-[#8892b0]">{yearPageStart} - {yearPageStart + 11}</span>
          <button type="button" onClick={() => canNextYears && setYearPageStart(p => p + 12)} disabled={!canNextYears}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#4a6fd4]/20 text-white opacity-60 hover:opacity-100 hover:bg-[#4a6fd4]/10 transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {years.map(y => (
            <button key={y} type="button" onClick={() => selectYear(y)}
              className={cn(
                "h-9 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
                y === viewYear ? "bg-[#4a6fd4] text-white shadow-md shadow-[#4a6fd4]/25" :
                y === now.getFullYear() ? "bg-[#1a2040] text-[#7b9ae8] hover:bg-[#4a6fd4]/20" :
                "text-[#8892b0] hover:bg-[#1a2040] hover:text-white"
              )}>
              {y}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── MONTHS VIEW ────────────────────────────────────────────────────────

  if (picker === 'months') {
    return (
      <div className={cn("p-3 w-[280px]", className)}>
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => setPicker('years')}
            className="text-sm font-semibold text-[#7b9ae8] hover:text-white transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-[#4a6fd4]/10">
            {viewYear}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MESES.map((mes, i) => (
            <button key={i} type="button" onClick={() => selectMonth(i)}
              className={cn(
                "h-9 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
                i === viewMonth && viewYear === (defaultMonth?.getFullYear() ?? now.getFullYear())
                  ? "bg-[#4a6fd4] text-white shadow-md shadow-[#4a6fd4]/25"
                  : i === now.getMonth() && viewYear === now.getFullYear()
                    ? "bg-[#1a2040] text-[#7b9ae8] hover:bg-[#4a6fd4]/20"
                    : "text-[#8892b0] hover:bg-[#1a2040] hover:text-white"
              )}>
              {mes.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── DAYS VIEW (default) ────────────────────────────────────────────────

  return (
    <div className={cn("p-3 w-[280px]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => goMonth(-1)} disabled={!canPrevMonth}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#4a6fd4]/20 text-white opacity-60 hover:opacity-100 hover:bg-[#4a6fd4]/10 transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => setPicker('months')}
          className="text-sm font-semibold text-white hover:text-[#7b9ae8] transition-colors cursor-pointer px-3 py-1 rounded-md hover:bg-[#4a6fd4]/10 capitalize">
          {MESES[viewMonth]} {viewYear}
        </button>
        <button type="button" onClick={() => goMonth(1)} disabled={!canNextMonth}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#4a6fd4]/20 text-white opacity-60 hover:opacity-100 hover:bg-[#4a6fd4]/10 transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="h-8 flex items-center justify-center text-[11px] font-medium text-[#8892b0]">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const cellDate = new Date(cell.year, cell.month, cell.day);
          const isSelected = selected && isSameDay(cellDate, selected);
          const isToday = isSameDay(cellDate, now);

          return (
            <button key={i} type="button" onClick={() => handleDayClick(cell)}
              className={cn(
                "h-9 w-full inline-flex items-center justify-center rounded-lg text-sm transition-all duration-150 cursor-pointer",
                cell.outside ? "text-[#8892b0]/25 hover:text-[#8892b0]/50" :
                isSelected ? "bg-[#4a6fd4] text-white font-semibold shadow-md shadow-[#4a6fd4]/25 hover:bg-[#4a6fd4]" :
                isToday ? "bg-[#1a2040] text-[#7b9ae8] font-semibold hover:bg-[#4a6fd4]/20" :
                "text-white hover:bg-[#4a6fd4]/15"
              )}>
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { Calendar };
