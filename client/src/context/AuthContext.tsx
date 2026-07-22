import { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  tienePermiso: (modulo: string, accion: 'leer' | 'crear' | 'editar' | 'eliminar') => boolean;
  puedeVerTodos: (modulo: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  // Cargar usuario si hay token guardado
  useEffect(() => {
    if (token) {
      authService.me()
        .then(res => {
          const data = res.data;
          setUsuario({
            ...data,
            permisos: data.rol?.permisos || [],
          });
        })
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
          setUsuario(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authService.login(email, password);
    const { token: newToken, usuario: userData } = res.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUsuario(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUsuario(null);
  }, []);

  const tienePermiso = useCallback((modulo: string, accion: 'leer' | 'crear' | 'editar' | 'eliminar') => {
    if (!usuario) return false;
    const permisos = usuario.permisos || usuario.rol?.permisos || [];
    const permiso = permisos.find(p => p.modulo === modulo);
    return permiso ? permiso[accion] : false;
  }, [usuario]);

  const puedeVerTodos = useCallback((modulo: string) => {
    if (!usuario) return false;
    // Administrador always sees all
    const permisos = usuario.permisos || usuario.rol?.permisos || [];
    const configPerm = permisos.find(p => p.modulo === 'CONFIGURACION');
    if (configPerm?.leer) return true; // Admin
    const permiso = permisos.find(p => p.modulo === modulo);
    return permiso?.verTodos ?? false;
  }, [usuario]);

  return (
    <AuthContext.Provider value={{ usuario, token, isLoading, login, logout, tienePermiso, puedeVerTodos }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
