// Cámara dentro de la página (getUserMedia). Evita abrir la app de cámara nativa con
// <input capture>, que manda el navegador a background y en muchos Android hace que el SO
// mate la pestaña (se pierde la foto recién sacada).
// Endurecido para iOS (Safari / Chrome iOS / in-app) y Android (Chrome / Samsung / WebViews):
// timeout de arranque, enganche del stream al <video> cada vez que se monta, play() rechazado,
// frame válido al disparar, fallback de toBlob y pista que termina sola al volver de background.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Check, Loader2, RefreshCw, RotateCcw, SwitchCamera, X } from 'lucide-react';

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;
const SLOW_START_MS = 4000;
const START_TIMEOUT_MS = 15000;
const NOTICE_MS = 3000;

/** true si el navegador permite usar la cámara dentro de la página. */
export function isInPageCameraSupported(): boolean {
  return typeof window !== 'undefined'
    && window.isSecureContext === true
    && typeof navigator !== 'undefined'
    && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

type Status = 'starting' | 'live' | 'preview' | 'error';
type ErrorKind = 'permiso' | 'sinCamara' | 'ocupada' | 'otro';
type Facing = 'environment' | 'user';

const ERROR_TEXT: Record<ErrorKind, { title: string; detail: string }> = {
  permiso: {
    title: 'Sin acceso a la cámara',
    detail: 'Permití el acceso a la cámara en la configuración del navegador y tocá "Reintentar".',
  },
  sinCamara: {
    title: 'No se encontró una cámara',
    detail: 'Este dispositivo no tiene una cámara disponible para el navegador.',
  },
  ocupada: {
    title: 'La cámara está ocupada',
    detail: 'Otra app está usando la cámara. Cerrala y tocá "Reintentar".',
  },
  otro: {
    title: 'No se pudo abrir la cámara',
    detail: 'Probá de nuevo o usá la cámara del teléfono.',
  },
};

function errorKindFrom(err: unknown): ErrorKind {
  const name = (err as { name?: string } | null)?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'permiso';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'sinCamara';
  if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') return 'ocupada';
  return 'otro';
}

function dataUrlToBlob(url: string): Blob | null {
  const comma = url.indexOf(',');
  if (comma < 0) return null;
  const head = url.slice(0, comma);
  const data = url.slice(comma + 1);
  if (!data || !/;base64$/i.test(head)) return null; // 'data:,' = canvas vacío / no soportado
  const mime = /^data:([^;,]+)/i.exec(head)?.[1] || 'image/jpeg';
  try {
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

/** canvas → JPEG. Si toBlob no existe o devuelve null (WebViews viejos) usa toDataURL. */
function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise(resolve => {
    const viaDataUrl = () => {
      try { resolve(dataUrlToBlob(canvas.toDataURL('image/jpeg', quality))); } catch { resolve(null); }
    };
    if (typeof canvas.toBlob !== 'function') { viaDataUrl(); return; }
    try {
      canvas.toBlob(b => (b ? resolve(b) : viaDataUrl()), 'image/jpeg', quality);
    } catch {
      viaDataUrl();
    }
  });
}

/** Espera a que el <video> pinte un frame nuevo (con tope por si está pausado). */
function waitForFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    const rvfc = (video as unknown as { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback;
    if (typeof rvfc === 'function') {
      try { rvfc.call(video, finish); } catch { requestAnimationFrame(() => finish()); }
    } else {
      requestAnimationFrame(() => finish());
    }
    setTimeout(finish, 300);
  });
}

export interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  /** Se llama cuando no se puede usar la cámara en la página: usar el <input capture> nativo. */
  onFallback: () => void;
  title?: string;
}

