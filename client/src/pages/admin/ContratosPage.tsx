import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { contratosService } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import type { ViewType } from '@/types';
import { toast } from 'sonner';
import { currencyFormat, dateFormat, currencyInput, currencyRaw } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Search, Plus, FileText, ChevronLeft, ChevronRight, Calendar, User, Car,
  Hash, Inbox, ArrowLeft, Phone, MapPin, DollarSign, Clock, Check,
  AlertTriangle, Eye, Pencil, X, Loader2, Save, Upload, Trash2,
  Image as ImageIcon, RefreshCw,
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
  comoLlego?: string; observaciones?: string; montoDevolucion?: number | string | null;
  montoSellado?: number | string | null;
  estado: 'ACTIVO' | 'COMPLETADO' | 'CANCELADO' | 'DE_BAJA' | 'NEGOCIACION' | 'DEVOLUCION';
  fechaCreacion: string; registradoPor?: { id: number; nombre: string };
  _count?: { cuotas: number; archivos: number }; cuotas?: any[]; archivos?: any[];
}

interface ContratosPageProps { onNavigate: (view: ViewType) => void; }

// ── Constants & Helpers ──────────────────────────────────────────────────────

const ESTADOS = ['ACTIVO', 'NEGOCIACION', 'COMPLETADO', 'CANCELADO', 'DE_BAJA', 'DEVOLUCION'] as const;
const COMBUSTIBLES = ['Nafta', 'Diesel', 'GNC', 'Híbrido', 'Eléctrico'] as const;
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
    : e === 'NEGOCIACION' ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
    : e === 'COMPLETADO' ? 'bg-[#4a6fd4]/10 text-[#7b9ae8] border-[#4a6fd4]/20'
    : e === 'CANCELADO' ? 'bg-red-400/10 text-red-400 border-red-400/20'
    : e === 'DE_BAJA' ? 'bg-zinc-400/10 text-zinc-400 border-zinc-400/20'
    : e === 'DEVOLUCION' ? 'bg-orange-400/10 text-orange-400 border-orange-400/20'
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

function onlyDigits(val: string, maxLen?: number) {
  const digits = val.replace(/\D/g, '');
  return maxLen ? digits.slice(0, maxLen) : digits;
}

