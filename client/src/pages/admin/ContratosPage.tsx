import { useState, useEffect, useCallback, useRef } from 'react';
import { contratosService, usuariosService } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { ViewType } from '@/types';
import { toast } from 'sonner';
import { currencyFormat, dateFormat, currencyInput, currencyRaw } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Search, Plus, FileText, ChevronLeft, ChevronRight, Calendar, User, Car,
  Hash, Inbox, ArrowLeft, Phone, MapPin, DollarSign, Clock, Check,
  AlertTriangle, Eye, Pencil, X, Loader2, Save, Upload, Trash2,
  Image as ImageIcon,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Contrato {
  id: number; numeroContrato: string; puntoVenta: string; productorAsesor: string;
  tipoVehiculo: string; marca: string; modelo: string; anticipoMensual: number | string;
  periodoPago: string; cantidadCuotas: number; solicitanteNombre: string;
  solicitanteDni: string; solicitanteFechaNac?: string; solicitanteEstadoCivil?: string;
  solicitanteDomicilio?: string; solicitanteBarrio?: string; solicitanteLocalidad?: string;
  solicitanteCp?: string; solicitanteProvincia?: string; solicitanteCelular?: string;
  solicitanteTelFijo?: string; solicitanteHrContacto?: string; solicitanteOcupacion?: string;
  solicitanteEmail?: string; conyugeNombre?: string; conyugeDni?: string;
  conyugeTelefono?: string; tieneVehiculoUsado: boolean; usadoMarca?: string;
  usadoModelo?: string; usadoAnio?: number; usadoColor?: string; usadoCombustible?: string;
  comoLlego?: string; observaciones?: string; estado: 'ACTIVO' | 'COMPLETADO' | 'CANCELADO';
  fechaCreacion: string; registradoPor?: { id: number; nombre: string };
  _count?: { cuotas: number; archivos: number }; cuotas?: any[]; archivos?: any[];
}

interface ContratosPageProps { onNavigate: (view: ViewType) => void; }

// ── Constants & Helpers ──────────────────────────────────────────────────────

const ESTADOS = ['ACTIVO', 'COMPLETADO', 'CANCELADO', 'DE_BAJA'] as const;
const LIMIT = 15;
const fmt = currencyFormat;
const fmtDate = dateFormat;

const PUNTO_VENTA_LABELS: Record<string, string> = {
  SALON: 'Salón', STAND: 'Stand', CASA_CLIENTE: 'Domicilio', ONLINE: 'Online', OTRO: 'Otro',
};
const PERIODO_LABELS: Record<string, string> = {
  '1-10': 'Del 1 al 10', '10-20': 'Del 10 al 20', '20-30': 'Del 20 al 30',
};

function estadoBadge(e: string) {
  return e === 'ACTIVO' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
    : e === 'COMPLETADO' ? 'bg-[#4a6fd4]/10 text-[#7b9ae8] border-[#4a6fd4]/20'
    : e === 'CANCELADO' ? 'bg-red-400/10 text-red-400 border-red-400/20'
    : e === 'DE_BAJA' ? 'bg-zinc-400/10 text-zinc-400 border-zinc-400/20'
    : 'bg-[#8892b0]/10 text-[#8892b0] border-[#8892b0]/20';
}

function fmtVehiculo(marca?: string, modelo?: string) {
  const m = marca && !marca.toUpperCase().includes('DEFINIR') ? marca : '';
  const mo = modelo && !modelo.toUpperCase().includes('DEFINIR') ? modelo : '';
  return [m, mo].filter(Boolean).join(' ') || 'Sin especificar';
}

const ic = 'bg-[#1a2040] border-[#4a6fd4]/10 text-white placeholder:text-[#8892b0]/50 focus:ring-[#4a6fd4] rounded-lg h-10 w-full px-3 text-sm outline-none border transition-shadow focus:ring-2';
const lc = 'block text-[10px] font-bold text-[#8892b0] uppercase tracking-wider mb-1';