export function CameraCapture({ open, onClose, onCapture, onFallback, title }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const slowTimerRef = useRef<number | null>(null);
  const hardTimerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const endedRestartsRef = useRef(0);
  const [status, setStatusState] = useState<Status>('starting');
  const [errorKind, setErrorKind] = useState<ErrorKind>('otro');
  const [facing, setFacing] = useState<Facing>('environment');
  const [actualFacing, setActualFacing] = useState<Facing>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [slowStart, setSlowStart] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const statusRef = useRef<Status>('starting');
  statusRef.current = status;

  const setStatus = useCallback((s: Status) => {
    statusRef.current = s;
    if (mountedRef.current) setStatusState(s);
  }, []);

  const clearStartTimers = useCallback(() => {
    if (slowTimerRef.current != null) { clearTimeout(slowTimerRef.current); slowTimerRef.current = null; }
    if (hardTimerRef.current != null) { clearTimeout(hardTimerRef.current); hardTimerRef.current = null; }
  }, []);

  const showNotice = useCallback((msg: string) => {
    if (!mountedRef.current) return;
    setNotice(msg);
    if (noticeTimerRef.current != null) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => {
      noticeTimerRef.current = null;
      if (mountedRef.current) setNotice(null);
    }, NOTICE_MS);
  }, []);

  const stopStream = useCallback(() => {
    requestIdRef.current++; // invalida cualquier getUserMedia en curso
    clearStartTimers();
    const s = streamRef.current;
    streamRef.current = null;
    if (s) s.getTracks().forEach(t => { t.onended = null; try { t.stop(); } catch { /* noop */ } });
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [clearStartTimers]);

  const tryPlay = useCallback((video: HTMLVideoElement) => {
    let p: Promise<void> | undefined;
    try { p = video.play(); } catch (e) { p = Promise.reject(e); }
    if (!p || typeof p.then !== 'function') return;
    p.then(() => {
      if (mountedRef.current && videoRef.current === video) setNeedsTap(false);
    }).catch((e: unknown) => {
      // AbortError = otro load interrumpió este play (cambio de srcObject): no es un rechazo real
      if ((e as { name?: string } | null)?.name === 'AbortError') return;
      if (!mountedRef.current || videoRef.current !== video || !streamRef.current) return;
      if (video.srcObject !== streamRef.current) return;
      setNeedsTap(true);
    });
  }, []);

  /** Engancha el stream actual al <video> (cada vez que se monta o llega un stream nuevo). */
  const attachStream = useCallback((video: HTMLVideoElement) => {
    const stream = streamRef.current;
    if (!stream) return;
    // Safari necesita muted/playsinline como atributos reales para autoplay inline
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    if (video.srcObject !== stream) video.srcObject = stream;
    tryPlay(video);
  }, [tryPlay]);

  const setVideoEl = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el) attachStream(el);
  }, [attachStream]);

  // El video ya tiene frames con dimensiones reales → recién ahí 'live'
  const onVideoReady = useCallback(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || video.srcObject !== stream) return;
    if (!video.videoWidth || !video.videoHeight) return;
    if (statusRef.current !== 'starting') return;
    const reqId = requestIdRef.current;
    clearStartTimers();
    setSlowStart(false);
    setStatus('live');
    (async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!mountedRef.current || reqId !== requestIdRef.current) return;
        setHasMultipleCameras(devices.filter(d => d.kind === 'videoinput').length > 1);
      } catch { /* noop */ }
    })();
  }, [clearStartTimers, setStatus]);

  const startStreamRef = useRef<(opts?: { fromEnded?: boolean }) => void>(() => {});

  const armStartTimers = useCallback((reqId: number) => {
    clearStartTimers();
    slowTimerRef.current = window.setTimeout(() => {
      slowTimerRef.current = null;
      if (!mountedRef.current || reqId !== requestIdRef.current) return;
      if (statusRef.current === 'starting') setSlowStart(true);
    }, SLOW_START_MS);
    hardTimerRef.current = window.setTimeout(() => {
      hardTimerRef.current = null;
      if (!mountedRef.current || reqId !== requestIdRef.current) return;
      if (statusRef.current !== 'starting') return;
      // Si ya teníamos stream pero el video nunca arrancó, liberar la cámara.
      // Si getUserMedia sigue pendiente, se deja vigente: si resuelve después, se usa.
      if (streamRef.current) stopStream();
      setNeedsTap(false);
      setErrorKind('otro');
      setStatus('error');
    }, START_TIMEOUT_MS);
  }, [clearStartTimers, setStatus, stopStream]);

  const startStream = useCallback(async (opts?: { fromEnded?: boolean }) => {
    stopStream();
    const reqId = ++requestIdRef.current;
    if (!opts?.fromEnded) endedRestartsRef.current = 0;
    setSlowStart(false);
    setNeedsTap(false);
    setStatus('starting');
    armStartTimers(reqId);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (!mountedRef.current || reqId !== requestIdRef.current || statusRef.current === 'preview') {
        stream.getTracks().forEach(t => { try { t.stop(); } catch { /* noop */ } });
        return;
      }
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      if (track) {
        // En iPhone con varias traseras facingMode puede no alternar: se deja la que vino
        let real: string | undefined;
        try { real = track.getSettings?.().facingMode; } catch { /* noop */ }
        setActualFacing(real === 'user' || real === 'environment' ? real : facing);

        // iOS: al volver de background la pista puede quedar 'ended' sin visibilitychange
        track.onended = () => {
          if (!mountedRef.current || reqId !== requestIdRef.current) return;
          if (document.visibilityState === 'hidden') return; // lo maneja visibilitychange
          const st = statusRef.current;
          if (st !== 'live' && st !== 'starting') return;
          if (endedRestartsRef.current < 1) {
            endedRestartsRef.current++;
            startStreamRef.current({ fromEnded: true });
          } else {
            stopStream();
            setNeedsTap(false);
            setErrorKind('otro');
            setStatus('error');
          }
        };
      }

      if (statusRef.current === 'error') {
        // Resolvió después del timeout: volver a mostrar el visor (el <video> se monta y engancha)
        setStatus('starting');
        armStartTimers(reqId);
        setSlowStart(true);
      }
      const video = videoRef.current;
      if (video) {
        attachStream(video);
        onVideoReady(); // por si ya tenía metadata
      }
    } catch (err) {
      if (!mountedRef.current || reqId !== requestIdRef.current) return;
      clearStartTimers();
      setErrorKind(errorKindFrom(err));
      setStatus('error');
    }
  }, [facing, stopStream, armStartTimers, attachStream, onVideoReady, clearStartTimers, setStatus]);

  startStreamRef.current = startStream;

  // Sin soporte: no mostrar el modal, ir directo al input nativo
  useEffect(() => {
    if (open && !isInPageCameraSupported()) {
      onClose();
      onFallback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Arrancar / reiniciar el stream al abrir o cambiar de cámara
  useEffect(() => {
    if (!open || !isInPageCameraSupported()) return;
    if (statusRef.current === 'preview') return;
    startStream();
    return () => stopStream();
  }, [open, startStream, stopStream]);

  // Al pasar a background liberar la cámara; al volver, pedirla de nuevo
  useEffect(() => {
    if (!open) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopStream();
      } else if (statusRef.current !== 'preview' && statusRef.current !== 'error') {
        startStreamRef.current();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [open, stopStream]);

  // Reset al cerrar
  useEffect(() => {
    if (open) return;
    stopStream();
    setPhoto(prev => { if (prev) URL.revokeObjectURL(prev.url); return null; });
    setStatus('starting');
    setCapturing(false);
    setSlowStart(false);
    setNeedsTap(false);
    setNotice(null);
    endedRestartsRef.current = 0;
  }, [open, stopStream, setStatus]);

  // Detener todo al desmontar
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopStream();
      if (noticeTimerRef.current != null) { clearTimeout(noticeTimerRef.current); noticeTimerRef.current = null; }
    };
  }, [stopStream]);

  // Liberar el objectURL de la foto si se desmonta con una vista previa abierta
  const photoRef = useRef(photo);
  photoRef.current = photo;
  useEffect(() => () => { if (photoRef.current) URL.revokeObjectURL(photoRef.current.url); }, []);

  // Bloquear scroll del body mientras está abierto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const handleShoot = async () => {
    const video = videoRef.current;
    if (!video || status !== 'live' || capturing || needsTap) return;
    if (!video.videoWidth || !video.videoHeight) {
      showNotice('La cámara todavía no está lista. Probá de nuevo en un segundo.');
      return;
    }
    const reqId = requestIdRef.current;
    setCapturing(true);
    try {
      await waitForFrame(video);
      if (!mountedRef.current || reqId !== requestIdRef.current || statusRef.current !== 'live') return;
      // Dimensiones reales del frame en este momento (reflejan la orientación actual)
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) {
        showNotice('La cámara todavía no está lista. Probá de nuevo en un segundo.');
        return;
      }
      const scale = Math.min(1, MAX_SIDE / Math.max(vw, vh));
      const w = Math.round(vw * scale);
      const h = Math.round(vh * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        showNotice('No se pudo sacar la foto. Probá de nuevo.');
        return;
      }
      ctx.drawImage(video, 0, 0, w, h);
      const blob = await canvasToJpeg(canvas, JPEG_QUALITY);
      canvas.width = 0;
      canvas.height = 0;
      if (!mountedRef.current || reqId !== requestIdRef.current) return;
      if (!blob) {
        showNotice('No se pudo sacar la foto. Probá de nuevo.');
        return;
      }
      stopStream();
      setPhoto(prev => { if (prev) URL.revokeObjectURL(prev.url); return { blob, url: URL.createObjectURL(blob) }; });
      setStatus('preview');
    } finally {
      if (mountedRef.current) setCapturing(false);
    }
  };

  const handleTapToPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    // Gesto de usuario: iOS permite play() aunque haya rechazado el autoplay
    video.muted = true;
    let p: Promise<void> | undefined;
    try { p = video.play(); } catch { p = undefined; }
    if (p && typeof p.then === 'function') {
      p.then(() => {
        if (!mountedRef.current) return;
        setNeedsTap(false);
        onVideoReady();
      }).catch(() => {
        if (mountedRef.current) showNotice('No se pudo activar la cámara. Probá de nuevo o usá la cámara del teléfono.');
      });
    } else {
      setNeedsTap(false);
    }
  };

  const handleRetake = () => {
    setPhoto(prev => { if (prev) URL.revokeObjectURL(prev.url); return null; });
    statusRef.current = 'starting';
    startStream();
  };

  const handleUse = () => {
    if (!photo) return;
    const type = photo.blob.type || 'image/jpeg';
    const ext = type === 'image/png' ? 'png' : 'jpg';
    const file = new File([photo.blob], `foto-${Date.now()}.${ext}`, { type, lastModified: Date.now() });
    stopStream();
    onCapture(file);
    onClose();
  };

  const handleClose = () => {
    stopStream();
    onClose();
  };

  const handleFallback = () => {
    stopStream();
    onClose();
    onFallback();
  };

  if (!open || !isInPageCameraSupported()) return null;

  const err = ERROR_TEXT[errorKind];

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black flex flex-col select-none" role="dialog" aria-modal="true" aria-label={title || 'Cámara'}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-black/70 to-transparent">
        <span className="text-sm font-semibold text-white truncate">{title || 'Sacar foto'}</span>
        <button type="button" onClick={handleClose} aria-label="Cerrar cámara"
          className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center cursor-pointer hover:bg-black/70">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Visor */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {status !== 'preview' && status !== 'error' && (
          <video ref={setVideoEl} autoPlay playsInline muted
            onLoadedMetadata={onVideoReady} onLoadedData={onVideoReady} onPlaying={onVideoReady}
            className="w-full h-full object-contain"
            style={actualFacing === 'user' ? { transform: 'scaleX(-1)' } : undefined} />
        )}
        {status === 'preview' && photo && (
          <img src={photo.url} alt="Vista previa" className="w-full h-full object-contain" />
        )}
        {status === 'starting' && !needsTap && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-[#8892b0]">
            <Loader2 className="w-8 h-8 text-[#4a6fd4] animate-spin" />
            <span className="text-sm">Abriendo cámara...</span>
            {slowStart && (
              <>
                <span className="text-xs text-[#8892b0]/80 max-w-xs">Si el navegador te pide permiso, tocá Permitir</span>
                <button type="button" onClick={handleFallback}
                  className="mt-2 h-11 px-4 rounded-lg border border-[#4a6fd4]/30 bg-[#1a2040] hover:border-[#4a6fd4]/60 text-[#c8d0ea] text-sm font-medium flex items-center justify-center gap-2 cursor-pointer">
                  <Camera className="w-4 h-4" /> Usar la cámara del teléfono
                </button>
              </>
            )}
          </div>
        )}
        {(status === 'starting' || status === 'live') && needsTap && (
          <button type="button" onClick={handleTapToPlay}
            className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 bg-black/60 text-white cursor-pointer">
            <span className="w-14 h-14 rounded-full bg-[#4a6fd4]/20 flex items-center justify-center">
              <Camera className="w-7 h-7 text-[#4a6fd4]" />
            </span>
            <span className="text-sm font-medium">Tocá para activar la cámara</span>
          </button>
        )}
        {status === 'error' && (
          <div className="mx-4 max-w-sm w-full rounded-xl border border-[#4a6fd4]/15 bg-[#131729] p-5 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#4a6fd4]/10 flex items-center justify-center">
              <Camera className="w-6 h-6 text-[#4a6fd4]" />
            </div>
            <h3 className="text-white font-semibold mb-1">{err.title}</h3>
            <p className="text-sm text-[#8892b0] mb-5">{err.detail}</p>
            <div className="flex flex-col gap-2">
              {errorKind !== 'sinCamara' && (
                <button type="button" onClick={() => startStream()}
                  className="h-11 rounded-lg bg-[#4a6fd4] hover:bg-[#2648a1] text-white text-sm font-medium flex items-center justify-center gap-2 cursor-pointer">
                  <RefreshCw className="w-4 h-4" /> Reintentar
                </button>
              )}
              <button type="button" onClick={handleFallback}
                className="h-11 rounded-lg border border-[#4a6fd4]/30 bg-[#1a2040] hover:border-[#4a6fd4]/60 text-[#c8d0ea] text-sm font-medium flex items-center justify-center gap-2 cursor-pointer">
                <Camera className="w-4 h-4" /> Usar la cámara del teléfono
              </button>
            </div>
          </div>
        )}
        {notice && (
          <div role="status" aria-live="polite"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[6] max-w-[90%] rounded-lg bg-[#131729]/95 border border-[#4a6fd4]/30 px-4 py-2 text-sm text-white text-center shadow-lg">
            {notice}
          </div>
        )}
      </div>

      {/* Controles */}
      {(status === 'live' || status === 'starting') && (
        <div className="relative flex items-center justify-center px-6 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-black">
          <button type="button" onClick={handleShoot} disabled={status !== 'live' || capturing || needsTap} aria-label="Sacar foto"
            className="w-[72px] h-[72px] rounded-full border-4 border-white bg-white/20 active:bg-white/60 flex items-center justify-center disabled:opacity-40 cursor-pointer transition-colors">
            {capturing ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <span className="w-14 h-14 rounded-full bg-white" />}
          </button>
          {hasMultipleCameras && (
            <button type="button" onClick={() => setFacing(f => (f === 'environment' ? 'user' : 'environment'))}
              disabled={status !== 'live'} aria-label="Cambiar cámara"
              className="absolute right-6 w-12 h-12 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer disabled:opacity-40 hover:bg-white/25">
              <SwitchCamera className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
      {status === 'preview' && (
        <div className="flex items-center justify-center gap-3 px-6 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-black">
          <button type="button" onClick={handleRetake}
            className="flex-1 max-w-[180px] h-12 rounded-lg border border-white/30 text-white text-sm font-medium flex items-center justify-center gap-2 cursor-pointer hover:bg-white/10">
            <RotateCcw className="w-4 h-4" /> Repetir
          </button>
          <button type="button" onClick={handleUse}
            className="flex-1 max-w-[180px] h-12 rounded-lg bg-[#4a6fd4] hover:bg-[#2648a1] text-white text-sm font-medium flex items-center justify-center gap-2 cursor-pointer">
            <Check className="w-4 h-4" /> Usar foto
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
