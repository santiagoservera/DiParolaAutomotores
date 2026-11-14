export type Paginacion = { page: number; limit: number; skip: number };

/**
 * Parsea page/limit de la query. Devuelve un string con el error si los parámetros son inválidos.
 * limit se recorta a maxLimit.
 */
export function parsePaginacion(
  query: Record<string, any>,
  maxLimit: number,
  defaultLimit = 20,
): Paginacion | string {
  const rawPage = query.page ?? '1';
  const rawLimit = query.limit ?? String(defaultLimit);
  const page = Number(rawPage);
  const limit = Number(rawLimit);
  if (!Number.isInteger(page) || page < 1) return 'El parámetro "page" debe ser un entero mayor o igual a 1';
  if (!Number.isInteger(limit) || limit < 1) return 'El parámetro "limit" debe ser un entero mayor o igual a 1';
  const lim = Math.min(limit, maxLimit);
  return { page, limit: lim, skip: (page - 1) * lim };
}

/** Parsea un id numérico de query/params. Devuelve null si no es un entero positivo. */
export function parseId(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}
