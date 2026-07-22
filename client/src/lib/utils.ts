/**
 * Formatea un número como moneda argentina (ARS).
 * Acepta number, string, Decimal de Prisma, null, undefined.
 *
 * currencyFormat(300000)       → "$ 300.000"
 * currencyFormat("1500000.50") → "$ 1.500.001"
 * currencyFormat(0)            → "$ 0"
 * currencyFormat(null)         → "$ 0"
 */
export function currencyFormat(value: number | string | null | undefined): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Formatea una fecha ISO a formato argentino dd/mm/aaaa.
 * Retorna '-' si no hay fecha.
 */
export function dateFormat(fecha: string | Date | null | undefined): string {
  if (!fecha) return '-';
  // Agregar T00:00:00 a strings YYYY-MM-DD para evitar desfase de timezone
  const d = typeof fecha === 'string'
    ? new Date(fecha.length === 10 ? fecha + 'T00:00:00' : fecha)
    : fecha;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Parsea un string de moneda formateada a número limpio.
 * Útil para inputs que muestran formato pero necesitan enviar número.
 *
 * parseCurrency("$ 300.000")  → 300000
 * parseCurrency("1.500.000")  → 1500000
 * parseCurrency("300000")     → 300000
 */
export function parseCurrency(value: string): number {
  return Number(value.replace(/[^0-9,-]/g, '').replace(',', '.')) || 0;
}

/**
 * Formatea un número mientras se escribe en un input de moneda.
 * Solo formatea visualmente, retorna el string formateado.
 *
 * currencyInput("300000") → "300.000"
 * currencyInput("")       → ""
 */
export function currencyInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('es-AR');
}

/**
 * Extrae solo dígitos de un string formateado.
 *
 * currencyRaw("300.000") → "300000"
 */
export function currencyRaw(value: string): string {
  return value.replace(/\D/g, '');
}
