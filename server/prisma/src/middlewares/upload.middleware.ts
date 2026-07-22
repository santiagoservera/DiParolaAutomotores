import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'diparola/contratos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    transformation: [{ width: 1200, quality: 'auto' }],
  } as any,
});

export const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

const comprobanteStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'diparola/comprobantes',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    transformation: [{ width: 1200, quality: 'auto' }],
  } as any,
});

export const uploadComprobante = multer({ storage: comprobanteStorage, limits: { fileSize: 10 * 1024 * 1024 } });
