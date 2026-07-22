"use client";

import * as React from "react";
import { format, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "./utils";

interface DatePickerProps {
  value?: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  className?: string;
  fromYear?: number;
  toYear?: number;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  error = false,
  disabled = false,
  className,
  fromYear,
  toYear,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    const d = new Date(value + "T00:00:00");
    return isValid(d) ? d : undefined;
  }, [value]);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      onChange(`${y}-${m}-${d}`);
    } else {
      onChange("");
    }
    setOpen(false);
  };

  const displayValue = selectedDate
    ? format(selectedDate, "dd/MM/yyyy", { locale: es })
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "flex items-center justify-between w-full h-11 px-3 rounded-lg text-sm border transition-all duration-200 cursor-pointer",
            "bg-[#1a2040] text-white",
            "focus:outline-none focus:ring-2 focus:ring-[#4a6fd4]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error
              ? "border-red-500/50 ring-1 ring-red-500/20"
              : "border-[#4a6fd4]/10 hover:border-[#4a6fd4]/30",
            className
          )}
        >
          <span className={displayValue ? "text-white" : "text-[#8892b0]/50"}>
            {displayValue || placeholder}
          </span>
          <CalendarDays className="w-4 h-4 text-[#8892b0]/40 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-[#131729] border-[#4a6fd4]/10 shadow-xl shadow-black/30"
        align="start"
        sideOffset={4}
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          defaultMonth={selectedDate || new Date()}
          startMonth={fromYear ? new Date(fromYear, 0) : undefined}
          endMonth={toYear ? new Date(toYear, 11) : undefined}
          className="text-white"
        />
        {value && (
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="w-full text-xs text-[#8892b0] hover:text-red-400 transition-colors py-1.5 cursor-pointer"
            >
              Limpiar fecha
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