function DateInputManual({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = value ? value.split('-') : ['', '', ''];
  const [y, m, d] = [parts[0] || '', parts[1] || '', parts[2] || ''];

  const update = (dia: string, mes: string, anio: string) => {
    if (!dia && !mes && !anio) { onChange(''); return; }
    const dd = onlyDigits(dia, 2);
    const mm = onlyDigits(mes, 2);
    const yy = onlyDigits(anio, 4);
    if (dd && mm && yy.length === 4) {
      onChange(`${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
    } else {
      onChange(`${yy}-${mm}-${dd}`);
    }
  };

  const cls = `bg-[#1a2040] border-[#4a6fd4]/10 text-white text-center placeholder:text-[#8892b0]/50 focus:ring-[#4a6fd4] rounded-lg h-10 px-2 text-sm outline-none border transition-shadow focus:ring-2`;

  return (
    <div className="flex items-center gap-1.5">
      <input className={`${cls} w-14`} placeholder="DD" value={d} maxLength={2} inputMode="numeric"
        onChange={e => update(e.target.value, m, y)}
        onBlur={e => { const v = onlyDigits(e.target.value, 2); if (v && v.length === 1) update(v.padStart(2, '0'), m, y); }} />
      <span className="text-[#8892b0]/40">/</span>
      <input className={`${cls} w-14`} placeholder="MM" value={m} maxLength={2} inputMode="numeric"
        onChange={e => update(d, e.target.value, y)}
        onBlur={e => { const v = onlyDigits(e.target.value, 2); if (v && v.length === 1) update(d, v.padStart(2, '0'), y); }} />
      <span className="text-[#8892b0]/40">/</span>
      <input className={`${cls} w-20`} placeholder="AAAA" value={y} maxLength={4} inputMode="numeric"
        onChange={e => update(d, m, e.target.value)} />
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
  const [syncModal, setSyncModal] = useState(false);
  const [syncData, setSyncData] = useState<{ asesor: string; contratos: number; vendedor: string }[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { puedeEditar } = useAuth();
  const [vendedores, setVendedores] = useState<{ id: number; nombre: string }[]>([]);

  // COMPLETADO flow
  const [completadoModal, setCompletadoModal] = useState(false);
  const [completadoStep, setCompletadoStep] = useState<'opciones' | 'tipo_financiamiento' | 'datos_casa'>('opciones');
  const [finCuotas, setFinCuotas] = useState('');
  const [finMonto, setFinMonto] = useState('');
  const [finTasa, setFinTasa] = useState('');
  const [finMesInicio, setFinMesInicio] = useState('');
  const [finDiaVenc, setFinDiaVenc] = useState('1');

  // Load vendedores list for filter + edit
  useEffect(() => {
    contratosService.listarVendedores().then(r => {
      const list = r.data || [];
      setVendedores(list);
      if (puedeVerTodos('VENTAS')) {
        setAsesoresList(list.map((v: { nombre: string }) => v.nombre));
      }
    }).catch(() => {});
  }, []);

  // ── Debounced search ───────────────────────────────────────────────────

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
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
      tieneVehiculoUsado: c.tieneVehiculoUsado || false,
      usadoMarca: c.usadoMarca || '', usadoModelo: c.usadoModelo || '',
      usadoAnio: c.usadoAnio ? String(c.usadoAnio) : '', usadoColor: c.usadoColor || '',
      usadoCombustible: c.usadoCombustible || '',
      comoLlego: c.comoLlego || '', observaciones: c.observaciones || '',
      montoDevolucion: c.montoDevolucion != null ? String(Number(c.montoDevolucion)) : '',
      montoSellado: c.montoSellado != null ? String(Number(c.montoSellado)) : '',
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
      payload.usadoAnio = payload.usadoAnio ? Number(payload.usadoAnio) : null;
      payload.montoDevolucion = payload.montoDevolucion ? Number(payload.montoDevolucion) : null;
      payload.montoSellado = payload.montoSellado ? Number(payload.montoSellado) : null;
      payload.solicitanteFechaNac = payload.solicitanteFechaNac ? new Date(payload.solicitanteFechaNac).toISOString() : null;
      if (payload.tipoFinanciamiento === 'CASA' && payload.financiamientoCuotas) {
        payload.financiamientoCuotas = Number(payload.financiamientoCuotas);
        payload.financiamientoValorCuota = Number(payload.financiamientoValorCuota);
        payload.financiamientoTasa = payload.financiamientoTasa ? Number(payload.financiamientoTasa) : null;
        payload.financiamientoDiaVenc = payload.financiamientoDiaVenc ? Number(payload.financiamientoDiaVenc) : 1;
      }
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
          {isAdmin ? (
            <Select value={editData.estado || c.estado} onValueChange={v => {
              const actual = editData.estado || c.estado;
              if (v === 'COMPLETADO' && actual !== 'COMPLETADO') {
                if (['CANCELADO', 'DE_BAJA', 'DEVOLUCION'].includes(actual)) {
                  toast.error(`No se puede completar un contrato en estado ${actual === 'DE_BAJA' ? 'De Baja' : actual === 'DEVOLUCION' ? 'Devolución' : 'Cancelado'}`);
                  return;
                }
                setCompletadoStep('opciones'); setFinCuotas(''); setFinMonto(''); setFinTasa('');
                { const now = new Date(); const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1); setFinMesInicio(`${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, '0')}`); setFinDiaVenc('1'); }
                setCompletadoModal(true);
              } else { ue('estado', v); }
            }}>
              <SelectTrigger className={`h-7 w-auto px-2.5 rounded-full text-[11px] font-semibold border gap-1 cursor-pointer bg-transparent ${estadoBadge(editData.estado || c.estado)}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10 min-w-[140px]">
                <SelectItem value="ACTIVO" className="text-emerald-400 focus:bg-emerald-400/10 focus:text-emerald-400 cursor-pointer">Activo</SelectItem>
                <SelectItem value="NEGOCIACION" className="text-amber-400 focus:bg-amber-400/10 focus:text-amber-400 cursor-pointer">Negociación</SelectItem>
                <SelectItem value="COMPLETADO" className="text-[#7b9ae8] focus:bg-[#4a6fd4]/10 focus:text-[#7b9ae8] cursor-pointer">Completado</SelectItem>
                <SelectItem value="CANCELADO" className="text-red-400 focus:bg-red-400/10 focus:text-red-400 cursor-pointer">Cancelado</SelectItem>
                <SelectItem value="DE_BAJA" className="text-zinc-400 focus:bg-zinc-400/10 focus:text-zinc-400 cursor-pointer">De Baja</SelectItem>
                <SelectItem value="DEVOLUCION" className="text-orange-400 focus:bg-orange-400/10 focus:text-orange-400 cursor-pointer">Devolución</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${estadoBadge(c.estado)}`}>{c.estado}</span>
          )}
        </div>

        {/* Monto devolución (solo para DEVOLUCION o DE_BAJA) */}
        {isAdmin && (editData.estado === 'DEVOLUCION' || editData.estado === 'DE_BAJA') && (
          <div className="flex items-center gap-3 mt-2">
            <label className="text-sm text-[#8892b0] whitespace-nowrap">Monto devolución:</label>
            <div className="relative w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8892b0]/60 text-sm">$</span>
              <Input className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-9 pl-7" inputMode="numeric"
                value={currencyInput(String(editData.montoDevolucion || ''))}
                onChange={e => ue('montoDevolucion', currencyRaw(e.target.value))} />
            </div>
          </div>
        )}

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
            <div><label className={lc}>Asesor</label>
              {isAdmin ? (
                <Select value={editData.productorAsesor || undefined} onValueChange={v => ue('productorAsesor', v)}>
                  <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                    {vendedores.map(v => <SelectItem key={v.id} value={v.nombre} className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">{v.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input className={`${ic} opacity-70`} value={editData.productorAsesor} readOnly />
              )}
            </div>
            <div><label className={lc}>Tipo Vehículo</label>
              <Select value={editData.tipoVehiculo} onValueChange={v => ue('tipoVehiculo', v)}><SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                  <SelectItem value="AUTO" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Auto</SelectItem>
                  <SelectItem value="CAMIONETA" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Camioneta</SelectItem>
                  <SelectItem value="UTILITARIO" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Utilitario</SelectItem>
                  <SelectItem value="MOTO" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Moto</SelectItem>
                  <SelectItem value="OTRO" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Otro</SelectItem>
                </SelectContent></Select></div>
            <div><label className={lc}>Marca</label><Input className={ic} value={editData.marca} onChange={e => ue('marca', e.target.value)} /></div>
            <div><label className={lc}>Modelo</label><Input className={ic} value={editData.modelo} onChange={e => ue('modelo', e.target.value)} /></div>
            <div><label className={lc}>Anticipo ($)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8892b0]/60 text-sm">$</span><Input className={`${ic} pl-7`} inputMode="numeric" value={currencyInput(String(editData.anticipoMensual || ''))} onChange={e => ue('anticipoMensual', currencyRaw(e.target.value))} /></div></div>
            <div><label className={lc}>Sellado ($)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8892b0]/60 text-sm">$</span><Input className={`${ic} pl-7`} inputMode="numeric" value={currencyInput(String(editData.montoSellado || ''))} onChange={e => ue('montoSellado', currencyRaw(e.target.value))} /></div></div>
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
            <div><label className={lc}>Fecha Nac. (DD/MM/AAAA)</label><DateInputManual value={editData.solicitanteFechaNac} onChange={v => ue('solicitanteFechaNac', v)} /></div>
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

        {/* Vehículo Usado */}
        <Card className="border-[#4a6fd4]/8 bg-[#131729] p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-4 cursor-pointer" onClick={() => ue('tieneVehiculoUsado', !editData.tieneVehiculoUsado)}>
            <Checkbox checked={editData.tieneVehiculoUsado}
              onCheckedChange={checked => ue('tieneVehiculoUsado', Boolean(checked))}
              className="border-[#4a6fd4]/30 data-[state=checked]:bg-[#4a6fd4] data-[state=checked]:border-[#4a6fd4] cursor-pointer" />
            <h3 className="text-sm font-semibold text-[#7b9ae8] flex items-center gap-2 select-none"><Car className="w-4 h-4" /> Vehículo Usado</h3>
          </div>
          {editData.tieneVehiculoUsado && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div><label className={lc}>Marca *</label><Input className={ic} value={editData.usadoMarca} onChange={e => ue('usadoMarca', e.target.value)} /></div>
              <div><label className={lc}>Modelo *</label><Input className={ic} value={editData.usadoModelo} onChange={e => ue('usadoModelo', e.target.value)} /></div>
              <div><label className={lc}>Año</label><Input className={ic} type="number" min="1970" max={new Date().getFullYear() + 1} value={editData.usadoAnio} onChange={e => ue('usadoAnio', e.target.value)} /></div>
              <div><label className={lc}>Color</label><Input className={ic} value={editData.usadoColor} onChange={e => ue('usadoColor', e.target.value)} /></div>
              <div className="sm:col-span-2">
                <label className={lc}>Combustible</label>
                <div className="flex flex-wrap gap-3 mt-1">
                  {COMBUSTIBLES.map(c => {
                    const selected = (editData.usadoCombustible || '').split(', ').filter(Boolean);
                    const isChecked = selected.includes(c);
                    return (
                      <div key={c} className="flex items-center gap-2 cursor-pointer" onClick={() => {
                        const next = isChecked ? selected.filter((s: string) => s !== c) : [...selected, c];
                        ue('usadoCombustible', next.join(', '));
                      }}>
                        <Checkbox checked={isChecked}
                          className="border-[#4a6fd4]/30 data-[state=checked]:bg-[#4a6fd4] data-[state=checked]:border-[#4a6fd4] cursor-pointer" />
                        <span className="text-sm text-white select-none">{c}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
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
            {c.montoSellado != null && Number(c.montoSellado) > 0 && <InfoRow label="Sellado" value={fmt(c.montoSellado)} />}
            <InfoRow label="Periodo" value={PERIODO_LABELS[c.periodoPago] || c.periodoPago} />
            <InfoRow label="Cuotas" value={String(c.cantidadCuotas)} /><InfoRow label="Cómo llegó" value={c.comoLlego} />
            <InfoRow label="Registrado por" value={c.registradoPor?.nombre} />
            {c.montoDevolucion != null && Number(c.montoDevolucion) > 0 && <InfoRow label="Monto Devolución" value={fmt(c.montoDevolucion)} />}
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

  const openSyncModal = async () => {
    setSyncModal(true);
    setSyncLoading(true);
    try {
      const res = await contratosService.listarAsesoresSync();
      setSyncData(res.data.map((a: { asesor: string; contratos: number }) => ({
        ...a,
        vendedor: vendedores.find(v => v.nombre.toLowerCase() === a.asesor.trim().toLowerCase())?.nombre || '',
      })));
    } catch {
      toast.error('Error al cargar asesores');
      setSyncModal(false);
    }
    setSyncLoading(false);
  };

  const handleApplySync = async () => {
    const asociaciones = syncData
      .filter(d => d.vendedor && d.vendedor !== d.asesor)
      .map(d => ({ asesor: d.asesor, vendedor: d.vendedor }));
    if (asociaciones.length === 0) {
      toast.info('No hay cambios para aplicar');
      return;
    }
    setSyncing(true);
    try {
      const res = await contratosService.syncAsesores(asociaciones);
      toast.success(`${res.data.actualizados} contrato${res.data.actualizados !== 1 ? 's' : ''} actualizado${res.data.actualizados !== 1 ? 's' : ''}`);
      setSyncModal(false);
      fetchContratos();
    } catch {
      toast.error('Error al sincronizar');
    }
    setSyncing(false);
  };

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
        <div className="flex gap-2 w-full sm:w-auto">
          {isAdmin && (
            <Button onClick={openSyncModal} variant="outline"
              className="border-[#4a6fd4]/20 text-[#7b9ae8] hover:bg-[#4a6fd4]/10 h-10 px-4 cursor-pointer">
              <RefreshCw className="w-4 h-4 mr-2" /> Sync Asesores
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => onNavigate('admin-contrato-nuevo')} className="bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] hover:from-[#1a3278] hover:to-[#2648a1] text-white font-semibold shadow-lg shadow-[#2648a1]/25 h-10 px-5 flex-1 sm:flex-none cursor-pointer">
              <Plus className="w-4 h-4 mr-2" /> Nueva Solicitud
            </Button>
          )}
        </div>
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
                  {ESTADOS.map(e => <SelectItem key={e} value={e} className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">{{ ACTIVO: 'Activo', NEGOCIACION: 'Negociación', COMPLETADO: 'Completado', CANCELADO: 'Cancelado', DE_BAJA: 'De baja', DEVOLUCION: 'Devolución' }[e]}</SelectItem>)}
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

      {/* Sync Asesores Modal */}
      {syncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !syncing && setSyncModal(false)} />
          <div className="relative bg-[#131729] border border-[#4a6fd4]/15 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#4a6fd4]/10">
              <div>
                <h2 className="text-base font-semibold text-white">Sincronizar Asesores</h2>
                <p className="text-xs text-[#8892b0] mt-0.5">Asociá cada asesor a un vendedor del sistema</p>
              </div>
              <button onClick={() => !syncing && setSyncModal(false)} className="p-1.5 rounded-md text-[#8892b0] hover:bg-[#1a2040] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {syncLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-[#4a6fd4] animate-spin" /></div>
              ) : syncData.length === 0 ? (
                <p className="text-center text-[#8892b0] py-8">No hay asesores para sincronizar</p>
              ) : (
                <div className="space-y-3">
                  {syncData.map((item, idx) => {
                    const yaCoincide = vendedores.some(v => v.nombre === item.asesor);
                    return (
                      <div key={item.asesor} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg border ${yaCoincide ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-[#4a6fd4]/10 bg-[#1a2040]'}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{item.asesor}</p>
                          <p className="text-[10px] text-[#8892b0]">{item.contratos} contrato{item.contratos !== 1 ? 's' : ''}</p>
                        </div>
                        {yaCoincide ? (
                          <span className="flex items-center gap-1.5 text-xs text-emerald-400 shrink-0"><Check className="w-3.5 h-3.5" /> Ya coincide</span>
                        ) : (
                          <Select value={item.vendedor || undefined} onValueChange={v => {
                            setSyncData(prev => prev.map((d, i) => i === idx ? { ...d, vendedor: v } : d));
                          }}>
                            <SelectTrigger className="bg-[#131729] border-[#4a6fd4]/15 text-white h-9 w-full sm:w-52 cursor-pointer text-xs">
                              <SelectValue placeholder="Asociar a..." />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                              {vendedores.map(v => (
                                <SelectItem key={v.id} value={v.nombre} className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer text-xs">{v.nombre}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#4a6fd4]/10">
              <p className="text-[10px] text-[#8892b0]">
                {syncData.filter(d => d.vendedor && d.vendedor !== d.asesor).length} cambio{syncData.filter(d => d.vendedor && d.vendedor !== d.asesor).length !== 1 ? 's' : ''} pendiente{syncData.filter(d => d.vendedor && d.vendedor !== d.asesor).length !== 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSyncModal(false)} disabled={syncing}
                  className="border-[#4a6fd4]/20 text-[#8892b0] hover:bg-[#1a2040] h-9 px-4 cursor-pointer text-xs">Cancelar</Button>
                <Button onClick={handleApplySync} disabled={syncing || syncData.filter(d => d.vendedor && d.vendedor !== d.asesor).length === 0}
                  className="bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] hover:from-[#1a3278] hover:to-[#2648a1] text-white h-9 px-5 cursor-pointer text-xs">
                  {syncing ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Aplicando...</> : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Aplicar Cambios</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETADO modal */}
      {completadoModal && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="!bg-[#131729] !border-[#4a6fd4]/20 w-full max-w-md shadow-2xl">
            <div className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Completar Contrato</h2>
                <button onClick={() => setCompletadoModal(false)} className="p-1 rounded-md text-[#8892b0] hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              {completadoStep === 'opciones' && (
                <div className="space-y-3">
                  <p className="text-sm text-[#8892b0]">¿El cliente tiene saldo pendiente?</p>
                  <button onClick={() => { ue('estado', 'COMPLETADO'); ue('tipoFinanciamiento', 'SIN_SALDO'); setCompletadoModal(false); }}
                    className="w-full flex items-center gap-3 p-4 rounded-lg border border-emerald-400/20 bg-emerald-400/5 hover:bg-emerald-400/10 text-left transition-colors cursor-pointer">
                    <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div><div className="text-sm font-semibold text-white">Sin saldo pendiente</div><div className="text-xs text-[#8892b0]">El contrato se completa sin deuda</div></div>
                  </button>
                  <button onClick={() => setCompletadoStep('tipo_financiamiento')}
                    className="w-full flex items-center gap-3 p-4 rounded-lg border border-amber-400/20 bg-amber-400/5 hover:bg-amber-400/10 text-left transition-colors cursor-pointer">
                    <DollarSign className="w-5 h-5 text-amber-400 shrink-0" />
                    <div><div className="text-sm font-semibold text-white">Con saldo pendiente</div><div className="text-xs text-[#8892b0]">Queda un saldo por financiar</div></div>
                  </button>
                </div>
              )}

              {completadoStep === 'tipo_financiamiento' && (
                <div className="space-y-3">
                  <p className="text-sm text-[#8892b0]">¿Cómo se financia el saldo?</p>
                  <button onClick={() => { ue('estado', 'COMPLETADO'); ue('tipoFinanciamiento', 'EXTERNO'); setCompletadoModal(false); }}
                    className="w-full flex items-center gap-3 p-4 rounded-lg border border-[#4a6fd4]/20 bg-[#4a6fd4]/5 hover:bg-[#4a6fd4]/10 text-left transition-colors cursor-pointer">
                    <Car className="w-5 h-5 text-[#7b9ae8] shrink-0" />
                    <div><div className="text-sm font-semibold text-white">Financiamiento externo</div><div className="text-xs text-[#8892b0]">Banco u otra entidad financia</div></div>
                  </button>
                  <button onClick={() => setCompletadoStep('datos_casa')}
                    className="w-full flex items-center gap-3 p-4 rounded-lg border border-purple-400/20 bg-purple-400/5 hover:bg-purple-400/10 text-left transition-colors cursor-pointer">
                    <DollarSign className="w-5 h-5 text-purple-400 shrink-0" />
                    <div><div className="text-sm font-semibold text-white">Financiamiento de la casa</div><div className="text-xs text-[#8892b0]">Di Parola financia el saldo</div></div>
                  </button>
                  <button onClick={() => setCompletadoStep('opciones')} className="text-xs text-[#8892b0] hover:text-white cursor-pointer flex items-center gap-1 mt-1"><ChevronLeft className="w-3 h-3" /> Volver</button>
                </div>
              )}

              {completadoStep === 'datos_casa' && (() => {
                const montoNum = Number(finMonto) || 0;
                const cuotasNum = Number(finCuotas) || 0;
                const tasaNum = Number(finTasa) || 0;
                const montoConInteres = tasaNum > 0 ? montoNum * (1 + tasaNum / 100) : montoNum;
                const valorCuota = cuotasNum > 0 ? Math.ceil(montoConInteres / cuotasNum) : 0;
                const mesesNombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
                const mesInicioLabel = finMesInicio ? (() => { const [y,m] = finMesInicio.split('-'); return `${mesesNombres[Number(m)-1]} ${y}`; })() : '';
                return (
                <div className="space-y-4">
                  <p className="text-sm text-[#8892b0]">Datos del financiamiento de la casa</p>
                  <div>
                    <label className={lc}>Monto a financiar *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8892b0]/60 text-sm">$</span>
                      <Input className={`${ic} pl-7`} inputMode="numeric" placeholder="500.000"
                        value={currencyInput(finMonto)} onChange={e => setFinMonto(currencyRaw(e.target.value))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lc}>Cantidad de cuotas *</label>
                      <Input className={ic} type="number" min="1" max="120" placeholder="12" value={finCuotas} onChange={e => setFinCuotas(e.target.value)} />
                    </div>
                    <div>
                      <label className={lc}>Tasa de interés % (opcional)</label>
                      <Input className={ic} type="number" step="0.01" min="0" max="100" placeholder="0.00" value={finTasa} onChange={e => setFinTasa(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lc}>Mes de inicio *</label>
                      <MonthYearPicker value={finMesInicio} onChange={setFinMesInicio} placeholder="Seleccionar mes" />
                    </div>
                    <div>
                      <label className={lc}>Día de vencimiento *</label>
                      <Select value={finDiaVenc} onValueChange={v => setFinDiaVenc(v)}>
                        <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer"><SelectValue placeholder="Día" /></SelectTrigger>
                        <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10 max-h-[250px]">
                          {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <SelectItem key={d} value={String(d)} className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer text-xs">{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {montoNum > 0 && cuotasNum > 0 && (
                    <div className="p-3 rounded-lg bg-purple-400/5 border border-purple-400/10 text-sm space-y-0.5">
                      {tasaNum > 0 && <div className="text-[#8892b0]">Total con interés ({tasaNum}%): <span className="text-white font-semibold">{currencyFormat(montoConInteres)}</span></div>}
                      <div className="text-[#8892b0]">{cuotasNum} cuotas de <span className="text-purple-400 font-semibold">{currencyFormat(valorCuota)}</span></div>
                      <div className="text-[#8892b0]">Inicio: <span className="text-white">{mesInicioLabel}</span> — Vencimiento día <span className="text-white">{finDiaVenc || '1'}</span></div>
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setCompletadoStep('tipo_financiamiento')} className="flex-1 px-4 py-2.5 rounded-lg border border-[#4a6fd4]/20 text-[#8892b0] text-sm hover:text-white cursor-pointer">Volver</button>
                    <button
                      disabled={!finCuotas || !finMonto || !finMesInicio || cuotasNum < 1 || montoNum < 1}
                      onClick={() => {
                        ue('estado', 'COMPLETADO');
                        ue('tipoFinanciamiento', 'CASA');
                        ue('financiamientoCuotas', String(cuotasNum));
                        ue('financiamientoValorCuota', String(valorCuota));
                        ue('financiamientoTasa', finTasa || null);
                        ue('financiamientoMesInicio', finMesInicio);
                        ue('financiamientoDiaVenc', String(Number(finDiaVenc) || 1));
                        setCompletadoModal(false);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
                      <Check className="w-4 h-4" /> Confirmar
                    </button>
                  </div>
                </div>
                );
              })()}
            </div>
          </Card>
        </div>,
      document.body)}
    </div>
  );
}
