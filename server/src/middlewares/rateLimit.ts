import { Request, Response, NextFunction } from 'express';

/**
 * Rate limiter in-memory simple (sin dependencias): ventana deslizante por IP.
 * Nota: el estado vive en el proceso; si se corren varias instancias, cada una cuenta por separado.
 */
export function rateLimit(opts: { max: number; windowMs: number; mensaje?: string }) {
  const hits = new Map<string, number[]>();

  // Limpieza periódica de IPs sin actividad reciente
  const timer = setInterval(() => {
    const limite = Date.now() - opts.windowMs;
    for (const [ip, timestamps] of hits) {
      const vigentes = timestamps.filter(t => t > limite);
      if (vigentes.length === 0) hits.delete(ip);
      else hits.set(ip, vigentes);
    }
  }, Math.min(opts.windowMs, 5 * 60 * 1000));
  timer.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'desconocida';
    const ahora = Date.now();
    const limite = ahora - opts.windowMs;
    const vigentes = (hits.get(ip) || []).filter(t => t > limite);

    if (vigentes.length >= opts.max) {
      const retryMs = vigentes[0] + opts.windowMs - ahora;
      const minutos = Math.max(1, Math.ceil(retryMs / 60000));
      res.setHeader('Retry-After', String(Math.ceil(retryMs / 1000)));
      hits.set(ip, vigentes);
      return res.status(429).json({
        error: opts.mensaje || `Demasiados intentos. Probá de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`,
      });
    }

    vigentes.push(ahora);
    hits.set(ip, vigentes);
    next();
  };
}
