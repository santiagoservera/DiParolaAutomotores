import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

export const MENSAJE_FORMATO_NO_PERMITIDO = 'Formato no permitido. Usá JPG, PNG, WEBP, HEIC o PDF';

/** Error de formato de archivo rechazado (traducido a 400 por el handler de errores de upload). */
export class FormatoNoPermitidoError extends Error {
  constructor(message = MENSAJE_FORMATO_NO_PERMITIDO) {
    super(message);
    this.name = 'FormatoNoPermitidoError';
  }
}

/** Error de formato en la importación de Excel. */
export class ExcelFormatoError extends Error {
  constructor(message = 'Solo se permiten archivos Excel (.xlsx, .xls)') {
    super(message);
    this.name = 'ExcelFormatoError';
  }
}

const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf'];

function extension(file: Express.Multer.File): string {
  const m = (file.originalname || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

function esPdf(file: Express.Multer.File): boolean {
  return file.mimetype === 'application/pdf' || extension(file) === 'pdf';
}

function esHeic(file: Express.Multer.File): boolean {
  const ext = extension(file);
  return ext === 'heic' || ext === 'heif' || /image\/hei[cf]/.test(file.mimetype || '');
}

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = extension(file);
  const mimeOk = /^image\/(jpe?g|png|webp|hei[cf])$/.test(file.mimetype || '') || file.mimetype === 'application/pdf';
  if (ALLOWED_FORMATS.includes(ext) || mimeOk) cb(null, true);
  else cb(new FormatoNoPermitidoError());
};

function crearStorage(folder: string) {
  return new CloudinaryStorage({
    cloudinary,
    // params como función para distinguir imágenes de PDFs (los PDFs no se convierten ni redimensionan)
    params: async (_req: any, file: Express.Multer.File) => {
      if (esPdf(file)) {
        return { folder, allowed_formats: ALLOWED_FORMATS };
      }
      return {
        folder,
        allowed_formats: ALLOWED_FORMATS,
        transformation: [{ width: 1200, crop: 'limit', quality: 'auto' }],
        // HEIC/HEIF no se visualiza en navegadores: se convierte a JPG
        ...(esHeic(file) ? { format: 'jpg' } : {}),
      };
    },
  } as any);
}

export const upload = multer({ storage: crearStorage('diparola/contratos'), fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

export const uploadComprobante = multer({ storage: crearStorage('diparola/comprobantes'), fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

/** Elimina de Cloudinary un archivo recién subido (para no dejar huérfanos si falla la validación o el insert en DB). */
export async function destruirSubida(file: Express.Multer.File | undefined): Promise<void> {
  const publicId = (file as any)?.filename;
  if (!publicId) return;
  try {
    // Sin resource_type explícito en el upload, Cloudinary guarda imágenes y PDFs como 'image'
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  } catch {
    // silencioso: best effort
  }
}
