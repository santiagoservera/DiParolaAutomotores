import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

// Cifrado en reposo de Usuario.passwordVisible (AES-256-GCM).
// Formato: enc:v1:<iv b64>:<tag b64>:<ciphertext b64>  (cabe en VarChar(255) para passwords ≤ 150 bytes)

const PREFIX = 'enc:v1:';
const MAX_PLAIN_BYTES = 150;

let cachedKey: Buffer | null | undefined;

/**
 * Clave derivada de JWT_SECRET (ya presente en el .env): no requiere configuración extra.
 * Si JWT_SECRET cambia, las contraseñas visibles guardadas no se pueden descifrar y hay que resetearlas.
 */
export function getEncKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const secret = (process.env.JWT_SECRET || '').trim();
  cachedKey = secret
    ? crypto.createHash('sha256').update(`diparola:passwordVisible:${secret}`).digest()
    : null;
  return cachedKey;
}

export function isEncrypted(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith('enc:');
}

/** Cifra la contraseña. Sin clave configurada devuelve el texto plano (comportamiento legacy). */
export function encryptPassword(plain: string): string {
  if (Buffer.byteLength(plain, 'utf8') > MAX_PLAIN_BYTES) {
    throw new Error('La contraseña es demasiado larga');
  }
  const key = getEncKey();
  if (!key) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Descifra. Si no tiene prefijo 'enc:' es plaintext legacy y se devuelve tal cual.
 * Lanza error si no se puede descifrar (clave ausente/cambiada o dato corrupto).
 */
export function decryptPassword(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const key = getEncKey();
  if (!key) throw new Error('JWT_SECRET no configurado');
  if (!stored.startsWith(PREFIX)) throw new Error('Versión de cifrado desconocida');
  const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split(':');
  if (!ivB64 || !tagB64 || ctB64 === undefined) throw new Error('Formato cifrado inválido');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}

/**
 * Al iniciar: si hay clave, cifra los passwordVisible que estén en texto plano (idempotente).
 * Sin clave: solo loguea un warning.
 */
export async function migrarPasswordsVisibles(prisma: PrismaClient): Promise<void> {
  if (!getEncKey()) {
    console.warn('[passwordCrypto] ADVERTENCIA: JWT_SECRET no configurado: las contraseñas visibles se guardan SIN cifrar.');
    return;
  }
  const usuarios = await prisma.usuario.findMany({
    where: { passwordVisible: { not: null } },
    select: { id: true, passwordVisible: true },
  });
  let migrados = 0;
  for (const u of usuarios) {
    if (!u.passwordVisible || isEncrypted(u.passwordVisible)) continue;
    try {
      await prisma.usuario.update({
        where: { id: u.id },
        data: { passwordVisible: encryptPassword(u.passwordVisible) },
      });
      migrados++;
    } catch (err: any) {
      console.error(`[passwordCrypto] No se pudo cifrar passwordVisible del usuario ${u.id}: ${err.message}`);
    }
  }
  if (migrados > 0) console.log(`[passwordCrypto] ${migrados} contraseñas visibles cifradas`);
}
