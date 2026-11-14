import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Card, Input } from '@/components/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { configuracionService } from '@/services/api';
import { toast } from 'sonner';
import { dateFormat } from '@/lib/utils';
import {
  Users, Shield, Plus, Pencil, Trash2, Check, X, Loader2,
  ChevronDown, ChevronUp, Save, UserCog, Eye, EyeOff, Copy,
} from 'lucide-react';

interface UsuarioItem {
  id: number; nombre: string; email: string; tienePasswordVisible?: boolean; activo: boolean;
  fechaCreacion: string; rol: { id: number; nombre: string };
}

interface PermisoItem {
  modulo: string; leer: boolean; crear: boolean; editar: boolean; eliminar: boolean; verTodos: boolean;
}

interface RolItem {
  id: number; nombre: string; descripcion?: string;
  _count?: { usuarios: number }; permisos?: PermisoItem[];
}

type TabKey = 'usuarios' | 'roles';
const MODULOS = ['VENTAS', 'COBRANZAS', 'RECEPCION', 'CONFIGURACION'] as const;
const ACCIONES = ['leer', 'crear', 'editar', 'eliminar', 'verTodos'] as const;
const ACCIONES_LABELS: Record<string, string> = { leer: 'Leer', crear: 'Crear', editar: 'Editar', eliminar: 'Eliminar', verTodos: 'Ver Todos' };

function PermCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`w-7 h-7 rounded-md flex items-center justify-center transition-all cursor-pointer ${checked ? 'bg-[#4a6fd4] shadow-md shadow-[#4a6fd4]/25' : 'bg-[#1a2040] hover:bg-[#232a4a]'}`}>
      {checked && <Check className="w-4 h-4 text-white" />}
    </button>
  );
}

