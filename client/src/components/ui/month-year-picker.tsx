"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "./utils";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface MonthYearPickerProps {
  value?: string; // "YYYY-MM"
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  className?: string;
  fromYear?: number;
  toYear?: number;
}

export function MonthYearPicker({
  value,
  onChange,
  placeholder = "Seleccionar mes",
  error = false,
  disabled = false,
  className,
  fromYear,
  toYear,
}: MonthYearPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<"months" | "years">("months");

  const currentYear = new Date().getFullYear();
  const minYear = fromYear ?? currentYear - 2;
  const maxYear = toYear ?? currentYear + 6;

  const selectedYear = value ? Number(value.split("-")[0]) : currentYear;
  const selectedMonth = value ? Number(value.split("-")[1]) : null;

  const [navYear, setNavYear] = React.useState(selectedYear);
  const [yearPageStart, setYearPageStart] = React.useState(Math.floor(selectedYear / 12) * 12);

  React.useEffect(() => {
    if (open) {
      setNavYear(selectedYear);
      setYearPageStart(Math.floor(selectedYear / 12) * 12);
      setView("months");
    }
  }, [open, selectedYear]);

  const handleSelectMonth = (monthIndex: number) => {
    const m = String(monthIndex + 1).padStart(2, "0");
    onChange(`${navYear}-${m}`);
    setOpen(false);
  };

  const displayValue = value && selectedMonth
    ? `${MESES[selectedMonth - 1]} ${selectedYear}`
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "flex items-center justify-between w-full h-10 px-3 rounded-lg text-sm border transition-all duration-200 cursor-pointer",
            "bg-[#1a2040] text-white",
            "focus:outline-none focus:ring-2 focus:ring-[#4a6fd4]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error
              ? "border-red-500/50 ring-1 ring-red-500/20"
              : "border-[#4a6fd4]/10 hover:border-[#4a6fd4]/30",
            className
          )}
        >
          <span className={displayValue ? "text-white text-xs" : "text-[#8892b0]/50 text-xs"}>
            {displayValue || placeholder}
          </span>
          <CalendarDays className="w-4 h-4 text-[#8892b0]/40 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] p-0 bg-[#131729] border-[#4a6fd4]/10 shadow-xl shadow-black/30"
        align="start"
        sideOffset={4}
      >
        {view === "months" && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={() => setNavYear(y => Math.max(minYear, y - 1))}
                disabled={navYear <= minYear}
                className="p-1.5 rounded-md hover:bg-[#4a6fd4]/10 text-[#8892b0] hover:text-white transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => { setYearPageStart(Math.floor(navYear / 12) * 12); setView("years"); }}
                className="text-sm font-semibold text-white hover:text-[#4a6fd4] transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-[#4a6fd4]/10">
                {navYear}
              </button>
              <button type="button" onClick={() => setNavYear(y => Math.min(maxYear, y + 1))}
                disabled={navYear >= maxYear}
                className="p-1.5 rounded-md hover:bg-[#4a6fd4]/10 text-[#8892b0] hover:text-white transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {MESES.map((nombre, i) => {
                const isSelected = selectedMonth === i + 1 && navYear === selectedYear;
                return (
                  <button key={i} type="button" onClick={() => handleSelectMonth(i)}
                    className={cn(
                      "py-2 px-1 rounded-lg text-xs font-medium transition-all cursor-pointer",
                      isSelected
                        ? "bg-[#4a6fd4] text-white shadow-lg shadow-[#4a6fd4]/20"
                        : "text-[#8892b0] hover:bg-[#4a6fd4]/10 hover:text-white"
                    )}>
                    {nombre.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {view === "years" && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={() => setYearPageStart(s => Math.max(minYear, s - 12))}
                disabled={yearPageStart <= minYear}
                className="p-1.5 rounded-md hover:bg-[#4a6fd4]/10 text-[#8892b0] hover:text-white transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-white">
                {yearPageStart} – {Math.min(yearPageStart + 11, maxYear)}
              </span>
              <button type="button" onClick={() => setYearPageStart(s => s + 12)}
                disabled={yearPageStart + 12 > maxYear}
                className="p-1.5 rounded-md hover:bg-[#4a6fd4]/10 text-[#8892b0] hover:text-white transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => yearPageStart + i)
                .filter(y => y >= minYear && y <= maxYear)
                .map(y => (
                  <button key={y} type="button" onClick={() => { setNavYear(y); setView("months"); }}
                    className={cn(
                      "py-2 px-1 rounded-lg text-xs font-medium transition-all cursor-pointer",
                      y === navYear
                        ? "bg-[#4a6fd4] text-white shadow-lg shadow-[#4a6fd4]/20"
                        : "text-[#8892b0] hover:bg-[#4a6fd4]/10 hover:text-white"
                    )}>
                    {y}
                  </button>
                ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
