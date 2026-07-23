import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Interceptor: agregar token a cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: manejar errores globales
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      // Importar toast dinámicamente para evitar circular dependency
      import('sonner').then(({ toast }) => {
        toast.error('Sesión expirada. Ingresá nuevamente.');
      });
      window.location.hash = '#admin';
    } else if (!error.response && error.code === 'ECONNABORTED') {
      import('sonner').then(({ toast }) => {
        toast.error('La solicitud tardó demasiado. Intentá de nuevo.');
      });
    } else if (!error.response) {
      import('sonner').then(({ toast }) => {
        toast.error('Error de conexión. Verificá tu internet.');
      });
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authService = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  cambiarPassword: (passwordActual: string, passwordNueva: string) =>
    api.post('/auth/cambiar-password', { passwordActual, passwordNueva }),
};

// ── Usuarios (para selects) ───────────────────────────────────────────────────
export const usuariosService = {
  listar: () => api.get('/configuracion/usuarios'),
};

// ── Contratos ─────────────────────────────────────────────────────────────────
export const contratosService = {
  listar: (params?: Record<string, any>) => api.get('/contratos', { params }),
  obtener: (id: number) => api.get(`/contratos/${id}`),
  crear: (data: any) => api.post('/contratos', data),
  editar: (id: number, data: any) => api.put(`/contratos/${id}`, data),
  cancelar: (id: number) => api.delete(`/contratos/${id}`),
  subirArchivo: (id: number, formData: FormData) =>
    api.post(`/contratos/${id}/archivos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  eliminarArchivo: (id: number, archivoId: number) =>
    api.delete(`/contratos/${id}/archivos/${archivoId}`),
  listarAsesores: () => api.get('/contratos/asesores'),
  statsComoLlego: () => api.get('/contratos/stats/como-llego'),
};

// ── Cobranzas ─────────────────────────────────────────────────────────────────
export const cobranzasService = {
  listar: (params?: Record<string, any>) => api.get('/cobranzas', { params }),
  vencidas: () => api.get('/cobranzas/vencidas'),
  porContrato: (contratoId: number) => api.get(`/cobranzas/contrato/${contratoId}`),
  pagar: (cuotaId: number, data: any) => api.put(`/cobranzas/${cuotaId}/pagar`, data),
  editar: (cuotaId: number, data: any) => api.put(`/cobranzas/${cuotaId}`, data),
  eliminarCuota: (cuotaId: number) => api.delete(`/cobranzas/${cuotaId}`),
  agregarCuota: (contratoId: number, data: any) => api.post(`/cobranzas/contrato/${contratoId}`, data),
  listarObservaciones: (cuotaId: number) => api.get(`/cobranzas/${cuotaId}/observaciones`),
  agregarObservacion: (cuotaId: number, texto: string) => api.post(`/cobranzas/${cuotaId}/observaciones`, { texto }),
  listarComprobantes: (cuotaId: number) => api.get(`/cobranzas/${cuotaId}/comprobantes`),
  subirComprobante: (cuotaId: number, formData: FormData) => api.post(`/cobranzas/${cuotaId}/comprobantes`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  eliminarComprobante: (cuotaId: number, comprobanteId: number) => api.delete(`/cobranzas/${cuotaId}/comprobantes/${comprobanteId}`),
};

// ── Recepción ─────────────────────────────────────────────────────────────────
export const recepcionService = {
  listar: (params?: Record<string, any>) => api.get('/recepcion', { params }),
  citas: (params?: Record<string, any>) => api.get('/recepcion/citas', { params }),
  citasMes: (year: number, month: number) => api.get('/recepcion/citas', {
    params: {
      desde: new Date(year, month, 1).toISOString(),
      hasta: new Date(year, month + 1, 0, 23, 59, 59).toISOString(),
    },
  }),
  obtener: (id: number) => api.get(`/recepcion/${id}`),
  crear: (data: any) => api.post('/recepcion', data),
  editar: (id: number, data: any) => api.put(`/recepcion/${id}`, data),
  eliminar: (id: number) => api.delete(`/recepcion/${id}`),
  crearWeb: (data: any) => api.post('/recepcion/web', data),
  statsComoLlego: () => api.get('/recepcion/stats/como-llego'),
  stats: (params?: Record<string, any>) => api.get('/recepcion/stats', { params }),
};

// ── Importar Excel ────────────────────────────────────────────────────────
export const importarService = {
  preview: (formData: FormData) =>
    api.post('/importar/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  importar: (formData: FormData) =>
    api.post('/importar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// ── Configuración ─────────────────────────────────────────────────────────────
export const configuracionService = {
  // Roles
  listarRoles: () => api.get('/configuracion/roles'),
  obtenerRol: (id: number) => api.get(`/configuracion/roles/${id}`),
  crearRol: (data: any) => api.post('/configuracion/roles', data),
  editarRol: (id: number, data: any) => api.put(`/configuracion/roles/${id}`, data),
  eliminarRol: (id: number) => api.delete(`/configuracion/roles/${id}`),
  actualizarPermisos: (rolId: number, permisos: any[]) =>
    api.put(`/configuracion/roles/${rolId}/permisos`, permisos),
  // Usuarios
  listarUsuarios: () => api.get('/configuracion/usuarios'),
  crearUsuario: (data: any) => api.post('/configuracion/usuarios', data),
  editarUsuario: (id: number, data: any) => api.put(`/configuracion/usuarios/${id}`, data),
  eliminarUsuario: (id: number) => api.delete(`/configuracion/usuarios/${id}`),
  // Módulos
  listarModulos: () => api.get('/configuracion/modulos'),
};
