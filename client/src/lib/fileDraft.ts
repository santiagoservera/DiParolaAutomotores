// Helpers para fotos tomadas desde mobile:
// - compressImage: reduce fotos de cámara (4-12MB) a JPEG ~1600px para bajar memoria y peso de subida.
// - saveDraftFiles / loadDraftFiles / clearDraft: persisten archivos pendientes en IndexedDB para
//   sobrevivir a que el SO descarte la pestaña mientras la app de cámara está abierta.

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.8;

async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch { /* fallback a <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  let decoded: Awaited<ReturnType<typeof decodeImage>> | null = null;
  try {
    decoded = await decodeImage(file);
    const { width, height } = decoded;
    if (!width || !height) return file;
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(decoded.source, 0, 0, w, h);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    canvas.width = 0;
    canvas.height = 0;
    if (!blob) return file;
    // Si por algún motivo el resultado es más pesado que el original (imagen chica ya comprimida), usar el original
    if (blob.size >= file.size && scale === 1) return file;
    const baseName = (file.name || 'foto').replace(/\.[^.]+$/, '') || 'foto';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    try { decoded?.release(); } catch { /* noop */ }
  }
}

// ── IndexedDB draft storage ────────────────────────────────────────────────

const DB_NAME = 'diparola-drafts';
const STORE = 'files';

export interface DraftFile { tipo: string; file: File; }

interface StoredDraftFile { tipo: string; blob: Blob; name: string; type: string; lastModified: number; }

function openDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveDraftFiles(key: string, files: DraftFile[]): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    const value: StoredDraftFile[] = files.map(f => ({
      tipo: f.tipo, blob: f.file, name: f.file.name, type: f.file.type, lastModified: f.file.lastModified,
    }));
    await new Promise<void>(resolve => {
      try {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        if (value.length === 0) store.delete(key); else store.put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch { resolve(); }
    });
    db.close();
  } catch { /* degradar silenciosamente */ }
}

export async function loadDraftFiles(key: string): Promise<DraftFile[]> {
  try {
    const db = await openDb();
    if (!db) return [];
    const value = await new Promise<StoredDraftFile[] | undefined>(resolve => {
      try {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result as StoredDraftFile[] | undefined);
        req.onerror = () => resolve(undefined);
      } catch { resolve(undefined); }
    });
    db.close();
    if (!Array.isArray(value)) return [];
    return value
      .filter(v => v && v.blob && v.tipo)
      .map(v => ({
        tipo: v.tipo,
        file: v.blob instanceof File ? v.blob : new File([v.blob], v.name || 'archivo', { type: v.type || v.blob.type, lastModified: v.lastModified || Date.now() }),
      }));
  } catch {
    return [];
  }
}

export async function clearDraft(key: string): Promise<void> {
  return saveDraftFiles(key, []);
}
