import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Input } from '@/components/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { recepcionService } from '@/services/api';
import { dateFormat } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Plus, Search, X, Loader2, UserPlus, Phone, Mail, MessageSquare,
  User, Calendar, ChevronLeft, ChevronRight, AlertCircle,
  Pencil, Trash2, CalendarCheck, CalendarX, List, CalendarDays, BarChart3,
} from 'lucide-react';

type Estado = 'PENDIENTE' | 'CONTACTADO' | 'CITA_AGENDADA' | 'CERRADO';
type Medio = 'PRESENCIAL' | 'TELEFONO' | 'WHATSAPP' | 'EMAIL' | 'WEB' | 'OTRO';

interface Contacto {
  id: number; nombre: string; telefono?: string; email?: string;
  medio: Medio; motivo?: string; observaciones?: string; estado: Estado;
  comoLlego?: string;
  fechaCita?: string; notasCita?: string; registradoPor?: { nombre: string };
  fechaContacto: string; createdAt: string;
}

const EST: Record<Estado, { label: string; color: string; bg: string }> = {
  PENDIENTE: { label: 'Pendiente', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20' },
  CONTACTADO: { label: 'Contactado', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
  CITA_AGENDADA: { label: 'Cita Agendada', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  CERRADO: { label: 'Cerrado', color: 'text-zinc-400', bg: 'bg-zinc-400/10 border-zinc-400/20' },
};

const MEDIOS: { value: Medio; label: string; icon: typeof Phone }[] = [
  { value: 'PRESENCIAL', label: 'Presencial', icon: User },
  { value: 'TELEFONO', label: 'Teléfono', icon: Phone },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: MessageSquare },
  { value: 'EMAIL', label: 'Email', icon: Mail },
  { value: 'WEB', label: 'Web', icon: User },
  { value: 'OTRO', label: 'Otro', icon: User },
];

const COMO_LLEGO_OPTIONS = ['Instagram', 'Facebook', 'Radio', 'Recomendación', 'Publicidad', 'Visita espontánea', 'Otro'];

const HORAS = Array.from({ length: 11 }, (_, i) => i + 8); // 8:00 - 18:00
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_SEMANA = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

const ic = 'bg-[#1a2040] border-[#4a6fd4]/10 text-white placeholder:text-[#8892b0]/50 focus:ring-[#4a6fd4] rounded-lg h-10 w-full px-3 text-sm outline-none border transition-shadow focus:ring-2';
const lc = 'block text-[10px] font-bold text-[#8892b0] uppercase tracking-wider mb-1';

export function RecepcionPage() {
  const { tienePermiso } = useAuth();
  const canEdit = tienePermiso('RECEPCION', 'editar');
  const canDelete = tienePermiso('RECEPCION', 'eliminar');
  const canCreate = tienePermiso('RECEPCION', 'crear');

  const [tab, setTab] = useState<'lista' | 'calendario' | 'estadisticas'>('lista');

  // Lista state
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');

  // Calendario state
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [citas, setCitas] = useState<Contacto[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Modal
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Stats
  const [stats, setStats] = useState<{ comoLlego: string; total: number }[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Form
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [medio, setMedio] = useState<Medio>('PRESENCIAL');
  const [comoLlego, setComoLlego] = useState('');
  const [motivo, setMotivo] = useState('');
  const [tieneCita, setTieneCita] = useState(false);
  const [fechaCita, setFechaCita] = useState('');
  const [horaCita, setHoraCita] = useState('09');
  const [notasCita, setNotasCita] = useState('');
  const [estado, setEstado] = useState<Estado>('PENDIENTE');

  // Modal calendar
  const [modalCalMonth, setModalCalMonth] = useState(new Date().getMonth());
  const [modalCalYear, setModalCalYear] = useState(new Date().getFullYear());
  const [modalCitas, setModalCitas] = useState<Contacto[]>([]);
  const [modalCalLoading, setModalCalLoading] = useState(false);

  // ── Load lista ─────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 15 };
      if (search.trim()) params.busqueda = search.trim();
      if (estadoFilter) params.estado = estadoFilter;
      const res = await recepcionService.listar(params);
      setContactos(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotal(res.data.pagination?.total || 0);
    } catch { toast.error('Error al cargar contactos'); setContactos([]); }
    finally { setLoading(false); }
  }, [page, search, estadoFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, estadoFilter]);

  // ── Load stats ─────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await recepcionService.statsComoLlego();
      setStats(res.data);
    } catch { setStats([]); }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => { if (tab === 'estadisticas') loadStats(); }, [tab, loadStats]);

  // ── Load calendario ────────────────────────────────────────────────────

  const loadCitas = useCallback(async () => {
    setCalLoading(true);
    try {
      const res = await recepcionService.citasMes(calYear, calMonth);
      setCitas(res.data || []);
    } catch { setCitas([]); }
    finally { setCalLoading(false); }
  }, [calYear, calMonth]);

  useEffect(() => { if (tab === 'calendario') loadCitas(); }, [tab, loadCitas]);

  // ── Calendar helpers ───────────────────────────────────────────────────

  const citasPorDia = useMemo(() => {
    const map: Record<number, Contacto[]> = {};
    for (const c of citas) {
      if (!c.fechaCita) continue;
      const d = new Date(c.fechaCita).getDate();
      if (!map[d]) map[d] = [];
      map[d].push(c);
    }
    return map;
  }, [citas]);

  const citasDelDia = useMemo(() => {
    if (selectedDay === null) return [];
    return citasPorDia[selectedDay] || [];
  }, [selectedDay, citasPorDia]);

  const citasPorHora = useMemo(() => {
    const map: Record<number, Contacto[]> = {};
    for (const c of citasDelDia) {
      if (!c.fechaCita) continue;
      const h = new Date(c.fechaCita).getHours();
      if (!map[h]) map[h] = [];
      map[h].push(c);
    }
    return map;
  }, [citasDelDia]);

  // Build calendar grid
  const calGrid = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const firstDayMon = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: { day: number; current: boolean }[] = [];
    const prevDays = new Date(calYear, calMonth, 0).getDate();
    for (let i = firstDayMon - 1; i >= 0; i--) cells.push({ day: prevDays - i, current: false });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, current: true });
    while (cells.length < 42) cells.push({ day: cells.length - firstDayMon - daysInMonth + 1, current: false });
    return cells;
  }, [calYear, calMonth]);

  const goMonth = (dir: -1 | 1) => {
    let m = calMonth + dir, y = calYear;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setCalMonth(m); setCalYear(y); setSelectedDay(null);
  };

  const isToday = (day: number) => {
    const now = new Date();
    return day === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();
  };

  // ── Modal calendar ──────────────────────────────────────────────────────

  const loadModalCitas = useCallback(async (y: number, m: number) => {
    setModalCalLoading(true);
    try {
      const res = await recepcionService.citasMes(y, m);
      setModalCitas(res.data || []);
    } catch { setModalCitas([]); }
    finally { setModalCalLoading(false); }
  }, []);

  useEffect(() => {
    if (tieneCita && modal) loadModalCitas(modalCalYear, modalCalMonth);
  }, [tieneCita, modal, modalCalYear, modalCalMonth, loadModalCitas]);

  const modalCitasPorDia = useMemo(() => {
    const map: Record<number, Contacto[]> = {};
    for (const c of modalCitas) {
      if (!c.fechaCita) continue;
      const d = new Date(c.fechaCita).getDate();
      if (!map[d]) map[d] = [];
      map[d].push(c);
    }
    return map;
  }, [modalCitas]);

  const modalCitasHoraDelDia = useMemo(() => {
    if (!fechaCita) return {};
    const day = Number(fechaCita.split('-')[2]);
    const dayCitas = modalCitasPorDia[day] || [];
    const map: Record<number, number> = {};
    for (const c of dayCitas) {
      if (!c.fechaCita) continue;
      const h = new Date(c.fechaCita).getHours();
      map[h] = (map[h] || 0) + 1;
    }
    // If editing, exclude current record from count
    if (editId) {
      for (const c of dayCitas) {
        if (c.id === editId && c.fechaCita) {
          const h = new Date(c.fechaCita).getHours();
          map[h] = Math.max(0, (map[h] || 0) - 1);
        }
      }
    }
    return map;
  }, [fechaCita, modalCitasPorDia, editId]);

  const modalCalGrid = useMemo(() => {
    const firstDay = new Date(modalCalYear, modalCalMonth, 1).getDay();
    const firstDayMon = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(modalCalYear, modalCalMonth + 1, 0).getDate();
    const cells: { day: number; current: boolean }[] = [];
    const prevDays = new Date(modalCalYear, modalCalMonth, 0).getDate();
    for (let i = firstDayMon - 1; i >= 0; i--) cells.push({ day: prevDays - i, current: false });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, current: true });
    while (cells.length < 42) cells.push({ day: cells.length - firstDayMon - daysInMonth + 1, current: false });
    return cells;
  }, [modalCalYear, modalCalMonth]);

  const goModalMonth = (dir: -1 | 1) => {
    let m = modalCalMonth + dir, y = modalCalYear;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setModalCalMonth(m); setModalCalYear(y);
  };

  const selectModalDay = (day: number) => {
    const dateStr = `${modalCalYear}-${String(modalCalMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setFechaCita(dateStr);
  };

  // ── Form helpers ───────────────────────────────────────────────────────

  const resetForm = () => {
    setNombre(''); setTelefono(''); setEmail(''); setMedio('PRESENCIAL');
    setComoLlego(''); setMotivo(''); setTieneCita(false); setFechaCita(''); setHoraCita('09');
    setNotasCita(''); setEstado('PENDIENTE'); setEditId(null);
  };

  const openCreate = (presetDate?: string, presetHour?: number) => {
    resetForm();
    setModalCalMonth(new Date().getMonth()); setModalCalYear(new Date().getFullYear());
    if (presetDate) {
      setTieneCita(true); setFechaCita(presetDate); setHoraCita(String(presetHour || 9).padStart(2, '0'));
      const [y, m] = presetDate.split('-').map(Number);
      setModalCalMonth(m - 1); setModalCalYear(y);
    }
    setModal('create');
  };

  const openEdit = (c: Contacto) => {
    setEditId(c.id); setNombre(c.nombre); setTelefono(c.telefono || '');
    setEmail(c.email || ''); setMedio(c.medio); setComoLlego(c.comoLlego || ''); setMotivo(c.motivo || '');
    setTieneCita(!!c.fechaCita);
    if (c.fechaCita) {
      const d = new Date(c.fechaCita);
      setFechaCita(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
      setHoraCita(String(d.getHours()).padStart(2, '0'));
    } else { setFechaCita(''); setHoraCita('09'); }
    setNotasCita(c.notasCita || ''); setEstado(c.estado);
    if (c.fechaCita) {
      const d = new Date(c.fechaCita);
      setModalCalMonth(d.getMonth()); setModalCalYear(d.getFullYear());
    } else {
      setModalCalMonth(new Date().getMonth()); setModalCalYear(new Date().getFullYear());
    }
    setModal('edit');
  };

  const handleSave = async () => {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error('Email inválido'); return; }
    if (tieneCita && !fechaCita) { toast.error('Seleccioná una fecha para la cita'); return; }
    if (tieneCita && (modalCitasHoraDelDia[Number(horaCita)] || 0) >= 2) {
      toast.error('Ese horario ya está lleno. Elegí otro.'); return;
    }
    setSaving(true);
    try {
      const data: any = {
        nombre: nombre.trim(), medio,
        telefono: telefono || undefined, email: email || undefined,
        comoLlego: comoLlego || undefined, motivo: motivo || undefined,
        estado: tieneCita ? 'CITA_AGENDADA' : (modal === 'edit' ? estado : 'PENDIENTE'),
        fechaCita: tieneCita && fechaCita ? new Date(`${fechaCita}T${horaCita}:00:00`).toISOString() : null,
        notasCita: tieneCita ? notasCita || undefined : undefined,
      };
      if (modal === 'edit' && editId) {
        await recepcionService.editar(editId, data);
        toast.success('Contacto actualizado');
      } else {
        await recepcionService.crear(data);
        toast.success('Contacto registrado');
      }
      setModal(null); resetForm(); load(); if (tab === 'calendario') loadCitas();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await recepcionService.eliminar(deleteId);
      toast.success('Contacto eliminado'); setDeleteId(null); load(); if (tab === 'calendario') loadCitas();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Error al eliminar'); }
    finally { setDeleting(false); }
  };

  const tiempoRelativo = (fecha: string) => {
    const mins = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    return `hace ${Math.floor(hrs / 24)}d`;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#4a6fd4]/10"><UserPlus className="w-6 h-6 text-[#7b9ae8]" /></div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Recepción</h1>
            <p className="text-sm text-[#8892b0]">{!loading && <>{total} contacto{total !== 1 ? 's' : ''}</>}</p>
          </div>
        </div>
        {canCreate && (
          <button onClick={() => openCreate()} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white text-sm font-semibold cursor-pointer w-full sm:w-auto">
            <Plus className="w-4 h-4" /> Nueva Visita
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0b0e18] p-1 rounded-lg w-fit">
        <button onClick={() => setTab('lista')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${tab === 'lista' ? 'bg-[#4a6fd4] text-white' : 'text-[#8892b0] hover:text-white'}`}>
          <List className="w-4 h-4" /> Lista
        </button>
        <button onClick={() => setTab('calendario')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${tab === 'calendario' ? 'bg-[#4a6fd4] text-white' : 'text-[#8892b0] hover:text-white'}`}>
          <CalendarDays className="w-4 h-4" /> Calendario
        </button>
        <button onClick={() => setTab('estadisticas')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${tab === 'estadisticas' ? 'bg-[#4a6fd4] text-white' : 'text-[#8892b0] hover:text-white'}`}>
          <BarChart3 className="w-4 h-4" /> Estadísticas
        </button>
      </div>

      {tab === 'lista' && (
        /* ── LISTA VIEW ────────────────────────────────────────────────── */
        <>
          <Card className="!bg-[#131729] !border-[#4a6fd4]/8 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892b0]" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o teléfono..."
                  className="pl-10 bg-[#1a2040] border-[#4a6fd4]/10 h-10 text-white placeholder:text-[#8892b0]/50 focus:ring-[#4a6fd4]" />
              </div>
              <div className="w-full sm:w-48">
                <Select value={estadoFilter || 'ALL'} onValueChange={v => setEstadoFilter(v === 'ALL' ? '' : v)}>
                  <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                    <SelectItem value="ALL" className="text-white focus:bg-[#4a6fd4]/20 cursor-pointer">Todos</SelectItem>
                    {Object.entries(EST).map(([k, v]) => <SelectItem key={k} value={k} className={`${v.color} focus:bg-[#4a6fd4]/10 cursor-pointer`}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-[#4a6fd4] animate-spin" /></div>
          ) : contactos.length === 0 ? (
            <Card className="!bg-[#131729] !border-[#4a6fd4]/8"><div className="flex flex-col items-center justify-center py-16"><UserPlus className="w-12 h-12 text-[#4a6fd4]/30 mb-3" /><p className="text-[#8892b0]">{search || estadoFilter ? 'Sin resultados' : 'Sin contactos'}</p></div></Card>
          ) : (
            <div className="space-y-2">
              {contactos.map(c => {
                const est = EST[c.estado];
                const medioInfo = MEDIOS.find(m => m.value === c.medio) || MEDIOS[4];
                const MI = medioInfo.icon;
                return (
                  <Card key={c.id} className={`!bg-[#131729] transition-colors ${c.estado === 'CITA_AGENDADA' ? '!border-emerald-400/20 hover:!border-emerald-400/30' : '!border-[#4a6fd4]/8 hover:!border-[#4a6fd4]/20'}`}>
                    <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[#4a6fd4]/10 flex items-center justify-center shrink-0 text-[#7b9ae8] font-bold text-sm">{c.nombre.charAt(0).toUpperCase()}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-white truncate">{c.nombre}</h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${est.bg} ${est.color}`}>{est.label}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-[#8892b0]">
                            {c.telefono && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.telefono}</span>}
                            <span className="flex items-center gap-1"><MI className="w-3 h-3" />{medioInfo.label}</span>
                            <span className="text-[#8892b0]/50">{tiempoRelativo(c.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      {c.fechaCita && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-400/5 border border-emerald-400/10 shrink-0">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          <div className="text-xs">
                            <div className="text-emerald-400 font-medium">{dateFormat(c.fechaCita)} {new Date(c.fechaCita).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
                            {c.notasCita && <div className="text-[#8892b0] truncate max-w-[150px]">{c.notasCita}</div>}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        {canEdit && <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-[#7b9ae8] hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer"><Pencil className="w-4 h-4" /></button>}
                        {canDelete && <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-md text-red-400/50 hover:text-red-400 hover:bg-red-400/10 cursor-pointer"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#8892b0]">Pág. {page} de {totalPages}</p>
              <div className="flex items-center gap-1.5">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-8 px-3 inline-flex items-center gap-1 rounded-md border border-[#4a6fd4]/20 text-[#7b9ae8] text-sm hover:bg-[#4a6fd4]/10 disabled:opacity-30 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-8 px-3 inline-flex items-center gap-1 rounded-md border border-[#4a6fd4]/20 text-[#7b9ae8] text-sm hover:bg-[#4a6fd4]/10 disabled:opacity-30 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'calendario' && (
        /* ── CALENDARIO VIEW ───────────────────────────────────────────── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Calendar grid */}
          <Card className="!bg-[#131729] !border-[#4a6fd4]/8 p-4 lg:col-span-2">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => goMonth(-1)} className="h-8 w-8 rounded-md border border-[#4a6fd4]/20 text-white flex items-center justify-center hover:bg-[#4a6fd4]/10 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
              <h2 className="text-white font-semibold capitalize">{MESES[calMonth]} {calYear}</h2>
              <button onClick={() => goMonth(1)} className="h-8 w-8 rounded-md border border-[#4a6fd4]/20 text-white flex items-center justify-center hover:bg-[#4a6fd4]/10 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {DIAS_SEMANA.map(d => <div key={d} className="text-center text-[10px] font-medium text-[#8892b0] py-1">{d}</div>)}
            </div>

            {/* Day cells */}
            {calLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-[#4a6fd4] animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {calGrid.map((cell, i) => {
                  const dayCitas = cell.current ? (citasPorDia[cell.day] || []) : [];
                  const isSelected = cell.current && selectedDay === cell.day;
                  const today = cell.current && isToday(cell.day);

                  return (
                    <button key={i} onClick={() => cell.current && setSelectedDay(cell.day === selectedDay ? null : cell.day)}
                      className={`relative h-14 sm:h-16 rounded-lg text-sm flex flex-col items-center justify-start pt-1.5 transition-all cursor-pointer ${
                        !cell.current ? 'text-[#8892b0]/20' :
                        isSelected ? 'bg-[#4a6fd4]/20 text-white ring-1 ring-[#4a6fd4]' :
                        today ? 'bg-[#1a2040] text-[#7b9ae8] font-semibold' :
                        'text-white hover:bg-[#1a2040]'
                      }`}>
                      <span className="text-xs">{cell.day}</span>
                      {dayCitas.length > 0 && (
                        <div className="flex gap-0.5 mt-1">
                          {dayCitas.slice(0, 3).map((_, j) => <div key={j} className="w-1.5 h-1.5 rounded-full bg-emerald-400" />)}
                          {dayCitas.length > 3 && <span className="text-[8px] text-emerald-400">+{dayCitas.length - 3}</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Day detail / hour slots */}
          <Card className="!bg-[#131729] !border-[#4a6fd4]/8 p-4 overflow-hidden">
            {selectedDay === null ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#8892b0]">
                <CalendarDays className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Seleccioná un día para ver las citas</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold text-sm">{selectedDay} de {MESES[calMonth]}</h3>
                  <span className="text-xs text-[#8892b0]">{citasDelDia.length} cita{citasDelDia.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="space-y-1 overflow-y-auto max-h-[500px]">
                  {HORAS.map(hora => {
                    const citasHora = citasPorHora[hora] || [];
                    const lleno = citasHora.length >= 2;
                    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;

                    return (
                      <div key={hora} className={`rounded-lg border p-2 transition-colors ${lleno ? 'border-red-500/20 bg-red-500/[0.03]' : 'border-[#4a6fd4]/8 hover:border-[#4a6fd4]/20'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-[#8892b0]">{String(hora).padStart(2, '0')}:00</span>
                          <div className="flex items-center gap-1">
                            <span className={`text-[9px] font-medium ${lleno ? 'text-red-400' : citasHora.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {citasHora.length}/2
                            </span>
                            {canCreate && !lleno && (
                              <button onClick={() => openCreate(dateStr, hora)} className="p-0.5 rounded text-[#4a6fd4] hover:text-white hover:bg-[#4a6fd4]/20 cursor-pointer" title="Agendar cita">
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {citasHora.map(c => (
                          <div key={c.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-emerald-400/5 border border-emerald-400/10 mt-1">
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-white truncate">{c.nombre}</div>
                              {c.notasCita && <div className="text-[10px] text-[#8892b0] truncate">{c.notasCita}</div>}
                            </div>
                            <div className="flex gap-0.5 shrink-0">
                              {canEdit && <button onClick={() => openEdit(c)} className="p-1 rounded text-[#7b9ae8] hover:bg-[#4a6fd4]/10 cursor-pointer"><Pencil className="w-3 h-3" /></button>}
                              {canDelete && <button onClick={() => setDeleteId(c.id)} className="p-1 rounded text-red-400/50 hover:text-red-400 cursor-pointer"><Trash2 className="w-3 h-3" /></button>}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {tab === 'estadisticas' && (
        /* ── ESTADÍSTICAS VIEW ─────────────────────────────────────── */
        <Card className="!bg-[#131729] !border-[#4a6fd4]/8 p-5 sm:p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#7b9ae8]" /> ¿Cómo llegaron los contactos?
          </h3>
          {statsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-[#4a6fd4] animate-spin" /></div>
          ) : stats.length === 0 ? (
            <p className="text-sm text-[#8892b0] text-center py-12">Sin datos aún</p>
          ) : (() => {
            const maxTotal = Math.max(...stats.map(s => s.total));
            const totalGeneral = stats.reduce((s, c) => s + c.total, 0);
            const COLORS = ['bg-[#4a6fd4]', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-red-500', 'bg-cyan-500', 'bg-pink-500'];
            return (
              <div className="space-y-3">
                {stats.map((s, i) => {
                  const pct = maxTotal > 0 ? (s.total / maxTotal) * 100 : 0;
                  const pctTotal = totalGeneral > 0 ? ((s.total / totalGeneral) * 100).toFixed(1) : '0';
                  return (
                    <div key={s.comoLlego}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-white font-medium">{s.comoLlego}</span>
                        <span className="text-[#8892b0]">{s.total} ({pctTotal}%)</span>
                      </div>
                      <div className="h-6 rounded-md bg-[#0b0e18] overflow-hidden">
                        <div className={`h-full rounded-md ${COLORS[i % COLORS.length]} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-3 border-t border-[#4a6fd4]/10 flex justify-between text-sm">
                  <span className="text-[#8892b0]">Total contactos</span>
                  <span className="text-white font-bold">{totalGeneral}</span>
                </div>
              </div>
            );
          })()}
        </Card>
      )}

      {/* ── MODAL ─────────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="!bg-[#131729] !border-[#4a6fd4]/20 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">{modal === 'edit' ? 'Editar Contacto' : 'Registrar Visita'}</h2>
                <button onClick={() => { setModal(null); resetForm(); }} className="p-1 rounded-md text-[#8892b0] hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div><label className={lc}>Nombre *</label><Input className={ic} placeholder="Nombre completo" value={nombre} onChange={e => setNombre(e.target.value)} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={lc}>Teléfono</label><Input className={ic} placeholder="264-4551234" value={telefono} onChange={e => setTelefono(e.target.value)} inputMode="tel" /></div>
                  <div><label className={lc}>Email</label><Input className={ic} type="email" placeholder="email@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
                </div>
                <div>
                  <label className={lc}>¿Cómo llegó?</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {COMO_LLEGO_OPTIONS.map(c => {
                      const active = comoLlego === c;
                      return (
                        <button key={c} type="button" onClick={() => setComoLlego(active ? '' : c)}
                          className={`py-2 px-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${active ? 'border-[#4a6fd4] bg-[#4a6fd4]/15 text-[#7b9ae8]' : 'border-[#4a6fd4]/10 text-[#8892b0] hover:border-[#4a6fd4]/30'}`}>
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className={lc}>Motivo</label>
                  <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} placeholder="¿Qué consulta?"
                    className="w-full px-3 py-2 border border-[#4a6fd4]/10 rounded-lg bg-[#1a2040] text-white placeholder-[#8892b0]/50 focus:outline-none focus:ring-2 focus:ring-[#4a6fd4] resize-none text-sm" />
                </div>
                <div>
                  <label className={lc}>¿Agendó cita?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setTieneCita(false)} className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium cursor-pointer ${!tieneCita ? 'border-amber-400/30 bg-amber-400/10 text-amber-400' : 'border-[#4a6fd4]/10 text-[#8892b0]'}`}><CalendarX className="w-4 h-4" /> No</button>
                    <button type="button" onClick={() => setTieneCita(true)} className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium cursor-pointer ${tieneCita ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400' : 'border-[#4a6fd4]/10 text-[#8892b0]'}`}><CalendarCheck className="w-4 h-4" /> Sí</button>
                  </div>
                </div>

                {tieneCita && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Mini calendar */}
                    <div className="bg-[#0b0e18] rounded-lg border border-[#4a6fd4]/10 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <button type="button" onClick={() => goModalMonth(-1)} className="h-7 w-7 rounded-md border border-[#4a6fd4]/20 text-white flex items-center justify-center hover:bg-[#4a6fd4]/10 cursor-pointer"><ChevronLeft className="w-3.5 h-3.5" /></button>
                        <span className="text-sm font-medium text-white capitalize">{MESES[modalCalMonth]} {modalCalYear}</span>
                        <button type="button" onClick={() => goModalMonth(1)} className="h-7 w-7 rounded-md border border-[#4a6fd4]/20 text-white flex items-center justify-center hover:bg-[#4a6fd4]/10 cursor-pointer"><ChevronRight className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="grid grid-cols-7 mb-0.5">
                        {DIAS_SEMANA.map(d => <div key={d} className="text-center text-[9px] font-medium text-[#8892b0] py-0.5">{d}</div>)}
                      </div>
                      {modalCalLoading ? (
                        <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 text-[#4a6fd4] animate-spin" /></div>
                      ) : (
                        <div className="grid grid-cols-7 gap-0.5">
                          {modalCalGrid.map((cell, i) => {
                            const dayCitas = cell.current ? (modalCitasPorDia[cell.day] || []) : [];
                            const dateStr = `${modalCalYear}-${String(modalCalMonth + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
                            const isSelected = cell.current && fechaCita === dateStr;
                            const today = cell.current && cell.day === new Date().getDate() && modalCalMonth === new Date().getMonth() && modalCalYear === new Date().getFullYear();
                            return (
                              <button key={i} type="button" onClick={() => cell.current && selectModalDay(cell.day)}
                                className={`h-8 rounded text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                                  !cell.current ? 'text-[#8892b0]/15' :
                                  isSelected ? 'bg-[#4a6fd4] text-white font-semibold' :
                                  today ? 'bg-[#1a2040] text-[#7b9ae8] font-semibold' :
                                  'text-white/80 hover:bg-[#1a2040]'
                                }`}>
                                <span>{cell.day}</span>
                                {dayCitas.length > 0 && !isSelected && <div className="flex gap-px mt-px">{dayCitas.slice(0, 3).map((_, j) => <div key={j} className="w-1 h-1 rounded-full bg-emerald-400" />)}</div>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Hour selector */}
                    {fechaCita && (
                      <div className="space-y-2">
                        <label className={lc}>Horario disponible</label>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                          {HORAS.map(h => {
                            const ocupadas = modalCitasHoraDelDia[h] || 0;
                            const lleno = ocupadas >= 2;
                            const selected = horaCita === String(h).padStart(2, '0');
                            return (
                              <button key={h} type="button" onClick={() => !lleno && setHoraCita(String(h).padStart(2, '0'))}
                                disabled={lleno}
                                className={`py-2 rounded-lg text-xs font-medium transition-all ${
                                  lleno ? 'bg-red-500/10 text-red-400/50 border border-red-500/10 cursor-not-allowed line-through' :
                                  selected ? 'bg-[#4a6fd4] text-white border border-[#4a6fd4] cursor-pointer' :
                                  ocupadas > 0 ? 'bg-amber-400/5 text-amber-400 border border-amber-400/15 cursor-pointer hover:border-amber-400/30' :
                                  'bg-[#1a2040] text-white border border-[#4a6fd4]/10 cursor-pointer hover:border-[#4a6fd4]/30'
                                }`}>
                                {String(h).padStart(2, '0')}:00
                                <div className={`text-[9px] mt-0.5 ${lleno ? 'text-red-400/40' : ocupadas > 0 ? 'text-amber-400/60' : 'text-emerald-400/60'}`}>
                                  {lleno ? 'Lleno' : `${ocupadas}/2`}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {modalCitasHoraDelDia[Number(horaCita)] >= 2 && (
                          <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Este horario está lleno, elegí otro</p>
                        )}
                      </div>
                    )}

                    {/* Notas */}
                    <div><label className={lc}>Notas de cita</label><Input className={ic} placeholder="Ej: Viene a las 10hs a ver Toyota" value={notasCita} onChange={e => setNotasCita(e.target.value)} /></div>
                  </div>
                )}

                {modal === 'edit' && !tieneCita && (
                  <div><label className={lc}>Estado</label>
                    <Select value={estado} onValueChange={v => setEstado(v as Estado)}>
                      <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">{Object.entries(EST).map(([k, v]) => <SelectItem key={k} value={k} className={`${v.color} cursor-pointer`}>{v.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => { setModal(null); resetForm(); }} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg border border-[#4a6fd4]/20 text-[#8892b0] text-sm hover:text-white cursor-pointer disabled:opacity-50">Cancelar</button>
                <button onClick={handleSave} disabled={saving || !nombre.trim()} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {saving ? 'Guardando...' : modal === 'edit' ? 'Guardar' : 'Registrar'}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="!bg-[#131729] !border-[#4a6fd4]/20 w-full max-w-sm shadow-2xl">
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3"><div className="p-2 rounded-full bg-red-500/10"><AlertCircle className="w-5 h-5 text-red-400" /></div><h3 className="text-lg font-semibold text-white">Eliminar</h3></div>
              <p className="text-sm text-[#8892b0]">¿Eliminar este contacto? No se puede deshacer.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 rounded-lg border border-[#4a6fd4]/20 text-[#8892b0] text-sm cursor-pointer">Cancelar</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Eliminar
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
