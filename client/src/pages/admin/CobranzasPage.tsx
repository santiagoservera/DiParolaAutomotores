import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DollarSign, Search, Filter, Check, Clock, AlertTriangle, Loader2,
  Calendar, X, Car, User, FileText, ArrowLeft, Eye, Plus, Pencil, Save, Trash2,
  LayoutGrid, List, ChevronLeft, ChevronRight, MessageSquare, Paperclip, Download,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { Card, Input } from '@/components/ui';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cobranzasService, contratosService } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { currencyFormat, dateFormat, currencyInput, currencyRaw } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from 'sonner';

interface ContratoInfo {
  id: number; numeroContrato: string; solicitanteNombre: string;
  solicitanteDni: string; solicitanteCelular?: string; marca: string; modelo: string;
  periodoPago?: string; productorAsesor?: string; estado?: string;
  registradoPorId?: number; anticipoMensual?: number | string;
}

const CONTRATO_EST: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVO: { label: 'Activo', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  COMPLETADO: { label: 'Completado', color: 'text-[#7b9ae8]', bg: 'bg-[#4a6fd4]/10 border-[#4a6fd4]/20' },
  CANCELADO: { label: 'Cancelado', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
  DE_BAJA: { label: 'De Baja', color: 'text-zinc-400', bg: 'bg-zinc-400/10 border-zinc-400/20' },
};

interface Cuota {
  id: number; contratoId: number; numeroCuota: number; monto: number | string;
  fechaVencimiento: string; estado: 'PENDIENTE' | 'PAGADA' | 'VENCIDA';
  formaPago?: string; fechaPago?: string; observaciones?: string; contrato?: ContratoInfo;
}

interface ContratoGroup { contrato: ContratoInfo | undefined; cuotas: Cuota[]; }

const toNum = (v: number | string) => Number(v) || 0;
const fmt = currencyFormat;
const fmtD = dateFormat;

const EST: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  PAGADA: { color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30', icon: Check, label: 'Pagada' },
  PENDIENTE: { color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/30', icon: Clock, label: 'Pendiente' },
  VENCIDA: { color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/30', icon: AlertTriangle, label: 'Vencida' },
  DE_BAJA: { color: 'text-zinc-400', bg: 'bg-zinc-400/10 border-zinc-400/30', icon: X, label: 'De Baja' },
};

function fmtVeh(marca?: string, modelo?: string) {
  const m = marca && !marca.toUpperCase().includes('DEFINIR') ? marca : '';
  const mo = modelo && !modelo.toUpperCase().includes('DEFINIR') ? modelo : '';
  return [m, mo].filter(Boolean).join(' ') || 'Sin especificar';
}

// Estilos de card/row según estado del contrato
function contratoCardStyle(estado?: string, tieneVencidas?: boolean) {
  if (estado === 'DE_BAJA') return {
    card: '!border-zinc-500/30 border-l-2 !border-l-zinc-500 hover:!border-zinc-500/40 opacity-70',
    row: 'border-l-2 border-l-zinc-500 bg-zinc-500/[0.04] border-b-zinc-500/10 hover:bg-zinc-500/[0.07] opacity-70',
  };
  if (estado === 'CANCELADO') return {
    card: '!border-red-500/20 border-l-2 !border-l-red-400 hover:!border-red-500/30 opacity-75',
    row: 'border-l-2 border-l-red-400 bg-red-500/[0.03] border-b-red-500/10 hover:bg-red-500/[0.06] opacity-75',
  };
  if (estado === 'COMPLETADO') return {
    card: '!border-[#4a6fd4]/30 border-l-2 !border-l-[#4a6fd4] hover:!border-[#4a6fd4]/40',
    row: 'border-l-2 border-l-[#4a6fd4] bg-[#4a6fd4]/[0.03] border-b-[#4a6fd4]/10 hover:bg-[#4a6fd4]/[0.06]',
  };
  if (tieneVencidas) return {
    card: '!border-red-500/30 border-l-2 !border-l-red-500 hover:!border-red-500/40',
    row: 'border-l-2 border-l-red-500 bg-red-500/[0.04] border-b-red-500/10 hover:bg-red-500/[0.07]',
  };
  return {
    card: '!border-[#4a6fd4]/8 hover:border-[#4a6fd4]/20',
    row: 'border-[#4a6fd4]/5 hover:bg-[#4a6fd4]/[0.03]',
  };
}

const FORMAS_PAGO = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CHEQUE', 'DEPOSITO'] as const;

export function CobranzasPage() {
  const { tienePermiso, puedeVerTodos, puedeEditar } = useAuth();
  const canEdit = tienePermiso('COBRANZAS', 'editar');
  const receiptRef = useRef<HTMLDivElement>(null);

  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('ALL');
  const [estadoContrato, setEstadoContrato] = useState('ALL');
  const [periodo, setPeriodo] = useState('ALL');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [changingEstado, setChangingEstado] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [page, setPage] = useState(1);
  const LIMIT = 12;

  // Pay modal
  const [modalCuota, setModalCuota] = useState<Cuota | null>(null);
  const [formaPago, setFormaPago] = useState('EFECTIVO');
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0]);
  const [observaciones, setObservaciones] = useState('');
  const [paying, setPaying] = useState(false);

  // Delete cuota confirm
  const [deleteCuotaId, setDeleteCuotaId] = useState<number | null>(null);
  const [deletingCuota, setDeletingCuota] = useState(false);

  // Add cuota modal
  const [showAddCuota, setShowAddCuota] = useState(false);
  const [addContratoId, setAddContratoId] = useState<number | null>(null);
  const [addPeriodo, setAddPeriodo] = useState('');
  const [newMonto, setNewMonto] = useState('');
  const [newMes, setNewMes] = useState(String(new Date().getMonth())); // 0-11
  const [newAnio, setNewAnio] = useState(String(new Date().getFullYear()));
  const [newObs, setNewObs] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit cuota modal
  const [editCuota, setEditCuota] = useState<Cuota | null>(null);
  const [editMonto, setEditMonto] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [editObs, setEditObs] = useState('');
  const [saving, setSaving] = useState(false);

  // Asesor filter
  const [asesor, setAsesor] = useState('ALL');
  const [asesoresList, setAsesoresList] = useState<string[]>([]);

  // Observaciones modal
  const [obsCuota, setObsCuota] = useState<Cuota | null>(null);
  const [observacionesList, setObservacionesList] = useState<any[]>([]);
  const [newObsText, setNewObsText] = useState('');
  const [loadingObs, setLoadingObs] = useState(false);
  const [addingObs, setAddingObs] = useState(false);

  // Comprobantes modal
  const [compCuota, setCompCuota] = useState<Cuota | null>(null);
  const [comprobantesList, setComprobantesList] = useState<any[]>([]);
  const [loadingComp, setLoadingComp] = useState(false);
  const [uploadingComp, setUploadingComp] = useState(false);

  // Receipt modal
  const [receiptData, setReceiptData] = useState<any>(null);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [savingReceipt, setSavingReceipt] = useState(false);

  // Generar masivo modal
  const [showGenMasivo, setShowGenMasivo] = useState(false);
  const [genMeses, setGenMeses] = useState<number[]>([]);
  const [genAnio, setGenAnio] = useState(String(new Date().getFullYear()));
  const [generating, setGenerating] = useState(false);

  const loadCuotas = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { limit: 1000 };
      if (estado !== 'ALL') params.estado = estado;
      if (estadoContrato !== 'ALL') params.estadoContrato = estadoContrato;
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;
      if (asesor !== 'ALL') params.asesor = asesor;
      const res = await cobranzasService.listar(params);
      setCuotas(res.data.data);
    } catch { toast.error('Error al cargar cobranzas'); setCuotas([]); }
    finally { setLoading(false); }
  }, [estado, estadoContrato, desde, hasta, asesor]);

  useEffect(() => { loadCuotas(); }, [loadCuotas]);

  useEffect(() => {
    if (puedeVerTodos('COBRANZAS')) {
      contratosService.listarAsesores().then(r => setAsesoresList(r.data)).catch(() => {});
    }
  }, []);

  const grouped = useMemo(() => {
    const g = cuotas.reduce((acc, c) => {
      const k = c.contrato?.id || c.contratoId;
      if (!acc[k]) acc[k] = { contrato: c.contrato, cuotas: [] };
      acc[k].cuotas.push(c);
      return acc;
    }, {} as Record<number, ContratoGroup>);
    let entries = Object.entries(g).map(([id, group]) => ({ id: Number(id), ...group }));
    if (search.trim()) {
      const s = search.toLowerCase();
      entries = entries.filter(e =>
        e.contrato?.numeroContrato?.toLowerCase().includes(s) ||
        e.contrato?.solicitanteNombre?.toLowerCase().includes(s) ||
        e.contrato?.solicitanteDni?.includes(s)
      );
    }
    if (periodo !== 'ALL') {
      entries = entries.filter(e => e.contrato?.periodoPago === periodo);
    }
    return entries;
  }, [cuotas, search, periodo]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, estado, estadoContrato, periodo, desde, hasta, asesor]);

  const totalPages = Math.ceil(grouped.length / LIMIT);
  const paginated = useMemo(() => grouped.slice((page - 1) * LIMIT, page * LIMIT), [grouped, page]);

  const detailGroup = useMemo(() => detailId !== null ? grouped.find(g => g.id === detailId) || null : null, [detailId, grouped]);

  // Escape para cerrar modales
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (compCuota) { setCompCuota(null); setReceiptData(null); }
      else if (obsCuota) setObsCuota(null);
      else if (modalCuota) setModalCuota(null);
      else if (editCuota) setEditCuota(null);
      else if (showAddCuota) setShowAddCuota(false);
      else if (deleteCuotaId) setDeleteCuotaId(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [compCuota, obsCuota, modalCuota, editCuota, showAddCuota, deleteCuotaId]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handlePagar = async () => {
    if (!modalCuota) return;
    setPaying(true);
    try {
      await cobranzasService.pagar(modalCuota.id, { formaPago, fechaPago, observaciones });
      toast.success('Pago registrado');
      setModalCuota(null); setObservaciones(''); loadCuotas();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Error al registrar pago'); }
    finally { setPaying(false); }
  };

  const openPayModal = (c: Cuota) => {
    setModalCuota(c); setFormaPago('EFECTIVO');
    setFechaPago(new Date().toISOString().split('T')[0]); setObservaciones('');
  };

  const openAddModal = (contratoId: number, periodoPago: string) => {
    setAddContratoId(contratoId); setAddPeriodo(periodoPago);
    setNewMonto(''); setNewMes(String(new Date().getMonth()));
    setNewAnio(String(new Date().getFullYear())); setNewObs('');
    setShowAddCuota(true);
  };

  const calcVencimiento = (mes: number, anio: number, periodo: string) => {
    const dia = periodo === '1-10' ? 10 : periodo === '10-20' ? 20 : 30;
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    const d = new Date(anio, mes, Math.min(dia, ultimoDia));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleAdd = async () => {
    if (!addContratoId || !newMonto) return;
    setAdding(true);
    const fechaVenc = calcVencimiento(Number(newMes), Number(newAnio), addPeriodo);
    try {
      await cobranzasService.agregarCuota(addContratoId, {
        monto: Number(currencyRaw(newMonto) || newMonto),
        fechaVencimiento: fechaVenc, observaciones: newObs || undefined,
      });
      toast.success('Cuota agregada'); setShowAddCuota(false); loadCuotas();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Error al agregar cuota'); }
    finally { setAdding(false); }
  };

  const handleChangeEstadoContrato = async (contratoId: number, nuevoEstado: string) => {
    setChangingEstado(true);
    try {
      await contratosService.editar(contratoId, { estado: nuevoEstado });
      toast.success(`Estado cambiado a ${CONTRATO_EST[nuevoEstado]?.label || nuevoEstado}`);
      // Update locally for instant feedback + reload from server
      setCuotas(prev => prev.map(c =>
        c.contratoId === contratoId || c.contrato?.id === contratoId
          ? { ...c, contrato: c.contrato ? { ...c.contrato, estado: nuevoEstado } : c.contrato }
          : c
      ));
      loadCuotas();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Error al cambiar estado'); }
    finally { setChangingEstado(false); }
  };

  const handleDeleteCuota = async () => {
    if (!deleteCuotaId) return;
    setDeletingCuota(true);
    try {
      await cobranzasService.eliminarCuota(deleteCuotaId);
      toast.success('Cuota eliminada');
      setDeleteCuotaId(null);
      loadCuotas();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Error al eliminar cuota'); }
    finally { setDeletingCuota(false); }
  };

  const openEditModal = (c: Cuota) => {
    setEditCuota(c);
    setEditMonto(String(toNum(c.monto)));
    setEditFecha(c.fechaVencimiento?.split('T')[0] || '');
    setEditObs(c.observaciones || '');
  };

  const handleEditSave = async () => {
    if (!editCuota) return;
    setSaving(true);
    try {
      await cobranzasService.editar(editCuota.id, {
        monto: Number(currencyRaw(editMonto) || editMonto),
        fechaVencimiento: editFecha || undefined,
        observaciones: editObs || undefined,
      });
      toast.success('Cuota actualizada'); setEditCuota(null); loadCuotas();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Error al editar cuota'); }
    finally { setSaving(false); }
  };

  // ── Observaciones handlers ──────────────────────────────────────────────
  const openObsModal = async (cuota: Cuota) => {
    setObsCuota(cuota);
    setNewObsText('');
    setLoadingObs(true);
    try {
      const res = await cobranzasService.listarObservaciones(cuota.id);
      setObservacionesList(res.data);
    } catch { toast.error('Error al cargar observaciones'); }
    finally { setLoadingObs(false); }
  };

  const handleAddObs = async () => {
    if (!obsCuota || !newObsText.trim()) return;
    setAddingObs(true);
    try {
      await cobranzasService.agregarObservacion(obsCuota.id, newObsText.trim());
      setNewObsText('');
      const res = await cobranzasService.listarObservaciones(obsCuota.id);
      setObservacionesList(res.data);
      toast.success('Observacion agregada');
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Error'); }
    finally { setAddingObs(false); }
  };

  // ── Comprobantes handlers ─────────────────────────────────────────────
  const [compContrato, setCompContrato] = useState<ContratoInfo | null>(null);

  const openCompModal = async (cuota: Cuota, contratoInfo?: ContratoInfo) => {
    setCompCuota(cuota);
    setCompContrato(contratoInfo || cuota.contrato || null);
    setLoadingComp(true);
    try {
      const res = await cobranzasService.listarComprobantes(cuota.id);
      setComprobantesList(res.data);
    } catch { toast.error('Error al cargar comprobantes'); }
    finally { setLoadingComp(false); }
  };

  const handleUploadComp = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!compCuota || !e.target.files?.[0]) return;
    setUploadingComp(true);
    try {
      const fd = new FormData();
      fd.append('comprobante', e.target.files[0]);
      await cobranzasService.subirComprobante(compCuota.id, fd);
      toast.success('Comprobante subido');
      const res = await cobranzasService.listarComprobantes(compCuota.id);
      setComprobantesList(res.data);
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Error al subir'); }
    finally { setUploadingComp(false); e.target.value = ''; }
  };

  const handleDeleteComp = async (comprobanteId: number) => {
    if (!compCuota) return;
    try {
      await cobranzasService.eliminarComprobante(compCuota.id, comprobanteId);
      toast.success('Comprobante eliminado');
      setComprobantesList(prev => prev.filter(c => c.id !== comprobanteId));
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Error'); }
  };

  // ── Badge component ────────────────────────────────────────────────────

  function Badge({ estado: e }: { estado: string }) {
    const c = EST[e as keyof typeof EST] || EST.PENDIENTE;
    const I = c.icon;
    return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${c.bg} ${c.color}`}><I className="w-3 h-3" />{c.label}</span>;
  }

  // ── Helpers para recibo ──────────────────────────────────────────────────

  const handleSaveReceipt = async () => {
    if (!receiptRef.current || !receiptData) return;
    setSavingReceipt(true);
    try {
      const canvas = await html2canvas(receiptRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'));
      const fd = new FormData();
      fd.append('comprobante', blob, `recibo-${receiptData.contrato?.numeroContrato || 'pago'}.png`);
      const res = await cobranzasService.subirComprobante(receiptData.id, fd);
      setReceiptUrl(res.data.url);
      toast.success('Comprobante guardado');
    } catch { toast.error('Error al guardar comprobante'); }
    finally { setSavingReceipt(false); }
  };

  const handleDownloadReceipt = async () => {
    if (!receiptRef.current) return;
    try {
      const canvas = await html2canvas(receiptRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const link = document.createElement('a');
      link.download = `recibo-${receiptData?.contrato?.numeroContrato || 'pago'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch { toast.error('Error al generar imagen'); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ══════════════════════════════════════════════════════════════════════════

  if (detailGroup) {
    const { contrato, cuotas: dq } = detailGroup;
    const canEditThis = puedeEditar('COBRANZAS', contrato?.registradoPorId);
    const pagadas = dq.filter(c => c.estado === 'PAGADA').length;
    const totalQ = dq.length;
    const pct = totalQ > 0 ? (pagadas / totalQ) * 100 : 0;
    const totalPagado = dq.filter(c => c.estado === 'PAGADA').reduce((s, c) => s + toNum(c.monto), 0);
    const totalPendiente = dq.filter(c => c.estado !== 'PAGADA').reduce((s, c) => s + toNum(c.monto), 0);
    const totalGeneral = totalPagado + totalPendiente;

    return (
      <div className="space-y-4 sm:space-y-6">
        <button onClick={() => setDetailId(null)} className="flex items-center gap-2 text-[#8892b0] hover:text-[#7b9ae8] transition-colors text-sm cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Volver a Cobranzas
        </button>

        {/* Header */}
        <Card className="!bg-[#131729] !border-[#4a6fd4]/8 p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-[#4a6fd4]/20 to-[#2648a1]/10">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-[#7b9ae8]" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-lg sm:text-xl font-bold text-white">Solicitud #{contrato?.numeroContrato}</h1>
                  {canEditThis ? (
                    <Select value={contrato?.estado || 'ACTIVO'} onValueChange={v => contrato && handleChangeEstadoContrato(contrato.id, v)} disabled={changingEstado}>
                      <SelectTrigger className={`h-7 w-auto px-2.5 rounded-full text-[11px] font-semibold border gap-1 cursor-pointer bg-transparent ${CONTRATO_EST[contrato?.estado || 'ACTIVO']?.bg || ''} ${CONTRATO_EST[contrato?.estado || 'ACTIVO']?.color || ''}`}>
                        <SelectValue />
                        {changingEstado && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10 min-w-[140px]">
                        {Object.entries(CONTRATO_EST).map(([k, v]) => <SelectItem key={k} value={k} className={`${v.color} focus:bg-[#4a6fd4]/10 cursor-pointer`}>{v.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${CONTRATO_EST[contrato?.estado || 'ACTIVO']?.bg || ''} ${CONTRATO_EST[contrato?.estado || 'ACTIVO']?.color || ''}`}>
                      {CONTRATO_EST[contrato?.estado || 'ACTIVO']?.label || contrato?.estado}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-[#8892b0]">
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {contrato?.solicitanteNombre}</span>
                  <span className="flex items-center gap-1"><Car className="w-3.5 h-3.5" /> {fmtVeh(contrato?.marca, contrato?.modelo)}</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full lg:w-auto">
              <div className="p-2 sm:p-3 rounded-lg bg-emerald-400/5 border border-emerald-400/10 text-center">
                <div className="text-sm sm:text-lg font-bold text-emerald-400 truncate">{fmt(totalPagado)}</div>
                <div className="text-[9px] sm:text-[10px] text-[#8892b0] uppercase tracking-wider mt-0.5">Pagado</div>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-amber-400/5 border border-amber-400/10 text-center">
                <div className="text-sm sm:text-lg font-bold text-amber-400 truncate">{fmt(totalPendiente)}</div>
                <div className="text-[9px] sm:text-[10px] text-[#8892b0] uppercase tracking-wider mt-0.5">Pendiente</div>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-[#4a6fd4]/5 border border-[#4a6fd4]/10 text-center">
                <div className="text-sm sm:text-lg font-bold text-[#7b9ae8] truncate">{fmt(totalGeneral)}</div>
                <div className="text-[9px] sm:text-[10px] text-[#8892b0] uppercase tracking-wider mt-0.5">Total</div>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-purple-400/5 border border-purple-400/10 text-center">
                <div className="text-sm sm:text-lg font-bold text-purple-400">{pagadas}/{totalQ}</div>
                <div className="text-[9px] sm:text-[10px] text-[#8892b0] uppercase tracking-wider mt-0.5">Cuotas</div>
              </div>
            </div>
          </div>

          <div className="mt-4 sm:mt-5">
            <div className="flex items-center justify-between text-xs text-[#8892b0] mb-1.5"><span>Progreso</span><span>{Math.round(pct)}%</span></div>
            <div className="h-2.5 rounded-full bg-[#0b0e18] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </Card>

        {/* Add cuota */}
        {canEditThis && (
          <div className="flex justify-end">
            <button onClick={() => openAddModal(detailGroup.id, contrato?.periodoPago || '1-10')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer">
              <Plus className="w-4 h-4" /> Agregar Cuota
            </button>
          </div>
        )}

        {/* Cuotas */}
        <Card className="!bg-[#131729] !border-[#4a6fd4]/8 overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#4a6fd4]/10 bg-[#0b0e18]/50">
                  <th className="text-left px-4 py-3 text-[#8892b0] font-medium">Cuota</th>
                  <th className="text-right px-4 py-3 text-[#8892b0] font-medium">Monto</th>
                  <th className="text-center px-4 py-3 text-[#8892b0] font-medium">Vencimiento</th>
                  <th className="text-center px-4 py-3 text-[#8892b0] font-medium">Estado</th>
                  <th className="text-center px-4 py-3 text-[#8892b0] font-medium">Forma Pago</th>
                  <th className="text-center px-4 py-3 text-[#8892b0] font-medium">Fecha Pago</th>
                  <th className="text-right px-4 py-3 text-[#8892b0] font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {dq.map(q => (
                  <tr key={q.id} className="border-b border-[#4a6fd4]/5 hover:bg-[#4a6fd4]/[0.03] transition-colors">
                    <td className="px-4 py-3 text-white font-medium">Cuota {q.numeroCuota}</td>
                    <td className="px-4 py-3 text-right text-white font-medium">{fmt(toNum(q.monto))}</td>
                    <td className="px-4 py-3 text-center text-[#8892b0]">{fmtD(q.fechaVencimiento)}</td>
                    <td className="px-4 py-3 text-center"><Badge estado={q.estado} /></td>
                    <td className="px-4 py-3 text-center text-[#8892b0]">{q.formaPago || '-'}</td>
                    <td className="px-4 py-3 text-center text-[#8892b0]">{q.fechaPago ? fmtD(q.fechaPago) : '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEditThis && q.estado !== 'PAGADA' && (
                          <button onClick={() => openPayModal(q)} className="p-1.5 rounded-md text-emerald-400 hover:text-white hover:bg-emerald-400/10 transition-colors cursor-pointer" title="Registrar pago">
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => openObsModal(q)} className="p-1.5 rounded-md text-[#7b9ae8] hover:text-white hover:bg-[#4a6fd4]/10 transition-colors cursor-pointer" title="Observaciones">
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button onClick={() => openCompModal(q, contrato)} className="p-1.5 rounded-md text-purple-400 hover:text-white hover:bg-purple-400/10 transition-colors cursor-pointer" title="Comprobantes">
                          <Paperclip className="w-4 h-4" />
                        </button>
                        {canEditThis && (
                          <button onClick={() => openEditModal(q)} className="p-1.5 rounded-md text-amber-400 hover:text-white hover:bg-amber-400/10 transition-colors cursor-pointer" title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canEditThis && q.estado !== 'PAGADA' && (
                          <button onClick={() => setDeleteCuotaId(q.id)} className="p-1.5 rounded-md text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer" title="Eliminar">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-[#4a6fd4]/10">
            {dq.map(q => (
              <div key={q.id} className="p-3 sm:p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium text-sm">Cuota {q.numeroCuota}</span>
                  <Badge estado={q.estado} />
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs sm:text-sm">
                  <div><span className="text-[#8892b0]">Monto: </span><span className="text-white font-medium">{fmt(toNum(q.monto))}</span></div>
                  <div className="text-right"><span className="text-[#8892b0]">Venc: </span><span className="text-white">{fmtD(q.fechaVencimiento)}</span></div>
                  {q.formaPago && <div><span className="text-[#8892b0]">Pago: </span><span className="text-white">{q.formaPago}</span></div>}
                  {q.fechaPago && <div className="text-right"><span className="text-[#8892b0]">Fecha: </span><span className="text-white">{fmtD(q.fechaPago)}</span></div>}
                </div>
                <div className="flex gap-2 pt-1 flex-wrap">
                  {canEditThis && q.estado !== 'PAGADA' && (
                    <button onClick={() => openPayModal(q)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white text-xs font-semibold cursor-pointer">
                      <DollarSign className="w-3.5 h-3.5" /> Pagar
                    </button>
                  )}
                  <button onClick={() => openObsModal(q)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#4a6fd4]/20 text-[#7b9ae8] text-xs font-semibold hover:bg-[#4a6fd4]/10 cursor-pointer">
                    <MessageSquare className="w-3.5 h-3.5" /> Notas
                  </button>
                  <button onClick={() => openCompModal(q, contrato)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-purple-400/20 text-purple-400 text-xs font-semibold hover:bg-purple-400/10 cursor-pointer">
                    <Paperclip className="w-3.5 h-3.5" /> Comp.
                  </button>
                  {canEditThis && (
                    <button onClick={() => openEditModal(q)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-amber-400/20 text-amber-400 text-xs font-semibold hover:bg-amber-400/10 cursor-pointer">
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                  )}
                  {canEditThis && q.estado !== 'PAGADA' && (
                    <button onClick={() => setDeleteCuotaId(q.id)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-400/20 text-red-400 text-xs font-semibold hover:bg-red-400/10 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {renderPayModal()}
        {renderAddModal()}
        {renderEditModal()}
        {renderObsModal()}
        {renderCompModal()}
        
        {/* Delete cuota confirmation */}
        {deleteCuotaId && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <Card className="!bg-[#131729] !border-[#4a6fd4]/20 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-full bg-red-500/10"><Trash2 className="w-5 h-5 text-red-400" /></div>
                  <div><h3 className="text-lg font-semibold text-white">Eliminar Cuota</h3><p className="text-xs text-[#8892b0]">Esta acción no se puede deshacer</p></div>
                </div>
                <p className="text-sm text-[#8892b0]">¿Estás seguro de que querés eliminar esta cuota?</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteCuotaId(null)} disabled={deletingCuota} className="flex-1 px-4 py-2.5 rounded-lg border border-[#4a6fd4]/20 text-[#8892b0] text-sm hover:text-white cursor-pointer disabled:opacity-50">Cancelar</button>
                  <button onClick={handleDeleteCuota} disabled={deletingCuota} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
                    {deletingCuota ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {deletingCuota ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            </Card>
          </div>
        , document.body)}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODALS
  // ══════════════════════════════════════════════════════════════════════════

  function renderPayModal() {
    if (!modalCuota) return null;
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <Card className="!bg-[#131729] !border-[#4a6fd4]/20 w-full max-w-md shadow-2xl">
          <div className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Registrar Pago</h2>
              <button onClick={() => setModalCuota(null)} className="p-1 rounded-md text-[#8892b0] hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-3 rounded-lg bg-[#0b0f1a] border border-[#4a6fd4]/10 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-[#8892b0]">Cuota</span><span className="text-white font-medium">#{modalCuota.numeroCuota}</span></div>
              <div className="flex justify-between"><span className="text-[#8892b0]">Monto</span><span className="text-white font-medium">{fmt(toNum(modalCuota.monto))}</span></div>
              <div className="flex justify-between"><span className="text-[#8892b0]">Vencimiento</span><span className="text-white">{fmtD(modalCuota.fechaVencimiento)}</span></div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#8892b0] mb-1">Forma de Pago</label>
                <Select value={formaPago} onValueChange={setFormaPago}>
                  <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">{FORMAS_PAGO.map(fp => <SelectItem key={fp} value={fp} className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">{fp}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="block text-sm text-[#8892b0] mb-1">Fecha de Pago</label><DatePicker value={fechaPago} onChange={setFechaPago} /></div>
              <div>
                <label className="block text-sm text-[#8892b0] mb-1">Observaciones (opcional)</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} placeholder="Notas..."
                  className="w-full px-3 py-2 border border-[#4a6fd4]/20 rounded-lg bg-[#0b0f1a] text-white placeholder-[#8892b0]/50 focus:outline-none focus:ring-2 focus:ring-[#7b9ae8] resize-none text-sm" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setModalCuota(null)} disabled={paying} className="flex-1 px-4 py-2.5 rounded-lg border border-[#4a6fd4]/20 text-[#8892b0] text-sm font-medium hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer disabled:opacity-50">Cancelar</button>
              <button onClick={handlePagar} disabled={paying || !formaPago || !fechaPago}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
                {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {paying ? 'Procesando...' : 'Confirmar Pago'}
              </button>
            </div>
          </div>
        </Card>
      </div>
    , document.body);
  }

  function renderAddModal() {
    if (!showAddCuota) return null;
    const MESES_LABEL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const periodoLabel = addPeriodo === '1-10' ? 'día 10' : addPeriodo === '10-20' ? 'día 20' : 'día 30';
    const previewFecha = calcVencimiento(Number(newMes), Number(newAnio), addPeriodo);

    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <Card className="!bg-[#131729] !border-[#4a6fd4]/20 w-full max-w-md shadow-2xl">
          <div className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Agregar Cuota</h2>
              <button onClick={() => setShowAddCuota(false)} className="p-1 rounded-md text-[#8892b0] hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#8892b0] mb-1">Monto *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8892b0]/60 text-sm">$</span>
                  <Input className="!bg-[#0b0f1a] !border-[#4a6fd4]/20 !text-white pl-7" placeholder="300.000" inputMode="numeric"
                    value={currencyInput(newMonto)} onChange={e => setNewMonto(currencyRaw(e.target.value))} />
                </div>
              </div>

              {/* Mes + Año selector */}
              <div>
                <label className="block text-sm text-[#8892b0] mb-1">Mes de vencimiento</label>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={newMes} onValueChange={setNewMes}>
                    <SelectTrigger className="bg-[#0b0f1a] border-[#4a6fd4]/20 text-white h-10 cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10 max-h-[250px]">
                      {MESES_LABEL.map((m, i) => <SelectItem key={i} value={String(i)} className="text-white focus:bg-[#4a6fd4]/20 cursor-pointer">{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={newAnio} onValueChange={setNewAnio}>
                    <SelectTrigger className="bg-[#0b0f1a] border-[#4a6fd4]/20 text-white h-10 cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                      {[2025, 2026, 2027, 2028, 2029, 2030].map(y => <SelectItem key={y} value={String(y)} className="text-white focus:bg-[#4a6fd4]/20 cursor-pointer">{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-[#8892b0]/60 mt-1.5">
                  Periodo: {addPeriodo} → vence el <span className="text-white font-medium">{periodoLabel}</span> · Fecha: <span className="text-[#7b9ae8] font-medium">{dateFormat(previewFecha)}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm text-[#8892b0] mb-1">Observaciones (opcional)</label>
                <textarea value={newObs} onChange={e => setNewObs(e.target.value)} rows={2} placeholder="Notas..."
                  className="w-full px-3 py-2 border border-[#4a6fd4]/20 rounded-lg bg-[#0b0f1a] text-white placeholder-[#8892b0]/50 focus:outline-none focus:ring-2 focus:ring-[#7b9ae8] resize-none text-sm" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowAddCuota(false)} disabled={adding} className="flex-1 px-4 py-2.5 rounded-lg border border-[#4a6fd4]/20 text-[#8892b0] text-sm font-medium hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer disabled:opacity-50">Cancelar</button>
              <button onClick={handleAdd} disabled={adding || !newMonto || Number(newMonto) <= 0}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {adding ? 'Agregando...' : 'Agregar Cuota'}
              </button>
            </div>
          </div>
        </Card>
      </div>
    , document.body);
  }

  function renderEditModal() {
    if (!editCuota) return null;
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <Card className="!bg-[#131729] !border-[#4a6fd4]/20 w-full max-w-md shadow-2xl">
          <div className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Editar Cuota #{editCuota.numeroCuota}</h2>
              <button onClick={() => setEditCuota(null)} className="p-1 rounded-md text-[#8892b0] hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#8892b0] mb-1">Monto *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8892b0]/60 text-sm">$</span>
                  <Input className="!bg-[#0b0f1a] !border-[#4a6fd4]/20 !text-white pl-7" placeholder="300.000" inputMode="numeric"
                    value={currencyInput(editMonto)} onChange={e => setEditMonto(currencyRaw(e.target.value))} />
                </div>
              </div>
              <div><label className="block text-sm text-[#8892b0] mb-1">Fecha de Vencimiento</label><DatePicker value={editFecha} onChange={setEditFecha} /></div>
              <div>
                <label className="block text-sm text-[#8892b0] mb-1">Observaciones</label>
                <textarea value={editObs} onChange={e => setEditObs(e.target.value)} rows={3} placeholder="Notas..."
                  className="w-full px-3 py-2 border border-[#4a6fd4]/20 rounded-lg bg-[#0b0f1a] text-white placeholder-[#8892b0]/50 focus:outline-none focus:ring-2 focus:ring-[#7b9ae8] resize-none text-sm" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditCuota(null)} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg border border-[#4a6fd4]/20 text-[#8892b0] text-sm font-medium hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer disabled:opacity-50">Cancelar</button>
              <button onClick={handleEditSave} disabled={saving || !editMonto || Number(editMonto) <= 0}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Card>
      </div>
    , document.body);
  }

  function renderObsModal() {
    if (!obsCuota) return null;
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <Card className="!bg-[#131729] !border-[#4a6fd4]/20 w-full max-w-lg shadow-2xl">
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Observaciones - Cuota #{obsCuota.numeroCuota}</h2>
              <button onClick={() => setObsCuota(null)} className="p-1 rounded-md text-[#8892b0] hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            {/* Add new observation */}
            <div className="flex gap-2">
              <textarea value={newObsText} onChange={e => setNewObsText(e.target.value)} rows={2}
                placeholder="Ej: Se llamo pero no atendio..."
                className="flex-1 px-3 py-2 border border-[#4a6fd4]/20 rounded-lg bg-[#0b0f1a] text-white placeholder-[#8892b0]/50 focus:outline-none focus:ring-2 focus:ring-[#7b9ae8] resize-none text-sm" />
              <button onClick={handleAddObs} disabled={addingObs || !newObsText.trim()}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white text-sm font-semibold cursor-pointer disabled:opacity-50 self-end">
                {addingObs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>

            {/* Observations list */}
            <div className="max-h-80 overflow-y-auto space-y-2">
              {loadingObs ? (
                <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-[#4a6fd4] animate-spin" /></div>
              ) : observacionesList.length === 0 ? (
                <p className="text-sm text-[#8892b0] text-center py-6">Sin observaciones</p>
              ) : (
                observacionesList.map((obs: any) => (
                  <div key={obs.id} className="p-3 rounded-lg bg-[#0b0f1a] border border-[#4a6fd4]/10">
                    <p className="text-sm text-white">{obs.texto}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[#8892b0]">
                      <span>{obs.creadoPor?.nombre}</span>
                      <span>&middot;</span>
                      <span>{new Date(obs.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date(obs.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>
    , document.body);
  }

  function renderCompModal() {
    if (!compCuota) return null;
    const isPagada = compCuota.estado === 'PAGADA';

    // Receipt generation state
    const showReceipt = receiptData && receiptData.id === compCuota.id;
    const rc = showReceipt ? receiptData.contrato : null;
    const fp = showReceipt && receiptData.fechaPago ? new Date(receiptData.fechaPago) : new Date();
    const rDia = String(fp.getDate()).padStart(2, '0');
    const rMes = String(fp.getMonth() + 1).padStart(2, '0');
    const rAnio = fp.getFullYear();
    const rConcepto = showReceipt ? `ANTICIPO N° ${receiptData.cuotaNumero} - ${fmt(toNum(rc?.anticipoMensual || receiptData.monto))}` : '';

    const handleGenerate = () => {
      setReceiptUrl('');
      setReceiptData({
        id: compCuota.id,
        cuotaNumero: compCuota.numeroCuota,
        monto: compCuota.monto,
        formaPago: compCuota.formaPago || '-',
        fechaPago: compCuota.fechaPago || new Date().toISOString(),
        contrato: compContrato ? {
          numeroContrato: compContrato.numeroContrato,
          solicitanteNombre: compContrato.solicitanteNombre,
          marca: compContrato.marca,
          modelo: compContrato.modelo,
          anticipoMensual: compContrato.anticipoMensual,
        } : null,
      });
    };

    const handleSaveAndClose = async () => {
      await handleSaveReceipt();
      // Reload comprobantes list
      try {
        const res = await cobranzasService.listarComprobantes(compCuota.id);
        setComprobantesList(res.data);
      } catch {}
      setReceiptData(null);
    };

    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <Card className="!bg-[#131729] !border-[#4a6fd4]/20 w-full max-w-lg shadow-2xl my-4">
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Comprobantes - Cuota #{compCuota.numeroCuota}</h2>
              <button onClick={() => { setCompCuota(null); setReceiptData(null); }} className="p-1 rounded-md text-[#8892b0] hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            {/* Actions: Generate receipt + Upload */}
            {canEdit && (
              <div className="flex gap-2">
                {isPagada && !showReceipt && (
                  <button onClick={handleGenerate}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white text-sm font-semibold cursor-pointer">
                    <FileText className="w-4 h-4" /> Generar Recibo
                  </button>
                )}
                <label className={`${isPagada && !showReceipt ? 'flex-1' : 'w-full'} flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-[#4a6fd4]/20 text-[#7b9ae8] text-sm font-medium hover:border-[#4a6fd4]/40 hover:bg-[#4a6fd4]/5 transition-all cursor-pointer`}>
                  {uploadingComp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {uploadingComp ? 'Subiendo...' : 'Subir archivo'}
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleUploadComp} disabled={uploadingComp} />
                </label>
              </div>
            )}

            {/* Receipt preview (inline) */}
            {showReceipt && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div ref={receiptRef} style={{ fontFamily: 'Arial, Helvetica, sans-serif', background: '#ffffff', padding: '24px', borderRadius: '8px', color: '#1a2040', fontSize: '13px' }}>
                  <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a3a5c', letterSpacing: '1px' }}>Di Parola</div>
                    <div style={{ fontSize: '10px', color: '#5a7a9a', letterSpacing: '3px', textTransform: 'uppercase', marginTop: '2px' }}>Automotores</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#6a8aaa', marginBottom: '16px', borderBottom: '2px solid #1a3a5c', paddingBottom: '8px' }}>
                    <div><div>Di Parola Automotores SAS</div><div>CUIT: 33-719360179-9</div></div>
                    <div style={{ textAlign: 'right' }}><div>Chile 445 (E) - San Juan - Capital</div><div>consultas@diparolaautomotores.com</div></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', color: '#6a8aaa', fontWeight: 'bold' }}>N°</span>
                      <span style={{ border: '1px solid #c0d0e0', padding: '3px 10px', fontSize: '13px', fontWeight: 'bold', color: '#1a3a5c' }}>{rc?.numeroContrato || '00'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#6a8aaa' }}>
                      <span style={{ fontWeight: 'bold' }}>SAN JUAN</span>
                      <span style={{ border: '1px solid #c0d0e0', padding: '3px 6px', fontWeight: 'bold', color: '#1a3a5c' }}>{rDia}</span>
                      <span style={{ border: '1px solid #c0d0e0', padding: '3px 6px', fontWeight: 'bold', color: '#1a3a5c' }}>{rMes}</span>
                      <span style={{ border: '1px solid #c0d0e0', padding: '3px 6px', fontWeight: 'bold', color: '#1a3a5c' }}>{rAnio}</span>
                    </div>
                  </div>
                  <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#1a3a5c', whiteSpace: 'nowrap' }}>RECIBÍ DE:</span>
                    <span style={{ flex: 1, borderBottom: '1px solid #c0d0e0', fontSize: '14px', fontWeight: 'bold', color: '#1a3a5c', paddingBottom: '2px', textAlign: 'center' }}>{rc?.solicitanteNombre?.toUpperCase() || ''}</span>
                  </div>
                  <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1a3a5c', whiteSpace: 'nowrap', background: '#e8f0f8', padding: '3px 6px', borderRadius: '4px' }}>IMPORTE $</span>
                    <span style={{ flex: 1, borderBottom: '1px solid #c0d0e0', fontSize: '16px', fontWeight: 'bold', color: '#1a3a5c', paddingBottom: '2px', textAlign: 'center' }}>{toNum(receiptData.monto).toLocaleString('es-AR')}</span>
                  </div>
                  <div style={{ marginBottom: '12px', fontSize: '10px', color: '#6a8aaa' }}>
                    <span style={{ fontWeight: 'bold', color: '#1a3a5c' }}>FORMA DE PAGO: </span>{receiptData.formaPago}
                  </div>
                  <div style={{ width: '40%', margin: '0 auto 12px', height: '2px', background: 'linear-gradient(to right, transparent, #1a3a5c, transparent)' }} />
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '10px', color: '#6a8aaa', marginBottom: '4px' }}>EN CONCEPTO DE:</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1a3a5c', textAlign: 'center', padding: '6px', borderBottom: '2px solid #1a3a5c' }}>{rConcepto.toUpperCase()}</div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <div style={{ width: '50%', margin: '0 auto', height: '1px', background: 'linear-gradient(to right, transparent, #c0d0e0, transparent)', marginBottom: '6px' }} />
                    <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#1a3a5c', letterSpacing: '2px' }}>CUMPLIENDO SUEÑOS</div>
                    <div style={{ width: '50%', margin: '6px auto 0', height: '1px', background: 'linear-gradient(to right, transparent, #c0d0e0, transparent)' }} />
                  </div>
                </div>
                <div className="flex gap-2">
                  {!receiptUrl ? (
                    <button onClick={handleSaveAndClose} disabled={savingReceipt}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
                      {savingReceipt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {savingReceipt ? 'Guardando...' : 'Guardar y Descargar'}
                    </button>
                  ) : (
                    <button onClick={handleDownloadReceipt}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#4a6fd4] hover:bg-[#3a5fc4] text-white text-sm font-semibold cursor-pointer">
                      <Download className="w-4 h-4" /> Descargar
                    </button>
                  )}
                  <button onClick={() => setReceiptData(null)}
                    className="px-4 py-2.5 rounded-lg border border-[#4a6fd4]/20 text-[#8892b0] text-sm hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Comprobantes list */}
            {!showReceipt && (
              <div className="max-h-60 overflow-y-auto space-y-2">
                {loadingComp ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-[#4a6fd4] animate-spin" /></div>
                ) : comprobantesList.length === 0 ? (
                  <p className="text-sm text-[#8892b0] text-center py-6">Sin comprobantes</p>
                ) : (
                  comprobantesList.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-[#0b0f1a] border border-[#4a6fd4]/10">
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#7b9ae8] hover:text-white truncate">
                        <FileText className="w-4 h-4 shrink-0" />
                        <span className="truncate">Comprobante - {new Date(c.createdAt).toLocaleDateString('es-AR')}</span>
                      </a>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={async () => {
                          try {
                            const res = await fetch(c.url);
                            const blob = await res.blob();
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(blob);
                            link.download = `comprobante-${new Date(c.createdAt).toLocaleDateString('es-AR').replace(/\//g, '-')}.png`;
                            link.click();
                            URL.revokeObjectURL(link.href);
                          } catch { window.open(c.url, '_blank'); }
                        }} className="p-1.5 rounded-md text-[#7b9ae8]/50 hover:text-[#7b9ae8] hover:bg-[#4a6fd4]/10 cursor-pointer" title="Descargar">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && (
                          <button onClick={() => handleDeleteComp(c.id)} className="p-1.5 rounded-md text-red-400/50 hover:text-red-400 hover:bg-red-400/10 cursor-pointer" title="Eliminar">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    , document.body);
  }

  // ── Generar masivo ─────────────────────────────────────────────────────

  const handleGenMasivo = async () => {
    if (genMeses.length === 0) { toast.error('Seleccioná al menos un mes'); return; }
    setGenerating(true);
    try {
      const res = await cobranzasService.generarMasivo({ meses: genMeses, anio: Number(genAnio) });
      toast.success(res.data.message);
      setShowGenMasivo(false); setGenMeses([]);
      loadCuotas();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Error al generar cuotas'); }
    finally { setGenerating(false); }
  };

  function renderGenMasivoModal() {
    if (!showGenMasivo) return null;
    const MESES_LABEL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const toggleMes = (m: number) => setGenMeses(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort((a, b) => a - b));
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <Card className="!bg-[#131729] !border-[#4a6fd4]/20 w-full max-w-md shadow-2xl">
          <div className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Generar Cuotas</h2>
              <button onClick={() => setShowGenMasivo(false)} className="p-1 rounded-md text-[#8892b0] hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-[#8892b0]">Seleccioná los meses para generar cuotas en todos los contratos activos. El monto se toma de la 2da cuota de cada contrato.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#8892b0] mb-2">Año</label>
                <Select value={genAnio} onValueChange={setGenAnio}>
                  <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                    {[2025, 2026, 2027, 2028].map(y => <SelectItem key={y} value={String(y)} className="text-white focus:bg-[#4a6fd4]/20 cursor-pointer">{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm text-[#8892b0] mb-2">Meses <span className="text-[#7b9ae8]">({genMeses.length} seleccionados)</span></label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {MESES_LABEL.map((m, i) => {
                    const active = genMeses.includes(i);
                    return (
                      <button key={i} type="button" onClick={() => toggleMes(i)}
                        className={`py-2 px-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${active ? 'border-[#4a6fd4] bg-[#4a6fd4]/20 text-[#7b9ae8]' : 'border-[#4a6fd4]/10 text-[#8892b0] hover:border-[#4a6fd4]/30'}`}>
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowGenMasivo(false)} disabled={generating} className="flex-1 px-4 py-2.5 rounded-lg border border-[#4a6fd4]/20 text-[#8892b0] text-sm font-medium hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer disabled:opacity-50">Cancelar</button>
              <button onClick={handleGenMasivo} disabled={generating || genMeses.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {generating ? 'Generando...' : `Generar ${genMeses.length} cuota${genMeses.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </Card>
      </div>,
    document.body);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#4a6fd4]/10"><DollarSign className="w-6 h-6 text-[#7b9ae8]" /></div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Cobranzas</h1>
            <p className="text-sm text-[#8892b0]">{!loading && <>{grouped.length} contrato{grouped.length !== 1 ? 's' : ''}</>}</p>
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setShowGenMasivo(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer">
            <Plus className="w-4 h-4" /> Generar Cuotas
          </button>
        )}
      </div>

      {/* Filters */}
      <Card className="!bg-[#131729] !border-[#4a6fd4]/8 p-3 sm:p-4">
        {/* Row 1: Buscar + Estado + Contrato + Periodo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-sm text-[#8892b0] mb-1">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892b0]" />
              <Input placeholder="Nro solicitud, nombre, DNI..." value={search} onChange={e => setSearch(e.target.value)} className="!bg-[#0b0f1a] !border-[#4a6fd4]/20 !text-white pl-10" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#8892b0] mb-1"><Filter className="inline w-3.5 h-3.5 mr-1" />Estado</label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                <SelectItem value="ALL" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Todos</SelectItem>
                <SelectItem value="PENDIENTE" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Pendiente</SelectItem>
                <SelectItem value="PAGADA" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Pagada</SelectItem>
                <SelectItem value="VENCIDA" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Vencida</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm text-[#8892b0] mb-1"><FileText className="inline w-3.5 h-3.5 mr-1" />Contrato</label>
            <Select value={estadoContrato} onValueChange={setEstadoContrato}>
              <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                <SelectItem value="ALL" className="text-white focus:bg-[#4a6fd4]/20 cursor-pointer">Todos</SelectItem>
                {Object.entries(CONTRATO_EST).map(([k, v]) => <SelectItem key={k} value={k} className={`${v.color} focus:bg-[#4a6fd4]/10 cursor-pointer`}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm text-[#8892b0] mb-1"><Calendar className="inline w-3.5 h-3.5 mr-1" />Periodo</label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                <SelectItem value="ALL" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Todos</SelectItem>
                <SelectItem value="1-10" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Del 1 al 10</SelectItem>
                <SelectItem value="10-20" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Del 10 al 20</SelectItem>
                <SelectItem value="20-30" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Del 20 al 30</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Row 2: Asesor + Desde + Hasta */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          {puedeVerTodos('COBRANZAS') && asesoresList.length > 0 && (
            <div>
              <label className="block text-sm text-[#8892b0] mb-1"><User className="inline w-3.5 h-3.5 mr-1" />Asesor</label>
              <Select value={asesor} onValueChange={v => { setAsesor(v); setPage(1); }}>
                <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-10 cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                  <SelectItem value="ALL" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Todos</SelectItem>
                  {asesoresList.map(a => <SelectItem key={a} value={a} className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="block text-sm text-[#8892b0] mb-1"><Calendar className="inline w-3.5 h-3.5 mr-1" />Desde</label>
            <DatePicker value={desde} onChange={setDesde} placeholder="Desde" />
          </div>
          <div>
            <label className="block text-sm text-[#8892b0] mb-1"><Calendar className="inline w-3.5 h-3.5 mr-1" />Hasta</label>
            <DatePicker value={hasta} onChange={setHasta} placeholder="Hasta" />
          </div>
        </div>
      </Card>

      {/* View toggle */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#8892b0]">{grouped.length} contrato{grouped.length !== 1 ? 's' : ''}{totalPages > 1 ? ` · Pág. ${page}/${totalPages}` : ''}</p>
        <div className="flex items-center gap-1 bg-[#0b0e18] p-1 rounded-lg">
          <button onClick={() => setViewMode('cards')} className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'cards' ? 'bg-[#4a6fd4] text-white' : 'text-[#8892b0] hover:text-white'}`} title="Cards"><LayoutGrid className="w-4 h-4" /></button>
          <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'table' ? 'bg-[#4a6fd4] text-white' : 'text-[#8892b0] hover:text-white'}`} title="Tabla"><List className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-[#4a6fd4] animate-spin" /><span className="ml-3 text-[#8892b0]">Cargando...</span></div>
      ) : grouped.length === 0 ? (
        <Card className="!bg-[#131729] !border-[#4a6fd4]/8"><div className="flex flex-col items-center justify-center py-16 text-[#8892b0]"><DollarSign className="w-12 h-12 mb-3 opacity-30" /><p className="text-lg">Sin resultados</p></div></Card>
      ) : viewMode === 'table' ? (
        /* ── TABLE VIEW ─────────────────────────────────────────────── */
        <Card className="!bg-[#131729] !border-[#4a6fd4]/8 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#4a6fd4]/10 bg-[#0b0e18]/50">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-[#8892b0] uppercase tracking-wider">Nro</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-[#8892b0] uppercase tracking-wider">Solicitante</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-[#8892b0] uppercase tracking-wider hidden md:table-cell">Periodo</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-[#8892b0] uppercase tracking-wider">Cuotas</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-[#8892b0] uppercase tracking-wider hidden sm:table-cell">Progreso</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-[#8892b0] uppercase tracking-wider">Acumulado</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-[#8892b0] uppercase tracking-wider">Pendiente</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-[#8892b0] uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(({ id, contrato, cuotas: cq }) => {
                  const paid = cq.filter(c => c.estado === 'PAGADA').length;
                  const venc = cq.filter(c => c.estado === 'VENCIDA').length;
                  const tot = cq.length;
                  const pct = tot > 0 ? (paid / tot) * 100 : 0;
                  const sumPaid = cq.filter(c => c.estado === 'PAGADA').reduce((s, c) => s + toNum(c.monto), 0);
                  const sumPend = cq.filter(c => c.estado !== 'PAGADA').reduce((s, c) => s + toNum(c.monto), 0);
                  const PERIODOS: Record<string, string> = { '1-10': '1-10', '10-20': '10-20', '20-30': '20-30' };

                  return (
                    <tr key={id} className={`border-b transition-colors ${contratoCardStyle(contrato?.estado, venc > 0).row}`}>
                      <td className="px-4 py-3 font-mono text-[#7b9ae8] font-semibold text-sm whitespace-nowrap">#{contrato?.numeroContrato}</td>
                      <td className="px-4 py-3">
                        <div className="text-white font-medium text-sm truncate max-w-[200px]">{contrato?.solicitanteNombre}</div>
                        <div className="text-xs text-[#8892b0] truncate max-w-[200px] hidden lg:block">{fmtVeh(contrato?.marca, contrato?.modelo)}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-[#8892b0] text-xs hidden md:table-cell">{PERIODOS[contrato?.periodoPago || ''] || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-white font-medium">{paid}/{tot}</span>
                        {venc > 0 && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 text-[10px] font-bold">
                            <AlertTriangle className="w-3 h-3" />{venc}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <div className={`flex-1 h-1.5 rounded-full bg-[#0b0e18] overflow-hidden`}><div className={`h-full rounded-full ${venc > 0 ? 'bg-red-400' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} /></div>
                          <span className="text-[10px] text-[#8892b0] w-8 text-right">{Math.round(pct)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-medium text-sm whitespace-nowrap">{fmt(sumPaid)}</td>
                      <td className={`px-4 py-3 text-right font-medium text-sm whitespace-nowrap ${venc > 0 ? 'text-red-400' : 'text-amber-400'}`}>{fmt(sumPend)}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setDetailId(id)} className="p-1.5 rounded-md text-[#7b9ae8] hover:text-white hover:bg-[#4a6fd4]/10 transition-colors cursor-pointer" title="Ver detalle"><Eye className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* ── CARDS VIEW ─────────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {paginated.map(({ id, contrato, cuotas: cq }) => {
            const paid = cq.filter(c => c.estado === 'PAGADA').length;
            const pend = cq.filter(c => c.estado === 'PENDIENTE').length;
            const venc = cq.filter(c => c.estado === 'VENCIDA').length;
            const tot = cq.length;
            const pct = tot > 0 ? (paid / tot) * 100 : 0;
            const sumPaid = cq.filter(c => c.estado === 'PAGADA').reduce((s, c) => s + toNum(c.monto), 0);
            const sumPend = cq.filter(c => c.estado !== 'PAGADA').reduce((s, c) => s + toNum(c.monto), 0);

            return (
              <Card key={id} className={`!bg-[#131729] p-4 sm:p-5 flex flex-col transition-colors ${contratoCardStyle(contrato?.estado, venc > 0).card}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-[#4a6fd4]/10 shrink-0"><FileText className="w-4 h-4 text-[#7b9ae8]" /></div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-semibold truncate text-sm">#{contrato?.numeroContrato}</span>
                        {contrato?.estado && contrato.estado !== 'ACTIVO' && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${CONTRATO_EST[contrato.estado]?.bg || ''} ${CONTRATO_EST[contrato.estado]?.color || ''}`}>
                            {CONTRATO_EST[contrato.estado]?.label || contrato.estado}
                          </span>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-[#8892b0] truncate">{contrato?.solicitanteNombre}</div>
                    </div>
                  </div>
                  {venc > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-400/10 border border-red-400/30 text-red-400 shrink-0"><AlertTriangle className="w-3 h-3" />{venc}</span>}
                </div>

                <div className="text-xs sm:text-sm text-[#8892b0] flex items-center gap-1 mb-3"><Car className="w-3.5 h-3.5" />{fmtVeh(contrato?.marca, contrato?.modelo)}</div>

                <div className="mb-3">
                  <div className="flex items-center justify-between text-[11px] text-[#8892b0] mb-1"><span>{paid}/{tot} pagadas</span><span>{Math.round(pct)}%</span></div>
                  <div className="h-2 rounded-full bg-[#0b0e18] overflow-hidden"><div className={`h-full rounded-full transition-all ${venc > 0 ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'}`} style={{ width: `${pct}%` }} /></div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-emerald-400/5 border border-emerald-400/10 rounded-lg p-2 text-center">
                    <div className="text-xs sm:text-sm font-bold text-emerald-400 truncate">{fmt(sumPaid)}</div>
                    <div className="text-[9px] text-[#8892b0] uppercase">Acumulado</div>
                  </div>
                  <div className="bg-amber-400/5 border border-amber-400/10 rounded-lg p-2 text-center">
                    <div className="text-xs sm:text-sm font-bold text-amber-400 truncate">{fmt(sumPend)}</div>
                    <div className="text-[9px] text-[#8892b0] uppercase">Pendiente</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  {pend > 0 && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-400/10 text-amber-400"><Clock className="w-2.5 h-2.5" />{pend}</span>}
                  {paid > 0 && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-400/10 text-emerald-400"><Check className="w-2.5 h-2.5" />{paid}</span>}
                </div>

                <button onClick={() => setDetailId(id)}
                  className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#4a6fd4]/20 text-[#7b9ae8] text-sm font-medium hover:bg-[#4a6fd4]/10 hover:border-[#4a6fd4]/30 transition-all cursor-pointer">
                  <Eye className="w-4 h-4" /> Ver Detalle
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[#8892b0] order-2 sm:order-1">Pág. {page} de {totalPages} ({grouped.length} contratos)</p>
          <div className="flex items-center gap-1.5 order-1 sm:order-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="h-8 px-2 sm:px-3 inline-flex items-center gap-1 rounded-md border border-[#4a6fd4]/20 text-[#7b9ae8] text-sm hover:bg-[#4a6fd4]/10 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline">Anterior</span>
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pn = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                return <button key={pn} onClick={() => setPage(pn)} className={`w-8 h-8 rounded-md text-xs font-medium transition-colors cursor-pointer ${pn === page ? 'bg-[#4a6fd4] text-white' : 'text-[#8892b0] hover:bg-[#1a2040] hover:text-white'}`}>{pn}</button>;
              })}
            </div>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="h-8 px-2 sm:px-3 inline-flex items-center gap-1 rounded-md border border-[#4a6fd4]/20 text-[#7b9ae8] text-sm hover:bg-[#4a6fd4]/10 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors">
              <span className="hidden sm:inline">Siguiente</span><ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {renderPayModal()}
      {renderAddModal()}
      {renderEditModal()}
      {renderObsModal()}
      {renderCompModal()}
      {renderGenMasivoModal()}
      
      {/* Delete cuota confirmation */}
      {deleteCuotaId && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="!bg-[#131729] !border-[#4a6fd4]/20 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-red-500/10">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Eliminar Cuota</h3>
                  <p className="text-xs text-[#8892b0]">Esta acción no se puede deshacer</p>
                </div>
              </div>
              <p className="text-sm text-[#8892b0]">
                ¿Estás seguro de que querés eliminar esta cuota? Se actualizará el total del contrato.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteCuotaId(null)} disabled={deletingCuota}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-[#4a6fd4]/20 text-[#8892b0] text-sm font-medium hover:text-white hover:bg-[#4a6fd4]/10 cursor-pointer disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={handleDeleteCuota} disabled={deletingCuota}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer disabled:opacity-50 transition-colors">
                  {deletingCuota ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deletingCuota ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </Card>
        </div>
      , document.body)}
    </div>
  );
}