export function ConfiguracionPage() {
  const { tienePermiso } = useAuth();
  const [tab, setTab] = useState<TabKey>('usuarios');
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [roles, setRoles] = useState<RolItem[]>([]);

  // User modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UsuarioItem | null>(null);
  const [userForm, setUserForm] = useState({ nombre: '', email: '', password: '', rolId: 0, activo: true });
  const [showPassword, setShowPassword] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

  // Rol modal
  const [showRolModal, setShowRolModal] = useState(false);
  const [rolForm, setRolForm] = useState({ nombre: '', descripcion: '' });
  const [savingRol, setSavingRol] = useState(false);

  // Confirmar desactivación de usuario
  const [deactivateUser, setDeactivateUser] = useState<UsuarioItem | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // Permisos
  const [expandedRolId, setExpandedRolId] = useState<number | null>(null);
  const [permisosMap, setPermisosMap] = useState<Record<number, PermisoItem[]>>({});
  const [savingPermisos, setSavingPermisos] = useState(false);

  // Contraseñas reveladas (solo en memoria)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<number, string>>({});
  const [loadingPwdId, setLoadingPwdId] = useState<number | null>(null);
  const [copiedPwdId, setCopiedPwdId] = useState<number | null>(null);
  const hideTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => () => {
    Object.values(hideTimers.current).forEach(clearTimeout);
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  function hidePassword(id: number) {
    if (hideTimers.current[id]) { clearTimeout(hideTimers.current[id]); delete hideTimers.current[id]; }
    setRevealedPasswords(prev => { const next = { ...prev }; delete next[id]; return next; });
    setCopiedPwdId(prev => (prev === id ? null : prev));
  }

  async function revealPassword(id: number) {
    if (loadingPwdId !== null) return;
    setLoadingPwdId(id);
    try {
      const res = await configuracionService.verPassword(id);
      const pwd = res.data?.password;
      if (!pwd) { toast.error('No hay contraseña guardada para este usuario'); return; }
      setRevealedPasswords(prev => ({ ...prev, [id]: pwd }));
      if (hideTimers.current[id]) clearTimeout(hideTimers.current[id]);
      hideTimers.current[id] = setTimeout(() => hidePassword(id), 30000);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'No se pudo obtener la contraseña');
    } finally {
      setLoadingPwdId(null);
    }
  }

  async function copyPassword(id: number) {
    const pwd = revealedPasswords[id];
    if (!pwd) return;
    try {
      await navigator.clipboard.writeText(pwd);
      toast.success('Contraseña copiada');
      setCopiedPwdId(id);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedPwdId(null), 2000);
    } catch {
      toast.error('No se pudo copiar la contraseña');
    }
  }

  function renderPassword(u: UsuarioItem) {
    if (!u.tienePasswordVisible) return <span className="text-[#8892b0]/60">—</span>;
    const revealed = revealedPasswords[u.id];
    const isLoading = loadingPwdId === u.id;
    const btn = 'inline-flex items-center justify-center min-w-9 min-h-9 md:min-w-7 md:min-h-7 rounded-md text-[#7b9ae8] hover:text-white hover:bg-[#4a6fd4]/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors';
    return (
      <span className="inline-flex items-center gap-1">
        <span className={`font-mono text-xs ${revealed ? 'text-white select-all break-all' : 'text-[#8892b0]'}`}>
          {revealed ?? '••••••'}
        </span>
        {revealed ? (
          <>
            <button type="button" onClick={() => copyPassword(u.id)} className={btn}
              title="Copiar contraseña" aria-label="Copiar contraseña">
              {copiedPwdId === u.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button type="button" onClick={() => hidePassword(u.id)} className={btn}
              title="Ocultar contraseña" aria-label="Ocultar contraseña">
              <EyeOff className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button type="button" onClick={() => revealPassword(u.id)} disabled={isLoading || loadingPwdId !== null}
            className={btn} title="Ver contraseña" aria-label="Ver contraseña">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </span>
    );
  }

  async function loadData() {
    setLoading(true);
    try {
      const [uRes, rRes] = await Promise.all([
        configuracionService.listarUsuarios(),
        configuracionService.listarRoles(),
      ]);
      setUsuarios(uRes.data);
      setRoles(rRes.data);
    } catch { toast.error('Error al cargar datos'); }
    finally { setLoading(false); }
  }

  // ── User CRUD ──────────────────────────────────────────────────────────

  function openCreateUser() {
    setEditingUser(null);
    setUserForm({ nombre: '', email: '', password: '', rolId: roles[0]?.id ?? 0, activo: true });
    setShowPassword(false);
    setShowUserModal(true);
  }

  function openEditUser(u: UsuarioItem) {
    setEditingUser(u);
    setUserForm({ nombre: u.nombre, email: u.email, password: '', rolId: u.rol.id, activo: u.activo });
    setShowPassword(false);
    setShowUserModal(true);
  }

  async function handleSaveUser() {
    if (!userForm.nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (!userForm.email.trim()) { toast.error('El email es obligatorio'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email)) { toast.error('Email inválido'); return; }
    if (!editingUser && !userForm.password) { toast.error('La contraseña es obligatoria'); return; }
    if (userForm.password && userForm.password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }
    if (!userForm.rolId) { toast.error('Seleccione un rol'); return; }

    setSavingUser(true);
    try {
      if (editingUser) {
        const data: any = { nombre: userForm.nombre, email: userForm.email, rolId: userForm.rolId, activo: userForm.activo };
        if (userForm.password) data.password = userForm.password;
        await configuracionService.editarUsuario(editingUser.id, data);
        toast.success('Usuario actualizado');
      } else {
        await configuracionService.crearUsuario({
          nombre: userForm.nombre, email: userForm.email,
          password: userForm.password, rolId: userForm.rolId,
        });
        toast.success('Usuario creado correctamente');
      }
      setShowUserModal(false);
      await loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.detalles?.fieldErrors?.password?.[0] || 'Error al guardar';
      toast.error(msg);
    } finally {
      setSavingUser(false);
    }
  }

  async function handleDeactivateUser() {
    if (!deactivateUser) return;
    setDeactivating(true);
    try {
      await configuracionService.eliminarUsuario(deactivateUser.id);
      toast.success('Usuario desactivado');
      setDeactivateUser(null);
      await loadData();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Error al desactivar'); }
    finally { setDeactivating(false); }
  }

  // ── Rol CRUD ───────────────────────────────────────────────────────────

  async function handleSaveRol() {
    if (!rolForm.nombre.trim()) { toast.error('El nombre del rol es obligatorio'); return; }
    if (savingRol) return;
    setSavingRol(true);
    try {
      await configuracionService.crearRol(rolForm);
      toast.success('Rol creado'); setShowRolModal(false); await loadData();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Error'); }
    finally { setSavingRol(false); }
  }

  async function handleDeleteRol(id: number) {
    try {
      await configuracionService.eliminarRol(id);
      toast.success('Rol eliminado'); await loadData();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'No se puede eliminar'); }
  }

  // ── Permisos ───────────────────────────────────────────────────────────

  function toggleExpandRol(rol: RolItem) {
    if (expandedRolId === rol.id) { setExpandedRolId(null); return; }
    setExpandedRolId(rol.id);
    if (!permisosMap[rol.id]) {
      const existing = rol.permisos ?? [];
      const permisos = MODULOS.map(modulo => {
        const f = existing.find(p => p.modulo === modulo);
        return f ? { modulo, leer: f.leer, crear: f.crear, editar: f.editar, eliminar: f.eliminar, verTodos: f.verTodos }
          : { modulo, leer: false, crear: false, editar: false, eliminar: false, verTodos: false };
      });
      setPermisosMap(prev => ({ ...prev, [rol.id]: permisos }));
    }
  }

  function updatePermiso(rolId: number, modulo: string, accion: string, value: boolean) {
    setPermisosMap(prev => ({
      ...prev, [rolId]: (prev[rolId] ?? []).map(p => p.modulo === modulo ? { ...p, [accion]: value } : p),
    }));
  }

  async function handleSavePermisos(rolId: number) {
    setSavingPermisos(true);
    try {
      await configuracionService.actualizarPermisos(rolId, permisosMap[rolId]);
      toast.success('Permisos actualizados'); await loadData();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Error'); }
    finally { setSavingPermisos(false); }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#4a6fd4]/10"><UserCog className="w-6 h-6 text-[#7b9ae8]" /></div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Configuración</h1>
          <p className="text-sm text-[#8892b0]">Usuarios, roles y permisos</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#4a6fd4]/8">
        {[{ key: 'usuarios' as TabKey, label: 'Usuarios', icon: Users }, { key: 'roles' as TabKey, label: 'Roles & Permisos', icon: Shield }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
              tab === t.key ? 'text-[#7b9ae8] border-b-2 border-[#4a6fd4]' : 'text-[#8892b0] hover:text-white'
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-[#4a6fd4] animate-spin" /></div>
      ) : tab === 'usuarios' ? (
        /* ── USUARIOS ─────────────────────────────────────────────────── */
        <div className="space-y-4">
          {tienePermiso('CONFIGURACION', 'crear') && (
            <div className="flex justify-end">
              <button onClick={openCreateUser}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white text-sm font-semibold cursor-pointer">
                <Plus className="w-4 h-4" /> Nuevo Usuario
              </button>
            </div>
          )}

          {/* Desktop table */}
          <Card className="bg-[#131729] border-[#4a6fd4]/8 overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#4a6fd4]/8 bg-[#0b0e18]/50">
                  <th className="text-left px-4 py-3 text-[#8892b0] font-medium">Nombre</th>
                  <th className="text-left px-4 py-3 text-[#8892b0] font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-[#8892b0] font-medium hidden lg:table-cell">Contraseña</th>
                  <th className="text-left px-4 py-3 text-[#8892b0] font-medium">Rol</th>
                  <th className="text-center px-4 py-3 text-[#8892b0] font-medium">Estado</th>
                  <th className="text-left px-4 py-3 text-[#8892b0] font-medium hidden lg:table-cell">Creado</th>
                  <th className="text-right px-4 py-3 text-[#8892b0] font-medium">Acciones</th>
                </tr></thead>
                <tbody>
                  {usuarios.map(u => (
                    <tr key={u.id} className="border-b border-[#4a6fd4]/5 hover:bg-[#4a6fd4]/[0.03] transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{u.nombre}</td>
                      <td className="px-4 py-3 text-[#8892b0]">{u.email}</td>
                      <td className="px-4 py-3 text-[#8892b0] text-xs hidden lg:table-cell">{renderPassword(u)}</td>
                      <td className="px-4 py-3"><span className="px-2 py-1 rounded text-xs bg-[#4a6fd4]/15 text-[#7b9ae8]">{u.rol.nombre}</span></td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${u.activo ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#8892b0] text-xs hidden lg:table-cell">{dateFormat(u.fechaCreacion)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditUser(u)} className="p-1.5 rounded-md text-[#7b9ae8] hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer" title="Editar"><Pencil className="w-4 h-4" /></button>
                          {u.activo && <button onClick={() => setDeactivateUser(u)} className="p-1.5 rounded-md text-red-400/50 hover:text-red-400 hover:bg-red-400/10 cursor-pointer" title="Desactivar"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {usuarios.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-[#8892b0]">No hay usuarios</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {usuarios.map(u => (
              <Card key={u.id} className="!bg-[#131729] !border-[#4a6fd4]/8 p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{u.nombre}</div>
                    <div className="text-xs text-[#8892b0] truncate">{u.email}</div>
                    <div className="flex items-center gap-1 text-[10px] text-[#8892b0]/60 mt-0.5">Clave: {renderPassword(u)}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-[#4a6fd4]/15 text-[#7b9ae8]">{u.rol.nombre}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${u.activo ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEditUser(u)} className="p-1.5 rounded-md text-[#7b9ae8] hover:bg-[#4a6fd4]/10 cursor-pointer"><Pencil className="w-4 h-4" /></button>
                    {u.activo && <button onClick={() => setDeactivateUser(u)} className="p-1.5 rounded-md text-red-400/50 hover:text-red-400 cursor-pointer"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        /* ── ROLES & PERMISOS ─────────────────────────────────────────── */
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setRolForm({ nombre: '', descripcion: '' }); setShowRolModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white text-sm font-semibold cursor-pointer">
              <Plus className="w-4 h-4" /> Nuevo Rol
            </button>
          </div>

          <div className="space-y-3">
            {roles.map(rol => {
              const isExpanded = expandedRolId === rol.id;
              const userCount = rol._count?.usuarios ?? 0;
              return (
                <Card key={rol.id} className="!bg-[#131729] !border-[#4a6fd4]/8">
                  <div className="flex items-center justify-between px-4 sm:px-5 py-4 cursor-pointer" onClick={() => toggleExpandRol(rol)}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#4a6fd4]/10"><UserCog className="w-5 h-5 text-[#7b9ae8]" /></div>
                      <div>
                        <h3 className="text-white font-medium">{rol.nombre}</h3>
                        {rol.descripcion && <p className="text-xs text-[#8892b0]">{rol.descripcion}</p>}
                      </div>
                      <span className="ml-2 px-2 py-0.5 rounded text-xs bg-[#1a2040] text-[#8892b0]">{userCount} usuario{userCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {userCount === 0 && <button onClick={e => { e.stopPropagation(); handleDeleteRol(rol.id); }} className="p-1.5 rounded hover:bg-red-500/15 text-[#8892b0] hover:text-red-400 cursor-pointer"><Trash2 className="w-4 h-4" /></button>}
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-[#8892b0]" /> : <ChevronDown className="w-5 h-5 text-[#8892b0]" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-[#4a6fd4]/8">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm mt-3">
                          <thead><tr>
                            <th className="text-left py-2 pr-4 text-[#8892b0] font-medium">Módulo</th>
                            {ACCIONES.map(a => <th key={a} className="text-center py-2 px-3 text-[#8892b0] font-medium">{ACCIONES_LABELS[a]}</th>)}
                          </tr></thead>
                          <tbody>
                            {(permisosMap[rol.id] ?? []).map(perm => (
                              <tr key={perm.modulo} className="border-t border-[#4a6fd4]/8">
                                <td className="py-3 pr-4 text-white font-medium">{perm.modulo}</td>
                                {ACCIONES.map(accion => (
                                  <td key={accion} className="py-3 px-3 text-center">
                                    <div className="flex justify-center"><PermCheckbox checked={perm[accion]} onChange={v => updatePermiso(rol.id, perm.modulo, accion, v)} /></div>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex justify-end mt-4">
                        <button onClick={() => handleSavePermisos(rol.id)} disabled={savingPermisos}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
                          {savingPermisos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar Permisos
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── USER MODAL ────────────────────────────────────────────────── */}
      {showUserModal && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm overflow-y-auto">
<div className="min-h-full flex items-start sm:items-center justify-center p-4 py-8">
          <Card className="!bg-[#131729] !border-[#4a6fd4]/20 w-full max-w-md shadow-2xl">
            <div className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
                <button onClick={() => setShowUserModal(false)} className="p-1 rounded-md text-[#8892b0] hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#8892b0] uppercase tracking-wider mb-1">Nombre *</label>
                  <Input value={userForm.nombre} onChange={e => setUserForm(f => ({ ...f, nombre: e.target.value }))}
                    className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10" placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#8892b0] uppercase tracking-wider mb-1">Email *</label>
                  <Input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                    className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10" placeholder="email@ejemplo.com" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#8892b0] uppercase tracking-wider mb-1">
                    {editingUser ? 'Nueva contraseña (vacío = no cambiar)' : 'Contraseña *'}
                  </label>
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'} value={userForm.password}
                      onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                      className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 pr-10" placeholder="Mínimo 6 caracteres" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8892b0] hover:text-white cursor-pointer">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#8892b0] uppercase tracking-wider mb-1">Rol *</label>
                  <Select value={String(userForm.rolId)} onValueChange={v => setUserForm(f => ({ ...f, rolId: Number(v) }))}>
                    <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer"><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
                    <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                      {roles.map(r => <SelectItem key={r.id} value={String(r.id)} className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">{r.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {editingUser && (
                  <div className="flex items-center justify-between py-1">
                    <label className="text-sm text-[#8892b0]">Activo</label>
                    <button type="button" onClick={() => setUserForm(f => ({ ...f, activo: !f.activo }))}
                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${userForm.activo ? 'bg-emerald-500' : 'bg-[#1a2040]'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${userForm.activo ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowUserModal(false)} disabled={savingUser}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-[#4a6fd4]/20 text-[#8892b0] text-sm font-medium hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer disabled:opacity-50">Cancelar</button>
                <button onClick={handleSaveUser} disabled={savingUser}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
                  {savingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savingUser ? 'Guardando...' : editingUser ? 'Guardar' : 'Crear Usuario'}
                </button>
              </div>
            </div>
          </Card>
        </div>
</div>
      , document.body)}

      {/* ── ROL MODAL ─────────────────────────────────────────────────── */}
      {showRolModal && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm overflow-y-auto">
<div className="min-h-full flex items-start sm:items-center justify-center p-4 py-8">
          <Card className="!bg-[#131729] !border-[#4a6fd4]/20 w-full max-w-md shadow-2xl">
            <div className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Nuevo Rol</h2>
                <button onClick={() => setShowRolModal(false)} className="p-1 rounded-md text-[#8892b0] hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#8892b0] uppercase tracking-wider mb-1">Nombre *</label>
                  <Input value={rolForm.nombre} onChange={e => setRolForm(f => ({ ...f, nombre: e.target.value }))}
                    className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10" placeholder="Nombre del rol" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#8892b0] uppercase tracking-wider mb-1">Descripción</label>
                  <Input value={rolForm.descripcion} onChange={e => setRolForm(f => ({ ...f, descripcion: e.target.value }))}
                    className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10" placeholder="Descripción del rol" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowRolModal(false)} disabled={savingRol} className="flex-1 px-4 py-2.5 rounded-lg border border-[#4a6fd4]/20 text-[#8892b0] text-sm hover:text-white cursor-pointer disabled:opacity-50">Cancelar</button>
                <button onClick={handleSaveRol} disabled={savingRol}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
                  {savingRol ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {savingRol ? 'Creando...' : 'Crear Rol'}
                </button>
              </div>
            </div>
          </Card>
        </div>
</div>
      , document.body)}

      {/* ── CONFIRMAR DESACTIVAR USUARIO ──────────────────────────────── */}
      {deactivateUser && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm overflow-y-auto">
<div className="min-h-full flex items-start sm:items-center justify-center p-4 py-8">
          <Card className="!bg-[#131729] !border-[#4a6fd4]/20 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-red-500/10"><Trash2 className="w-5 h-5 text-red-400" /></div>
                <div><h3 className="text-lg font-semibold text-white">Desactivar Usuario</h3><p className="text-xs text-[#8892b0]">No podrá ingresar al sistema</p></div>
              </div>
              <p className="text-sm text-[#8892b0]">¿Estás seguro de que querés desactivar a <span className="text-white font-medium">{deactivateUser.nombre}</span>? Podés reactivarlo después desde Editar.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeactivateUser(null)} disabled={deactivating} className="flex-1 px-4 py-2.5 rounded-lg border border-[#4a6fd4]/20 text-[#8892b0] text-sm hover:text-white cursor-pointer disabled:opacity-50">Cancelar</button>
                <button onClick={handleDeactivateUser} disabled={deactivating} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
                  {deactivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deactivating ? 'Desactivando...' : 'Desactivar'}
                </button>
              </div>
            </div>
          </Card>
        </div>
</div>
      , document.body)}
    </div>
  );
}
