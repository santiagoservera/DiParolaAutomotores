import { Response } from 'express';

/** Error con status HTTP, para cortar una transacción y responder un mensaje claro. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

export function handleError(error: any, contexto: string, res: Response) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error(`Error en ${contexto}:`, error);

  if (error.code === 'P2000') {
    const campo = error.meta?.column_name || error.meta?.target || null;
    return res.status(400).json({
      error: campo ? `Valor demasiado largo en ${campo}` : 'Uno de los valores ingresados es demasiado largo',
      ...(campo ? { campo } : {}),
    });
  }
  // Decimal.js: new Prisma.Decimal('abc') lanza "[DecimalError] Invalid argument"
  if (error.name === 'DecimalError' || /DecimalError/.test(error.message || '')) {
    return res.status(400).json({ error: 'Valor numérico inválido. Revisá los montos ingresados.' });
  }

  if (error.code === 'P2002') {
    const campos = (error.meta?.target as string[]) || [];
    const labels: Record<string, string> = {
      numeroContrato: 'Nro. de Solicitud',
      solicitanteDni: 'DNI del solicitante',
      email: 'Email',
    };
    const campoLegible = campos.map((c: string) => labels[c] || c).join(', ');
    const msg = campoLegible
      ? `Ya existe un registro con ese ${campoLegible}`
      : 'Ya existe un registro con esos datos (valor duplicado)';
    return res.status(409).json({ error: msg });
  }
  if (error.code === 'P2003') {
    return res.status(400).json({ error: 'Referencia inválida: uno de los datos relacionados no existe' });
  }
  if (error.code === 'P2025') {
    return res.status(404).json({ error: 'No se encontró el registro a modificar' });
  }
  if (error.name === 'PrismaClientValidationError') {
    const msg = error.message || '';
    const fieldMatch = msg.match(/Argument `(\w+)`/);
    const typeMatch = msg.match(/needs to be (\w+)/i) || msg.match(/provided (\w+)/i);
    const fieldLabels: Record<string, string> = {
      solicitanteFechaNac: 'Fecha de nacimiento',
      conyugeFechaNac: 'Fecha de nacimiento del cónyuge',
      anticipoMensual: 'Anticipo mensual',
      montoDevolucion: 'Monto devolución',
      montoSellado: 'Sellado',
      fechaVencimiento: 'Fecha de vencimiento',
      fechaPago: 'Fecha de pago',
    };
    const campo = fieldMatch?.[1];
    const label = campo ? fieldLabels[campo] || campo : null;
    const detail = label
      ? `Campo "${label}" tiene un valor inválido. Revisá el dato e intentá de nuevo.`
      : `Datos inválidos al ${contexto}. Revisá los campos e intentá de nuevo.`;
    return res.status(400).json({ error: detail, ...(campo ? { campo } : {}) });
  }
  if (error.message?.includes('Cloudinary') || error.message?.includes('cloudinary')) {
    return res.status(500).json({ error: 'Error al procesar el archivo. Intentá con otro archivo o formato.' });
  }

  const detalle = error.message ? error.message.substring(0, 150) : 'Error desconocido';
  res.status(500).json({ error: `Error al ${contexto}. Detalle: ${detalle}` });
}
