import { Response } from 'express';

export function handleError(error: any, contexto: string, res: Response) {
  console.error(`Error en ${contexto}:`, error);

  if (error.code === 'P2002') {
    return res.status(409).json({ error: 'Ya existe un registro con esos datos (valor duplicado)' });
  }
  if (error.code === 'P2003') {
    return res.status(400).json({ error: 'Referencia inválida: uno de los datos relacionados no existe' });
  }
  if (error.code === 'P2025') {
    return res.status(404).json({ error: 'No se encontró el registro a modificar' });
  }
  if (error.name === 'PrismaClientValidationError') {
    return res.status(400).json({ error: `Datos inválidos al ${contexto}. Revisá los campos e intentá de nuevo.` });
  }
  if (error.message?.includes('Cloudinary') || error.message?.includes('cloudinary')) {
    return res.status(500).json({ error: 'Error al procesar el archivo. Intentá con otro archivo o formato.' });
  }

  const detalle = error.message ? error.message.substring(0, 150) : 'Error desconocido';
  res.status(500).json({ error: `Error al ${contexto}. Detalle: ${detalle}` });
}
