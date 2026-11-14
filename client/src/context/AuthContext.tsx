import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { authService } from '@/services/api';

export interface Permiso {
  id: number;
  rolId: number;
  modulo: string;
  leer: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
  verTodos: boolean;
}

export interface Rol {
  id: number;
  nombre: string;
  permisos?: Permiso[];
}

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  permisos?: Permiso[];
}

interface AuthContextType {
  usuario: Usuario | null;
  token: string | null;
  isLoading: boolean;
  /** true si hay token pero no se pudo contactar al server para validarlo */
  connectionError: boolean;
  /** Reintenta validar el token guardado contra el server */
  retry: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  tienePermiso: (modulo: string, accion: 'leer' | 'crear' | 'editar' | 'eliminar') => boolean;
  puedeVerTodos: (modulo: string) => boolean;
  esAdmin: () => boolean;
  puedeEditar: (modulo: string, registradoPorId?: number) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const usuarioRef = useRef<Usuario | null>(null);
  usuarioRef.current = usuario;

  // Cargar usuario si hay token guardado.
  // Solo se descarta el token si el server lo rechaza (401/404). Ante errores de red / 5xx
  // (mala señal tras recargar, deploy en curso) se conserva y se reintenta.
  useEffect(() => {
    if (!token) {
      setConnectionError(false);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const delays = [1000, 2000, 4000];
    // Mostrar carga solo si todavía no hay usuario (tras login() ya está seteado: revalidar en segundo plano)
    if (!usuarioRef.current) setIsLoading(true);
    setConnectionError(false);

    const attempt = (n: number) => {
      authService.me()
        .then(res => {
          if (cancelled) return;
          const data = res.data;
          setUsuario({
            ...data,
            permisos: data.rol?.permisos || [],
          });
          setConnectionError(false);
          setIsLoading(false);
        })
        .catch(err => {
          if (cancelled) return;
          const status = err?.response?.status;
          if (status === 401 || status === 404) {
            localStorage.removeItem('token');
            setToken(null);
            setUsuario(null);
            setIsLoading(false);
            return;
          }
          if (n < delays.length) {
            timer = setTimeout(() => attempt(n + 1), delays[n]);
            return;
          }
          // Sin conexión con el server: conservar el token, no desloguear
          setUsuario(null);
          setConnectionError(true);
          setIsLoading(false);
        });
    };
    attempt(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, retryNonce]);

  const retry = useCallback(() => {
    setRetryNonce(n => n + 1);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authService.login(email, password);
    const { token: newToken, usuario: userData } = res.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUsuario(userData);
  }, []);

  // Ojo: logout NO toca los borradores (contratoDraft:*, contratoEdit:session, IndexedDB)
  // para que al volver a loguearse se recupere el trabajo en curso.
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUsuario(null);
    setConnectionError(false);
  }, []);

  // El interceptor de axios avisa cuando una request devuelve 401
  useEffect(() => {
    const onLogout = () => logout();
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [logout]);

  const tienePermiso = useCallback((modulo: string, accion: 'leer' | 'crear' | 'editar' | 'eliminar') => {
    if (!usuario) return false;
    const permisos = usuario.permisos || usuario.rol?.permisos || [];
    const permiso = permisos.find(p => p.modulo === modulo);
    return permiso ? permiso[accion] : false;
  }, [usuario]);

  const puedeVerTodos = useCallback((modulo: string) => {
    if (!usuario) return false;
    const permisos = usuario.permisos || usuario.rol?.permisos || [];
    const configPerm = permisos.find(p => p.modulo === 'CONFIGURACION');
    if (configPerm?.leer) return true;
    const permiso = permisos.find(p => p.modulo === modulo);
    return permiso?.verTodos ?? false;
  }, [usuario]);

  const esAdmin = useCallback(() => {
    if (!usuario) return false;
    const permisos = usuario.permisos || usuario.rol?.permisos || [];
    const configPerm = permisos.find(p => p.modulo === 'CONFIGURACION');
    return configPerm?.leer ?? false;
  }, [usuario]);

  const puedeEditar = useCallback((modulo: string, registradoPorId?: number) => {
    if (!usuario) return false;
    const permisos = usuario.permisos || usuario.rol?.permisos || [];
    const permiso = permisos.find(p => p.modulo === modulo);
    if (!permiso?.editar) return false;
    // Admin puede editar todo
    const configPerm = permisos.find(p => p.modulo === 'CONFIGURACION');
    if (configPerm?.leer) return true;
    // Si no se pasa registradoPorId, puede editar (es su propio registro o no se sabe)
    if (registradoPorId === undefined) return true;
    // Solo puede editar si es suyo
    return usuario.id === registradoPorId;
  }, [usuario]);

  return (
    <AuthContext.Provider value={{ usuario, token, isLoading, connectionError, retry, login, logout, tienePermiso, puedeVerTodos, esAdmin, puedeEditar }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
