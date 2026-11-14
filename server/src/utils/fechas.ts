// Helpers de fechas en zona horaria Argentina (UTC-3, sin horario de verano).
// El server puede correr en UTC: nunca usar getHours()/getDate() del server para lógica de negocio.

export const TZ_AR = 'America/Argentina/Buenos_Aires';

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha actual en Argentina como string 'YYYY-MM-DD'. */
export function hoyARStr(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_AR, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/** Año, mes (0-based) y día de una fecha vista en Argentina. */
export function partesFechaAR(d: Date = new Date()): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_AR, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d).split('-').map(Number);
  return { anio, mes: mes - 1, dia };
}

/** Inicio del día 'YYYY-MM-DD' en Argentina. */
export function inicioDiaAR(s: string): Date {
  return new Date(`${s}T00:00:00.000-03:00`);
}

/** Fin del día 'YYYY-MM-DD' en Argentina. */
export function finDiaAR(s: string): Date {
  return new Date(`${s}T23:59:59.999-03:00`);
}

/** Inicio del día actual en Argentina. */
export function hoyAR(): Date {
  return inicioDiaAR(hoyARStr());
}

/**
 * Límite para marcar cuotas como VENCIDA: medianoche UTC de la fecha actual en Argentina.
 * Las fechas de vencimiento históricas se guardaron a las 00:00Z de su día y las nuevas a
 * las 12:00 AR (15:00Z) del mismo día: ambas caen dentro del día UTC de su fecha calendario,
 * así que "vencida" = fecha calendario < hoy (AR), sin adelantarse un día.
 */
export function limiteVencimiento(): Date {
  const { anio, mes, dia } = partesFechaAR();
  return new Date(Date.UTC(anio, mes, dia));
}

/** Fecha calendario (año, mes 0-based, día) a las 12:00 AR. */
export function fechaCalendarioAR(anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes, dia, 15, 0, 0));
}

/**
 * Parsea una fecha de negocio. 'YYYY-MM-DD' → mediodía AR (evita bordes de timezone).
 * Un ISO completo se respeta tal cual. Devuelve Invalid Date si no se puede parsear.
 */
export function parseFechaAR(s: string): Date {
  const v = String(s).trim();
  if (RE_FECHA.test(v)) return new Date(`${v}T12:00:00-03:00`);
  return new Date(v);
}

export function esFechaValida(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime());
}

/** Filtro 'desde' para timestamps: 'YYYY-MM-DD' → inicio del día AR; ISO completo se respeta. */
export function filtroDesdeAR(s: string): Date {
  const v = String(s).trim();
  return RE_FECHA.test(v) ? inicioDiaAR(v) : new Date(v);
}

/** Filtro 'hasta' para timestamps: 'YYYY-MM-DD' → fin del día AR; ISO completo se respeta. */
export function filtroHastaAR(s: string): Date {
  const v = String(s).trim();
  return RE_FECHA.test(v) ? finDiaAR(v) : new Date(v);
}

/** Filtros sobre fechas calendario (vencimientos): usa el día UTC, que contiene tanto valores legacy (00:00Z) como nuevos (15:00Z). */
export function filtroDesdeCalendario(s: string): Date {
  const v = String(s).trim();
  return RE_FECHA.test(v) ? new Date(`${v}T00:00:00.000Z`) : new Date(v);
}
export function filtroHastaCalendario(s: string): Date {
  const v = String(s).trim();
  return RE_FECHA.test(v) ? new Date(`${v}T23:59:59.999Z`) : new Date(v);
}

/** Formato legible en Argentina, p.ej. "13/11/2026 15:00". */
export function formatearFechaHoraAR(d: Date): string {
  return d.toLocaleString('es-AR', {
    timeZone: TZ_AR, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}