// ── Detail row helper ────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value || value === '-') return null;
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-[#8892b0] shrink-0 mr-3">{label}</span>
      <span className="text-white font-medium text-right truncate">{value}</span>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function ContratosPage({ onNavigate }: ContratosPageProps) {
  const { tienePermiso, puedeVerTodos } = useAuth();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [asesor, setAsesor] = useState('ALL');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [asesoresList, setAsesoresList] = useState<string[]>([]);

  const [view, setView] = useState<'list' | 'detail' | 'edit'>('list');
  const [activeContrato, setActiveContrato] = useState<Contrato | null>(null);

  // Scroll to top on view change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view]);

  const [editData, setEditData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [newFiles, setNewFiles] = useState<{ file: File; preview: string; tipo: string }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);

  const canCreate = tienePermiso('VENTAS', 'crear');
  const canDelete = tienePermiso('VENTAS', 'eliminar');
  const isAdmin = tienePermiso('CONFIGURACION', 'leer');
  const { puedeEditar } = useAuth();
  const [vendedores, setVendedores] = useState<{ id: number; nombre: string }[]>([]);

  // Load vendedores list for admin assignment
  useEffect(() => {
    if (isAdmin) {
      usuariosService.listar().then(res => {
        setVendedores((res.data || []).filter((u: any) => u.activo));
      }).catch(() => {});
    }
  }, [isAdmin]);

  // Load asesores list for filter
  useEffect(() => {
    if (puedeVerTodos('VENTAS')) {
      contratosService.listarAsesores().then(r => setAsesoresList(r.data)).catch(() => {});
    }
  }, []);

  // ── Debounced search ───────────────────────────────────────────────────

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // ── Data fetching ─────────────────────────────────────────────────────

  const fetchContratos = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit: LIMIT };
      if (debouncedSearch.trim()) params.busqueda = debouncedSearch.trim();
      if (estado) params.estado = estado;
      if (asesor !== 'ALL') params.asesor = asesor;
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;
      const res = await contratosService.listar(params);
      setContratos(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch { toast.error('Error al cargar contratos'); setContratos([]); setTotal(0); setTotalPages(1); }
    finally { setLoading(false); }
  }, [page, debouncedSearch, estado, asesor, desde, hasta]);

  useEffect(() => { fetchContratos(); }, [fetchContratos]);

  // Reset page when search/filter changes
  const handleSearch = (val: string) => { setPage(1); setSearch(val); };
  const handleEstado = (val: string) => { setPage(1); setEstado(val === 'ALL' ? '' : val); };
  const handleAsesor = (val: string) => { setPage(1); setAsesor(val); };
  const handleDesde = (val: string) => { setPage(1); setDesde(val); };
  const handleHasta = (val: string) => { setPage(1); setHasta(val); };

  // ── Navigation helpers ─────────────────────────────────────────────────

  const openView = async (c: Contrato, target: 'detail' | 'edit') => {
    setActiveContrato(c); setView(target);
    try {
      const res = await contratosService.obtener(c.id);
      setActiveContrato(res.data);
      if (target === 'edit') fillEdit(res.data);
    } catch { toast.error('Error al cargar detalle'); }
  };

  const fillEdit = (c: Contrato) => {
    setEditData({
      numeroContrato: c.numeroContrato, puntoVenta: c.puntoVenta,
      productorAsesor: c.productorAsesor, tipoVehiculo: c.tipoVehiculo,
      marca: c.marca, modelo: c.modelo,
      anticipoMensual: Number(c.anticipoMensual) || 0, periodoPago: c.periodoPago,
      solicitanteNombre: c.solicitanteNombre, solicitanteDni: c.solicitanteDni,
      solicitanteFechaNac: c.solicitanteFechaNac?.split('T')[0] || '',
      solicitanteEstadoCivil: c.solicitanteEstadoCivil || '',
      solicitanteDomicilio: c.solicitanteDomicilio || '',
      solicitanteBarrio: c.solicitanteBarrio || '',
      solicitanteLocalidad: c.solicitanteLocalidad || '',
      solicitanteCp: c.solicitanteCp || '',
      solicitanteProvincia: c.solicitanteProvincia || '',
      solicitanteCelular: c.solicitanteCelular || '',
      solicitanteTelFijo: c.solicitanteTelFijo || '',
      solicitanteHrContacto: c.solicitanteHrContacto || '',
      solicitanteOcupacion: c.solicitanteOcupacion || '',
      solicitanteEmail: c.solicitanteEmail || '',
      comoLlego: c.comoLlego || '', observaciones: c.observaciones || '',
      estado: c.estado, registradoPorId: c.registradoPor?.id || 0,
    });
    setNewFiles([]);
  };

  const goBack = () => { setView('list'); setActiveContrato(null); setNewFiles([]); };
  const ue = (f: string, v: any) => setEditData(p => ({ ...p, [f]: v }));

  // ── Edit save ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!activeContrato) return;
    setSaving(true);
    try {
      const payload: any = { ...editData };
      payload.anticipoMensual = Number(payload.anticipoMensual) || 0;
      payload.solicitanteFechaNac = payload.solicitanteFechaNac ? new Date(payload.solicitanteFechaNac).toISOString() : null;
      await contratosService.editar(activeContrato.id, payload);
      let fileErrors = 0;
      for (const f of newFiles) {
        setUploadingFile(true);
        try {
          const fd = new FormData(); fd.append('archivo', f.file); fd.append('tipo', f.tipo);
          await contratosService.subirArchivo(activeContrato.id, fd);
        } catch { fileErrors++; toast.error(`Error al subir ${f.tipo.replace('_', ' ')}`); }
      }
      setUploadingFile(false);
      toast.success(fileErrors > 0 ? 'Contrato actualizado (algunos archivos fallaron)' : 'Contrato actualizado');
      const res = await contratosService.obtener(activeContrato.id);
      setActiveContrato(res.data); setNewFiles([]); setView('detail'); fetchContratos();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Error al guardar'); }
    finally { setSaving(false); setUploadingFile(false); }
  };

  const deleteFile = async (id: number) => {
    if (!activeContrato) return;
    setDeletingFileId(id);
    try {
      await contratosService.eliminarArchivo(activeContrato.id, id);
      setActiveContrato(p => p ? { ...p, archivos: p.archivos?.filter((a: any) => a.id !== id) } : null);
      toast.success('Archivo eliminado');
    } catch { toast.error('Error al eliminar'); }
    finally { setDeletingFileId(null); }
  };

  const addFile = (tipo: string) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*,.pdf';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { toast.error('Max 10MB'); return; }
      setNewFiles(p => [...p.filter(f => f.tipo !== tipo), { file, preview: URL.createObjectURL(file), tipo }]);
    };
    input.click();
  };

  // ── Cuota status badge ─────────────────────────────────────────────────

  function CuotaBadge({ estado: e }: { estado: string }) {
    const cfg = e === 'PAGADA' ? { c: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30', I: Check, l: 'Pagada' }
      : e === 'VENCIDA' ? { c: 'text-red-400', bg: 'bg-red-400/10 border-red-400/30', I: AlertTriangle, l: 'Vencida' }
      : { c: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/30', I: Clock, l: 'Pendiente' };
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.c}`}><cfg.I className="w-3 h-3" /> {cfg.l}</span>;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── EDIT VIEW
  // ══════════════════════════════════════════════════════════════════════════

  if (view === 'edit' && activeContrato) {
    const c = activeContrato;
    const existingFiles = c.archivos || [];
    const SLOTS = [
      { tipo: 'CONTRATO', label: 'Foto del Contrato' }, { tipo: 'DNI_FRENTE', label: 'DNI Frente' },
      { tipo: 'DNI_DORSO', label: 'DNI Dorso' }, { tipo: 'FOTO_AUTO', label: 'Foto del Auto' },
    ];

    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button onClick={goBack} className="flex items-center gap-2 text-[#8892b0] hover:text-[#7b9ae8] transition-colors text-sm cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Volver a Ventas
          </button>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer w-full sm:w-auto">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {uploadingFile ? 'Subiendo...' : saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg sm:text-xl font-bold text-white">Editar Solicitud #{c.numeroContrato}</h1>
          <Select value={editData.estado || c.estado} onValueChange={v => ue('estado', v)}>
            <SelectTrigger className={`h-7 w-auto px-2.5 rounded-full text-[11px] font-semibold border gap-1 cursor-pointer bg-transparent ${estadoBadge(editData.estado || c.estado)}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10 min-w-[140px]">
              <SelectItem value="ACTIVO" className="text-emerald-400 focus:bg-emerald-400/10 focus:text-emerald-400 cursor-pointer">Activo</SelectItem>
              <SelectItem value="COMPLETADO" className="text-[#7b9ae8] focus:bg-[#4a6fd4]/10 focus:text-[#7b9ae8] cursor-pointer">Completado</SelectItem>
              <SelectItem value="CANCELADO" className="text-red-400 focus:bg-red-400/10 focus:text-red-400 cursor-pointer">Cancelado</SelectItem>
              <SelectItem value="DE_BAJA" className="text-zinc-400 focus:bg-zinc-400/10 focus:text-zinc-400 cursor-pointer">De Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Asignar vendedor (solo admin) */}
        {isAdmin && vendedores.length > 0 && (
          <Card className="border-[#4a6fd4]/8 bg-[#131729] p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[#7b9ae8] mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Asignado a</h3>
            <Select value={String(editData.registradoPorId || '')} onValueChange={v => ue('registradoPorId', Number(v))}>
              <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer w-full sm:w-64"><SelectValue placeholder="Seleccionar vendedor" /></SelectTrigger>
              <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                {vendedores.map(v => <SelectItem key={v.id} value={String(v.id)} className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">{v.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </Card>
        )}

        {/* Venta */}
        <Card className="border-[#4a6fd4]/8 bg-[#131729] p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-[#7b9ae8] mb-4 flex items-center gap-2"><FileText className="w-4 h-4" /> Datos de la Venta</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            <div><label className={lc}>Nro. Solicitud</label><Input className={ic} value={editData.numeroContrato} onChange={e => ue('numeroContrato', e.target.value)} /></div>
            <div><label className={lc}>Punto de Venta</label>
              <Select value={editData.puntoVenta} onValueChange={v => ue('puntoVenta', v)}><SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">{Object.entries(PUNTO_VENTA_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">{v}</SelectItem>)}</SelectContent></Select></div>
            <div><label className={lc}>Asesor</label><Input className={ic} value={editData.productorAsesor} onChange={e => ue('productorAsesor', e.target.value)} /></div>
            <div><label className={lc}>Tipo Vehículo</label>
              <Select value={editData.tipoVehiculo} onValueChange={v => ue('tipoVehiculo', v)}><SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                  <SelectItem value="AUTO" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Auto</SelectItem>
                  <SelectItem value="UTILITARIO" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Utilitario</SelectItem>
                  <SelectItem value="CAMIONETA" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Camioneta</SelectItem>
                </SelectContent></Select></div>
            <div><label className={lc}>Marca</label><Input className={ic} value={editData.marca} onChange={e => ue('marca', e.target.value)} /></div>
            <div><label className={lc}>Modelo</label><Input className={ic} value={editData.modelo} onChange={e => ue('modelo', e.target.value)} /></div>
            <div><label className={lc}>Anticipo ($)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8892b0]/60 text-sm">$</span><Input className={`${ic} pl-7`} inputMode="numeric" value={currencyInput(String(editData.anticipoMensual || ''))} onChange={e => ue('anticipoMensual', currencyRaw(e.target.value))} /></div></div>
            <div><label className={lc}>Período de Pago</label>
              <Select value={editData.periodoPago} onValueChange={v => ue('periodoPago', v)}><SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">{Object.entries(PERIODO_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">{v}</SelectItem>)}</SelectContent></Select></div>
          </div>
        </Card>

        {/* Solicitante */}
        <Card className="border-[#4a6fd4]/8 bg-[#131729] p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-[#7b9ae8] mb-4 flex items-center gap-2"><User className="w-4 h-4" /> Datos del Solicitante</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            <div><label className={lc}>Nombre</label><Input className={ic} value={editData.solicitanteNombre} onChange={e => ue('solicitanteNombre', e.target.value)} /></div>
            <div><label className={lc}>DNI</label><Input className={ic} value={editData.solicitanteDni} onChange={e => ue('solicitanteDni', e.target.value)} /></div>
            <div><label className={lc}>Fecha Nac.</label><DatePicker value={editData.solicitanteFechaNac} onChange={v => ue('solicitanteFechaNac', v)} placeholder="Fecha de nacimiento" fromYear={1940} toYear={new Date().getFullYear() - 16} /></div>
            <div><label className={lc}>Estado Civil</label><Input className={ic} value={editData.solicitanteEstadoCivil} onChange={e => ue('solicitanteEstadoCivil', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={lc}>Domicilio</label><Input className={ic} value={editData.solicitanteDomicilio} onChange={e => ue('solicitanteDomicilio', e.target.value)} /></div>
            <div><label className={lc}>Barrio</label><Input className={ic} value={editData.solicitanteBarrio} onChange={e => ue('solicitanteBarrio', e.target.value)} /></div>
            <div><label className={lc}>Localidad</label><Input className={ic} value={editData.solicitanteLocalidad} onChange={e => ue('solicitanteLocalidad', e.target.value)} /></div>
            <div><label className={lc}>Provincia</label><Input className={ic} value={editData.solicitanteProvincia} onChange={e => ue('solicitanteProvincia', e.target.value)} /></div>
            <div><label className={lc}>CP</label><Input className={ic} value={editData.solicitanteCp} onChange={e => ue('solicitanteCp', e.target.value)} /></div>
            <div><label className={lc}>Celular</label><Input className={ic} value={editData.solicitanteCelular} onChange={e => ue('solicitanteCelular', e.target.value)} /></div>
            <div><label className={lc}>Tel. Fijo</label><Input className={ic} value={editData.solicitanteTelFijo} onChange={e => ue('solicitanteTelFijo', e.target.value)} /></div>
            <div><label className={lc}>Hr. Contacto</label><Input className={ic} value={editData.solicitanteHrContacto} onChange={e => ue('solicitanteHrContacto', e.target.value)} /></div>
            <div><label className={lc}>Ocupación</label><Input className={ic} value={editData.solicitanteOcupacion} onChange={e => ue('solicitanteOcupacion', e.target.value)} /></div>
            <div><label className={lc}>Email</label><Input className={ic} type="email" value={editData.solicitanteEmail} onChange={e => ue('solicitanteEmail', e.target.value)} /></div>
          </div>
        </Card>

        {/* Otros */}
        <Card className="border-[#4a6fd4]/8 bg-[#131729] p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-[#7b9ae8] mb-4">Otros</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className={lc}>Cómo llegó</label>
              <Select value={editData.comoLlego || undefined} onValueChange={v => ue('comoLlego', v)}>
                <SelectTrigger className={`${ic} cursor-pointer`}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                  {['Instagram', 'Facebook', 'Radio', 'Recomendación', 'Publicidad', 'Visita espontánea', 'Otro'].map(c => (
                    <SelectItem key={c} value={c} className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><label className={lc}>Observaciones</label>
              <Textarea className="bg-[#1a2040] border-[#4a6fd4]/10 text-white placeholder:text-[#8892b0]/50 focus:ring-[#4a6fd4] rounded-lg w-full px-3 py-2 text-sm outline-none border transition-shadow focus:ring-2 min-h-[80px]"
                value={editData.observaciones} onChange={e => ue('observaciones', e.target.value)} /></div>
          </div>
        </Card>

        {/* Documentación */}
        <Card className="border-[#4a6fd4]/8 bg-[#131729] p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-[#7b9ae8] mb-4 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Documentación</h3>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {SLOTS.map(slot => {
              const existing = existingFiles.find((a: any) => a.tipo === slot.tipo);
              const nf = newFiles.find(f => f.tipo === slot.tipo);
              return (
                <div key={slot.tipo}>
                  <label className={lc}>{slot.label}</label>
                  {existing ? (
                    <div className="relative group rounded-lg overflow-hidden border border-[#4a6fd4]/10 bg-[#1a2040]">
                      <img src={existing.url} alt={slot.label} className="w-full h-28 sm:h-36 object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button onClick={() => addFile(slot.tipo)} className="p-2 rounded-lg bg-[#4a6fd4] text-white cursor-pointer"><Upload className="w-4 h-4" /></button>
                        {canDelete && <button onClick={() => deleteFile(existing.id)} disabled={deletingFileId === existing.id} className="p-2 rounded-lg bg-red-500 text-white cursor-pointer disabled:opacity-50">
                          {deletingFileId === existing.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</button>}
                      </div>
                      {nf && <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-amber-500 text-[9px] font-bold text-white">REEMPLAZAR</div>}
                    </div>
                  ) : nf ? (
                    <div className="relative group rounded-lg overflow-hidden border border-emerald-400/20 bg-[#1a2040]">
                      {nf.file.type.startsWith('image/') ? <img src={nf.preview} alt={slot.label} className="w-full h-28 sm:h-36 object-cover" />
                        : <div className="w-full h-28 sm:h-36 flex flex-col items-center justify-center"><FileText className="w-8 h-8 text-[#4a6fd4]" /><span className="text-[10px] text-[#8892b0] truncate max-w-full px-1">{nf.file.name}</span></div>}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button onClick={() => addFile(slot.tipo)} className="p-2 rounded-lg bg-[#4a6fd4] text-white cursor-pointer"><Upload className="w-4 h-4" /></button>
                        <button onClick={() => { URL.revokeObjectURL(nf.preview); setNewFiles(p => p.filter(f => f.tipo !== slot.tipo)); }} className="p-2 rounded-lg bg-red-500 text-white cursor-pointer"><X className="w-4 h-4" /></button>
                      </div>
                      <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-emerald-500 text-[9px] font-bold text-white">NUEVO</div>
                    </div>
                  ) : (
                    <button onClick={() => addFile(slot.tipo)} className="w-full h-28 sm:h-36 rounded-lg border-2 border-dashed border-[#4a6fd4]/20 bg-[#1a2040]/50 hover:bg-[#1a2040] hover:border-[#4a6fd4]/40 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer">
                      <Upload className="w-5 h-5 text-[#4a6fd4]/50" /><span className="text-[10px] sm:text-xs text-[#8892b0]">Subir</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="flex justify-end pb-4">
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer w-full sm:w-auto justify-center">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── DETAIL VIEW
  // ══════════════════════════════════════════════════════════════════════════

  if (view === 'detail' && activeContrato) {
    const c = activeContrato;
    const cuotas = c.cuotas || [];
    const pagadas = cuotas.filter((q: any) => q.estado === 'PAGADA').length;
    const totalQ = cuotas.length;
    const pct = totalQ > 0 ? (pagadas / totalQ) * 100 : 0;

    return (
      <div className="space-y-4 sm:space-y-6">
        <button onClick={goBack} className="flex items-center gap-2 text-[#8892b0] hover:text-[#7b9ae8] transition-colors text-sm cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Volver a Ventas
        </button>

        {/* Header */}
        <Card className="border-[#4a6fd4]/8 bg-[#131729] p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:gap-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h1 className="text-lg sm:text-xl font-bold text-white">Solicitud #{c.numeroContrato}</h1>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${estadoBadge(c.estado)}`}>{c.estado}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-[#8892b0]">
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {c.solicitanteNombre}</span>
                  <span className="flex items-center gap-1"><Car className="w-3.5 h-3.5" /> {fmtVehiculo(c.marca, c.modelo)}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {fmtDate(c.fechaCreacion)}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full sm:w-auto sm:shrink-0">
                <div className="p-2 sm:p-3 rounded-lg bg-[#4a6fd4]/5 border border-[#4a6fd4]/10 text-center">
                  <div className="text-sm sm:text-lg font-bold text-[#7b9ae8] truncate">{fmt(c.anticipoMensual)}</div>
                  <div className="text-[9px] sm:text-[10px] text-[#8892b0] uppercase tracking-wider mt-0.5">Anticipo</div>
                </div>
                <div className="p-2 sm:p-3 rounded-lg bg-emerald-400/5 border border-emerald-400/10 text-center">
                  <div className="text-sm sm:text-lg font-bold text-emerald-400">{pagadas}/{totalQ}</div>
                  <div className="text-[9px] sm:text-[10px] text-[#8892b0] uppercase tracking-wider mt-0.5">Cuotas</div>
                </div>
                <div className="p-2 sm:p-3 rounded-lg bg-amber-400/5 border border-amber-400/10 text-center">
                  <div className="text-sm sm:text-lg font-bold text-amber-400 truncate">{PERIODO_LABELS[c.periodoPago] || c.periodoPago}</div>
                  <div className="text-[9px] sm:text-[10px] text-[#8892b0] uppercase tracking-wider mt-0.5">Periodo</div>
                </div>
              </div>
            </div>

            {totalQ > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs text-[#8892b0] mb-1"><span>Progreso</span><span>{Math.round(pct)}%</span></div>
                <div className="h-2 rounded-full bg-[#0b0e18] overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} /></div>
              </div>
            )}
          </div>
        </Card>

        {/* Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <Card className="border-[#4a6fd4]/8 bg-[#131729] p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[#7b9ae8] mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Solicitante</h3>
            <InfoRow label="Nombre" value={c.solicitanteNombre} /><InfoRow label="DNI" value={c.solicitanteDni} />
            <InfoRow label="Fecha Nac." value={fmtDate(c.solicitanteFechaNac)} /><InfoRow label="Estado Civil" value={c.solicitanteEstadoCivil} />
            <InfoRow label="Ocupación" value={c.solicitanteOcupacion} /><InfoRow label="Email" value={c.solicitanteEmail} />
          </Card>
          <Card className="border-[#4a6fd4]/8 bg-[#131729] p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[#7b9ae8] mb-3 flex items-center gap-2"><Phone className="w-4 h-4" /> Contacto</h3>
            <InfoRow label="Celular" value={c.solicitanteCelular} /><InfoRow label="Tel. Fijo" value={c.solicitanteTelFijo} />
            <InfoRow label="Hr. Contacto" value={c.solicitanteHrContacto} /><InfoRow label="Domicilio" value={c.solicitanteDomicilio} />
            <InfoRow label="Barrio" value={c.solicitanteBarrio} /><InfoRow label="Localidad" value={c.solicitanteLocalidad} />
            <InfoRow label="Provincia" value={c.solicitanteProvincia} /><InfoRow label="CP" value={c.solicitanteCp} />
          </Card>
          <Card className="border-[#4a6fd4]/8 bg-[#131729] p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[#7b9ae8] mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Venta</h3>
            <InfoRow label="Punto de Venta" value={PUNTO_VENTA_LABELS[c.puntoVenta] || c.puntoVenta} />
            <InfoRow label="Asesor" value={c.productorAsesor} /><InfoRow label="Tipo" value={c.tipoVehiculo} />
            <InfoRow label="Vehículo" value={fmtVehiculo(c.marca, c.modelo)} /><InfoRow label="Anticipo" value={fmt(c.anticipoMensual)} />
            <InfoRow label="Periodo" value={PERIODO_LABELS[c.periodoPago] || c.periodoPago} />
            <InfoRow label="Cuotas" value={String(c.cantidadCuotas)} /><InfoRow label="Cómo llegó" value={c.comoLlego} />
            <InfoRow label="Registrado por" value={c.registradoPor?.nombre} />
          </Card>
          <Card className="border-[#4a6fd4]/8 bg-[#131729] p-4 sm:p-5">
            {c.conyugeNombre && (<><h3 className="text-sm font-semibold text-[#7b9ae8] mb-3">Cónyuge</h3><InfoRow label="Nombre" value={c.conyugeNombre} /><InfoRow label="DNI" value={c.conyugeDni} /><InfoRow label="Tel." value={c.conyugeTelefono} /><div className="my-3" /></>)}
            <h3 className="text-sm font-semibold text-[#7b9ae8] mb-3 flex items-center gap-2"><Car className="w-4 h-4" /> Usado</h3>
            {c.tieneVehiculoUsado ? (<><InfoRow label="Marca" value={c.usadoMarca} /><InfoRow label="Modelo" value={c.usadoModelo} /><InfoRow label="Año" value={c.usadoAnio ? String(c.usadoAnio) : undefined} /><InfoRow label="Color" value={c.usadoColor} /><InfoRow label="Combustible" value={c.usadoCombustible} /></>)
              : <p className="text-sm text-[#8892b0]">No tiene</p>}
          </Card>
        </div>

        {c.observaciones && <Card className="border-[#4a6fd4]/8 bg-[#131729] p-4 sm:p-5"><h3 className="text-sm font-semibold text-[#7b9ae8] mb-2">Observaciones</h3><p className="text-sm text-[#8892b0] whitespace-pre-wrap">{c.observaciones}</p></Card>}

        {/* Cuotas */}
        {cuotas.length > 0 && (
          <Card className="border-[#4a6fd4]/8 bg-[#131729] overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-[#4a6fd4]/10"><h3 className="text-sm font-semibold text-[#7b9ae8] flex items-center gap-2"><DollarSign className="w-4 h-4" /> Cuotas ({cuotas.length})</h3></div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#4a6fd4]/10 bg-[#0b0e18]/50"><th className="text-left px-4 py-2.5 text-[#8892b0] font-medium">#</th><th className="text-right px-4 py-2.5 text-[#8892b0] font-medium">Monto</th><th className="text-center px-4 py-2.5 text-[#8892b0] font-medium">Venc.</th><th className="text-center px-4 py-2.5 text-[#8892b0] font-medium">Estado</th><th className="text-center px-4 py-2.5 text-[#8892b0] font-medium">Pago</th><th className="text-center px-4 py-2.5 text-[#8892b0] font-medium">Fecha Pago</th></tr></thead>
                <tbody>{cuotas.map((q: any) => (
                  <tr key={q.id} className="border-b border-[#4a6fd4]/5"><td className="px-4 py-2.5 text-white font-medium">{q.numeroCuota}</td><td className="px-4 py-2.5 text-right text-white">{fmt(q.monto)}</td><td className="px-4 py-2.5 text-center text-[#8892b0]">{fmtDate(q.fechaVencimiento)}</td><td className="px-4 py-2.5 text-center"><CuotaBadge estado={q.estado} /></td><td className="px-4 py-2.5 text-center text-[#8892b0]">{q.formaPago || '-'}</td><td className="px-4 py-2.5 text-center text-[#8892b0]">{q.fechaPago ? fmtDate(q.fechaPago) : '-'}</td></tr>
                ))}</tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-[#4a6fd4]/10">
              {cuotas.map((q: any) => (
                <div key={q.id} className="p-3 space-y-1.5">
                  <div className="flex justify-between items-center"><span className="text-white font-medium text-sm">Cuota {q.numeroCuota}</span><CuotaBadge estado={q.estado} /></div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div><span className="text-[#8892b0]">Monto: </span><span className="text-white">{fmt(q.monto)}</span></div>
                    <div className="text-right"><span className="text-[#8892b0]">Venc: </span><span className="text-white">{fmtDate(q.fechaVencimiento)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Archivos */}
        {c.archivos && c.archivos.length > 0 && (
          <Card className="border-[#4a6fd4]/8 bg-[#131729] p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[#7b9ae8] mb-3">Documentación</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {c.archivos.map((a: any) => (
                <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-[#4a6fd4]/10 hover:border-[#4a6fd4]/30 transition-colors">
                  <img src={a.url} alt={a.tipo} className="w-full h-20 sm:h-28 object-cover bg-[#0b0e18]" />
                  <div className="p-1.5 text-center"><span className="text-[9px] sm:text-[10px] text-[#8892b0]">{a.tipo.replace('_', ' ')}</span></div>
                </a>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── LIST VIEW
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Ventas - Solicitudes</h1>
          <p className="text-sm text-[#8892b0] mt-0.5">{!loading && <>{total} contrato{total !== 1 ? 's' : ''}</>}</p>
        </div>
        {canCreate && (
          <Button onClick={() => onNavigate('admin-contrato-nuevo')} className="bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] hover:from-[#1a3278] hover:to-[#2648a1] text-white font-semibold shadow-lg shadow-[#2648a1]/25 h-10 px-5 w-full sm:w-auto cursor-pointer">
            <Plus className="w-4 h-4 mr-2" /> Nueva Solicitud
          </Button>
        )}
      </div>

      {/* Filters - instant search like Cobranzas */}
      <Card className="border-[#4a6fd4]/8 bg-[#131729] p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892b0]/60" />
            <Input placeholder="Buscar por nombre, DNI o nro..." value={search} onChange={e => handleSearch(e.target.value)}
              className="pl-10 bg-[#1a2040] border-[#4a6fd4]/10 h-10 text-white placeholder:text-[#8892b0]/50 focus:ring-[#4a6fd4]" />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full lg:w-48">
              <Select value={estado || 'ALL'} onValueChange={handleEstado}>
                <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                  <SelectItem value="ALL" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Todos los estados</SelectItem>
                  {ESTADOS.map(e => <SelectItem key={e} value={e} className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">{e.charAt(0) + e.slice(1).toLowerCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {puedeVerTodos('VENTAS') && asesoresList.length > 0 && (
              <div className="w-full lg:w-48">
                <Select value={asesor} onValueChange={handleAsesor}>
                  <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                    <SelectItem value="ALL" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Todos los asesores</SelectItem>
                    {asesoresList.map(a => <SelectItem key={a} value={a} className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="w-full lg:w-44">
              <DatePicker value={desde} onChange={handleDesde} placeholder="Desde" />
            </div>
            <div className="w-full lg:w-44">
              <DatePicker value={hasta} onChange={handleHasta} placeholder="Hasta" />
            </div>
          </div>
        </div>
      </Card>

      {/* Desktop Table */}
      <Card className="border-[#4a6fd4]/8 bg-[#131729] overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#4a6fd4]/10">
                <th className="text-left px-3 xl:px-4 py-3 text-[10px] font-bold text-[#8892b0] uppercase tracking-wider"><div className="flex items-center gap-1"><Hash className="w-3 h-3" /> Nro</div></th>
                <th className="text-left px-3 xl:px-4 py-3 text-[10px] font-bold text-[#8892b0] uppercase tracking-wider"><div className="flex items-center gap-1"><User className="w-3 h-3" /> Solicitante</div></th>
                <th className="text-left px-3 xl:px-4 py-3 text-[10px] font-bold text-[#8892b0] uppercase tracking-wider hidden xl:table-cell">DNI</th>
                <th className="text-left px-3 xl:px-4 py-3 text-[10px] font-bold text-[#8892b0] uppercase tracking-wider hidden lg:table-cell"><div className="flex items-center gap-1"><Car className="w-3 h-3" /> Vehículo</div></th>
                <th className="text-left px-3 xl:px-4 py-3 text-[10px] font-bold text-[#8892b0] uppercase tracking-wider hidden xl:table-cell"><div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Localidad</div></th>
                <th className="text-center px-3 xl:px-4 py-3 text-[10px] font-bold text-[#8892b0] uppercase tracking-wider">Cuotas</th>
                <th className="text-left px-3 xl:px-4 py-3 text-[10px] font-bold text-[#8892b0] uppercase tracking-wider">Estado</th>
                <th className="text-left px-3 xl:px-4 py-3 text-[10px] font-bold text-[#8892b0] uppercase tracking-wider hidden lg:table-cell"><div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Fecha</div></th>
                <th className="text-center px-3 xl:px-4 py-3 text-[10px] font-bold text-[#8892b0] uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <tr key={i} className="border-b border-[#4a6fd4]/8">{Array.from({ length: 9 }).map((__, j) => <td key={j} className="px-3 xl:px-4 py-3"><Skeleton className="h-4 w-full bg-[#1a2040]" /></td>)}</tr>)
              ) : contratos.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Inbox className="w-10 h-10 text-[#4a6fd4]/30 mb-3" />
                    <p className="text-[#8892b0]">{search || estado ? 'Sin resultados para estos filtros' : 'Sin contratos registrados'}</p>
                  </div>
                </td></tr>
              ) : contratos.map(ct => (
                <tr key={ct.id} className="border-b border-[#4a6fd4]/8 hover:bg-[#1a2040]/60 transition-colors">
                  <td className="px-3 xl:px-4 py-3 font-mono text-[#7b9ae8] font-semibold text-sm whitespace-nowrap">#{ct.numeroContrato}</td>
                  <td className="px-3 xl:px-4 py-3 text-white font-medium truncate max-w-[180px]">{ct.solicitanteNombre}</td>
                  <td className="px-3 xl:px-4 py-3 text-[#8892b0] font-mono text-xs hidden xl:table-cell">{ct.solicitanteDni}</td>
                  <td className="px-3 xl:px-4 py-3 text-[#8892b0] text-xs hidden lg:table-cell truncate max-w-[140px]">{fmtVehiculo(ct.marca, ct.modelo)}</td>
                  <td className="px-3 xl:px-4 py-3 text-[#8892b0] text-xs hidden xl:table-cell">{ct.solicitanteLocalidad || '-'}</td>
                  <td className="px-3 xl:px-4 py-3 text-[#8892b0] text-center">{ct._count?.cuotas ?? ct.cantidadCuotas ?? '-'}</td>
                  <td className="px-3 xl:px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${estadoBadge(ct.estado)}`}>{ct.estado}</span></td>
                  <td className="px-3 xl:px-4 py-3 text-[#8892b0] text-xs hidden lg:table-cell whitespace-nowrap">{fmtDate(ct.fechaCreacion)}</td>
                  <td className="px-3 xl:px-4 py-3">
                    <div className="flex items-center justify-center gap-0.5">
                      <button onClick={() => openView(ct, 'detail')} className="p-1.5 rounded-md text-[#7b9ae8] hover:text-white hover:bg-[#4a6fd4]/10 transition-colors cursor-pointer" title="Ver"><Eye className="w-4 h-4" /></button>
                      {puedeEditar('VENTAS', ct.registradoPor?.id) && ct.estado !== 'CANCELADO' && <button onClick={() => openView(ct, 'edit')} className="p-1.5 rounded-md text-amber-400 hover:text-white hover:bg-amber-400/10 transition-colors cursor-pointer" title="Editar"><Pencil className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile Cards */}
      <div className="md:hidden">
        {loading ? (
          <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="p-4 border-[#4a6fd4]/8 bg-[#131729]"><div className="space-y-3"><Skeleton className="h-4 w-3/4 bg-[#1a2040]" /><Skeleton className="h-3 w-1/2 bg-[#1a2040]" /><Skeleton className="h-3 w-2/3 bg-[#1a2040]" /></div></Card>)}</div>
        ) : contratos.length === 0 ? (
          <Card className="border-[#4a6fd4]/8 bg-[#131729] p-8 text-center"><Inbox className="w-10 h-10 text-[#4a6fd4]/30 mx-auto mb-3" /><p className="text-[#8892b0]">{search || estado ? 'Sin resultados' : 'Sin contratos'}</p></Card>
        ) : (
          <div className="grid gap-3">
            {contratos.map(ct => (
              <Card key={ct.id} className="border-[#4a6fd4]/8 bg-[#131729] p-3 sm:p-4 hover:bg-[#1a2040]/60 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="font-mono text-[#7b9ae8] font-semibold text-sm">#{ct.numeroContrato}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold border ${estadoBadge(ct.estado)}`}>{ct.estado}</span>
                    </div>
                    <h3 className="text-white font-medium text-sm truncate">{ct.solicitanteNombre}</h3>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <button onClick={() => openView(ct, 'detail')} className="p-1.5 rounded-md text-[#7b9ae8] hover:bg-[#4a6fd4]/10 cursor-pointer"><Eye className="w-4 h-4" /></button>
                    {puedeEditar('VENTAS', ct.registradoPor?.id) && ct.estado !== 'CANCELADO' && <button onClick={() => openView(ct, 'edit')} className="p-1.5 rounded-md text-amber-400 hover:bg-amber-400/10 cursor-pointer"><Pencil className="w-4 h-4" /></button>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div><span className="text-[#8892b0]/60">DNI </span><span className="text-[#8892b0] font-mono">{ct.solicitanteDni}</span></div>
                  <div><span className="text-[#8892b0]/60">Cuotas </span><span className="text-[#8892b0]">{ct._count?.cuotas ?? ct.cantidadCuotas}</span></div>
                  <div className="truncate"><span className="text-[#8892b0]/60">Vehículo </span><span className="text-[#8892b0]">{fmtVehiculo(ct.marca, ct.modelo)}</span></div>
                  <div><span className="text-[#8892b0]/60">Fecha </span><span className="text-[#8892b0]">{fmtDate(ct.fechaCreacion)}</span></div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[#8892b0] order-2 sm:order-1">Pág. {page} de {totalPages} ({total})</p>
          <div className="flex items-center gap-1.5 order-1 sm:order-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="border-[#4a6fd4]/20 text-[#7b9ae8] hover:bg-[#4a6fd4]/10 disabled:opacity-30 h-8 px-2 sm:px-3 cursor-pointer">
              <ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline ml-1">Anterior</span>
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pn = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                return <button key={pn} onClick={() => setPage(pn)} className={`w-8 h-8 rounded-md text-xs font-medium transition-colors cursor-pointer ${pn === page ? 'bg-[#4a6fd4] text-white' : 'text-[#8892b0] hover:bg-[#1a2040] hover:text-white'}`}>{pn}</button>;
              })}
            </div>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="border-[#4a6fd4]/20 text-[#7b9ae8] hover:bg-[#4a6fd4]/10 disabled:opacity-30 h-8 px-2 sm:px-3 cursor-pointer">
              <span className="hidden sm:inline mr-1">Siguiente</span><ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
