import { useState, useRef, useEffect } from 'react';
import { contratosService } from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { currencyFormat, currencyInput, currencyRaw } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  User,
  Users,
  Car,
  Camera,
  ClipboardCheck,
  Upload,
  X,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { ViewType } from '@/types';

interface ContratoFormPageProps {
  onNavigate: (view: ViewType) => void;
}

const STEP_LABELS = ['Solicitud', 'Solicitante', 'Cónyuge', 'Vehículo Usado', 'Documentación', 'Revisión'];
const STEP_ICONS = [FileText, User, Users, Car, Camera, ClipboardCheck];

const initialFormData = {
  numeroContrato: '', puntoVenta: '', productorAsesor: '', tipoVehiculo: '',
  marca: '', modelo: '', anticipoMensual: '', periodoPago: '',
  solicitanteNombre: '', solicitanteDni: '', solicitanteFechaNac: '',
  solicitanteEstadoCivil: '', solicitanteDomicilio: '', solicitanteBarrio: '',
  solicitanteLocalidad: '', solicitanteCp: '', solicitanteProvincia: '',
  solicitanteCelular: '', solicitanteTelFijo: '', solicitanteHrContacto: '',
  solicitanteOcupacion: '', solicitanteEmail: '',
  conyugeNombre: '', conyugeDni: '', conyugeFechaNac: '', conyugeTelefono: '',
  tieneVehiculoUsado: false, usadoMarca: '', usadoModelo: '', usadoAnio: '',
  usadoColor: '', usadoCombustible: '', comoLlego: '', observaciones: '',
};

type FormDataType = typeof initialFormData;

interface FileUpload { file: File; preview: string; tipo: string; }

// ── Helpers ──────────────────────────────────────────────────────────────────

const inputBase = 'bg-[#1a2040] border text-white placeholder:text-[#8892b0]/50 focus:ring-[#4a6fd4] rounded-lg h-11 w-full px-3 text-sm outline-none transition-all duration-200 focus:ring-2';
const inputOk = `${inputBase} border-[#4a6fd4]/10`;
const inputErr = `${inputBase} border-red-500/50 ring-1 ring-red-500/20`;

function FormField({ label, error, children, className = '' }: {
  label: string; error?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-bold text-[#8892b0] uppercase tracking-[0.2em] mb-1.5">
        {label}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 mt-1 text-[11px] text-red-400 animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertCircle className="w-3 h-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}


function onlyDigits(val: string, maxLen?: number) {
  const digits = val.replace(/\D/g, '');
  return maxLen ? digits.slice(0, maxLen) : digits;
}

function isValidEmail(email: string) {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Main Component ───────────────────────────────────────────────────────────

export function ContratoFormPage({ onNavigate }: ContratoFormPageProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormDataType>({ ...initialFormData });
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const contentRef = useRef<HTMLDivElement>(null);

  const updateField = (field: keyof FormDataType, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error on edit
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const updateDni = (field: 'solicitanteDni' | 'conyugeDni', raw: string) => {
    const val = onlyDigits(raw, 8);
    setFormData(prev => ({ ...prev, [field]: val }));
    // Live validation for DNI
    if (val.length > 0 && (val.length < 7 || val.length > 8)) {
      setErrors(prev => ({ ...prev, [field]: 'El DNI debe tener 7 u 8 dígitos' }));
    } else {
      setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  };

  const updatePhone = (field: keyof FormDataType, raw: string) => {
    updateField(field, raw.replace(/[^0-9\-+() ]/g, ''));
  };

  // Scroll to top of form on step change
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  // ── File handling ─────────────────────────────────────────────────────────

  function handleFileSelect(tipo: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { toast.error('El archivo no puede superar los 10MB'); return; }
      const preview = URL.createObjectURL(file);
      setFiles(prev => [...prev.filter(f => f.tipo !== tipo), { file, preview, tipo }]);
    };
    input.click();
  }

  function removeFile(tipo: string) {
    setFiles(prev => {
      const removed = prev.find(f => f.tipo === tipo);
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter(f => f.tipo !== tipo);
    });
  }

  function getFileByTipo(tipo: string) { return files.find(f => f.tipo === tipo); }

  // ── Validation ─────────────────────────────────────────────────────────────

  function validateStep(step: number): boolean {
    const errs: Record<string, string> = {};

    if (step === 0) {
      if (!formData.numeroContrato.trim()) errs.numeroContrato = 'Requerido';
      if (!formData.puntoVenta) errs.puntoVenta = 'Seleccione una opción';
      if (!formData.productorAsesor.trim()) errs.productorAsesor = 'Requerido';
      if (!formData.tipoVehiculo) errs.tipoVehiculo = 'Seleccione una opción';
      if (!formData.marca.trim()) errs.marca = 'Requerido';
      if (!formData.modelo.trim()) errs.modelo = 'Requerido';
      if (!formData.anticipoMensual || Number(formData.anticipoMensual) <= 0) errs.anticipoMensual = 'Ingrese un monto válido';
      if (!formData.periodoPago) errs.periodoPago = 'Seleccione una opción';
    }

    if (step === 1) {
      if (!formData.solicitanteNombre.trim()) errs.solicitanteNombre = 'Requerido';
      if (formData.solicitanteNombre.trim().length < 3) errs.solicitanteNombre = 'Mínimo 3 caracteres';
      if (!formData.solicitanteDni.trim()) errs.solicitanteDni = 'Requerido';
      else if (formData.solicitanteDni.length < 7 || formData.solicitanteDni.length > 8) errs.solicitanteDni = 'El DNI debe tener 7 u 8 dígitos';
      if (formData.solicitanteEmail && !isValidEmail(formData.solicitanteEmail)) errs.solicitanteEmail = 'Email inválido';
      if (formData.solicitanteCelular && formData.solicitanteCelular.replace(/\D/g, '').length < 8) errs.solicitanteCelular = 'Número muy corto';
    }

    if (step === 2) {
      if (formData.conyugeDni && (formData.conyugeDni.length < 7 || formData.conyugeDni.length > 8)) {
        errs.conyugeDni = 'El DNI debe tener 7 u 8 dígitos';
      }
    }

    if (step === 3) {
      if (formData.tieneVehiculoUsado) {
        if (!formData.usadoMarca.trim()) errs.usadoMarca = 'Requerido si tiene vehículo usado';
        if (!formData.usadoModelo.trim()) errs.usadoModelo = 'Requerido si tiene vehículo usado';
        if (formData.usadoAnio) {
          const anio = Number(formData.usadoAnio);
          if (anio < 1970 || anio > new Date().getFullYear() + 1) errs.usadoAnio = 'Año inválido';
        }
      }
    }

    if (step === 4) {
      if (!getFileByTipo('CONTRATO')) errs.CONTRATO = 'La foto del contrato es obligatoria';
      if (!getFileByTipo('DNI_FRENTE')) errs.DNI_FRENTE = 'La foto del DNI frente es obligatoria';
      if (!getFileByTipo('DNI_DORSO')) errs.DNI_DORSO = 'La foto del DNI dorso es obligatoria';
    }

    setErrors(errs);

    if (Object.keys(errs).length > 0) {
      const firstMsg = Object.values(errs)[0];
      toast.error(firstMsg, { duration: 3000 });
      return false;
    }
    return true;
  }

  function handleNext() {
    if (!validateStep(currentStep)) return;
    setDirection('next');
    setCurrentStep(s => Math.min(s + 1, 5));
  }

  function handlePrev() {
    setDirection('prev');
    setErrors({});
    setCurrentStep(s => Math.max(s - 1, 0));
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    // Revalidar todos los pasos antes de enviar
    for (let step = 0; step <= 4; step++) {
      const stepErrors: Record<string, string> = {};

      if (step === 0) {
        if (!formData.numeroContrato.trim()) stepErrors.numeroContrato = 'Requerido';
        if (!formData.puntoVenta) stepErrors.puntoVenta = 'Seleccione una opción';
        if (!formData.productorAsesor.trim()) stepErrors.productorAsesor = 'Requerido';
        if (!formData.tipoVehiculo) stepErrors.tipoVehiculo = 'Seleccione una opción';
        if (!formData.marca.trim()) stepErrors.marca = 'Requerido';
        if (!formData.modelo.trim()) stepErrors.modelo = 'Requerido';
        if (!formData.anticipoMensual || Number(formData.anticipoMensual) <= 0) stepErrors.anticipoMensual = 'Ingrese un monto válido';
        if (!formData.periodoPago) stepErrors.periodoPago = 'Seleccione una opción';
      }
      if (step === 1) {
        if (!formData.solicitanteNombre.trim()) stepErrors.solicitanteNombre = 'Requerido';
        if (formData.solicitanteNombre.trim().length < 3) stepErrors.solicitanteNombre = 'Mínimo 3 caracteres';
        if (!formData.solicitanteDni.trim()) stepErrors.solicitanteDni = 'Requerido';
        else if (formData.solicitanteDni.length < 7 || formData.solicitanteDni.length > 8) stepErrors.solicitanteDni = 'El DNI debe tener 7 u 8 dígitos';
        if (formData.solicitanteEmail && !isValidEmail(formData.solicitanteEmail)) stepErrors.solicitanteEmail = 'Email inválido';
        if (formData.solicitanteCelular && formData.solicitanteCelular.replace(/\D/g, '').length < 8) stepErrors.solicitanteCelular = 'Número muy corto';
      }
      if (step === 2 && formData.conyugeDni && (formData.conyugeDni.length < 7 || formData.conyugeDni.length > 8)) {
        stepErrors.conyugeDni = 'El DNI debe tener 7 u 8 dígitos';
      }
      if (step === 3 && formData.tieneVehiculoUsado) {
        if (!formData.usadoMarca.trim()) stepErrors.usadoMarca = 'Requerido si tiene vehículo usado';
        if (!formData.usadoModelo.trim()) stepErrors.usadoModelo = 'Requerido si tiene vehículo usado';
        if (formData.usadoAnio) {
          const anio = Number(formData.usadoAnio);
          if (anio < 1970 || anio > new Date().getFullYear() + 1) stepErrors.usadoAnio = 'Año inválido';
        }
      }
      if (step === 4) {
        if (!getFileByTipo('CONTRATO')) stepErrors.CONTRATO = 'La foto del contrato es obligatoria';
        if (!getFileByTipo('DNI_FRENTE')) stepErrors.DNI_FRENTE = 'La foto del DNI frente es obligatoria';
        if (!getFileByTipo('DNI_DORSO')) stepErrors.DNI_DORSO = 'La foto del DNI dorso es obligatoria';
      }

      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors);
        setCurrentStep(step);
        toast.error(`Hay campos con errores en "${STEP_LABELS[step]}". Revisá los campos marcados en rojo.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: any = {
        ...formData,
        anticipoMensual: Number(formData.anticipoMensual) || 0,
        cantidadCuotas: 0,
        usadoAnio: formData.usadoAnio ? Number(formData.usadoAnio) : null,
        solicitanteFechaNac: formData.solicitanteFechaNac ? new Date(formData.solicitanteFechaNac).toISOString() : null,
        conyugeFechaNac: formData.conyugeFechaNac ? new Date(formData.conyugeFechaNac).toISOString() : null,
        tieneVehiculoUsado: Boolean(formData.tieneVehiculoUsado),
      };

      const res = await contratosService.crear(payload);
      const contratoId = res.data.id;

      let fileErrors = 0;
      if (files.length > 0) {
        setUploadingFiles(true);
        for (const f of files) {
          const fd = new FormData();
          fd.append('archivo', f.file);
          fd.append('tipo', f.tipo);
          try { await contratosService.subirArchivo(contratoId, fd); }
          catch { fileErrors++; toast.error(`Error al subir ${f.tipo.replace('_', ' ')}`); }
        }
        setUploadingFiles(false);
      }

      toast.success(fileErrors > 0 ? 'Solicitud creada (algunos archivos fallaron)' : 'Solicitud creada exitosamente');
      onNavigate('admin-contratos');
    } catch (err: any) {
      const serverError = err?.response?.data;

      // Si el server devuelve errores de campo (Zod), mapearlos
      if (serverError?.detalles?.fieldErrors) {
        const fieldErrors: Record<string, string> = {};
        for (const [field, msgs] of Object.entries(serverError.detalles.fieldErrors)) {
          if (Array.isArray(msgs) && msgs.length > 0) fieldErrors[field] = msgs[0] as string;
        }
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          // Navegar al paso que tiene el primer error
          const firstField = Object.keys(fieldErrors)[0];
          const step0 = ['numeroContrato', 'puntoVenta', 'productorAsesor', 'tipoVehiculo', 'marca', 'modelo', 'anticipoMensual', 'periodoPago'];
          const step1 = ['solicitanteNombre', 'solicitanteDni', 'solicitanteFechaNac', 'solicitanteEstadoCivil', 'solicitanteDomicilio', 'solicitanteBarrio', 'solicitanteLocalidad', 'solicitanteCp', 'solicitanteProvincia', 'solicitanteCelular', 'solicitanteTelFijo', 'solicitanteHrContacto', 'solicitanteOcupacion', 'solicitanteEmail'];
          const step2 = ['conyugeNombre', 'conyugeDni', 'conyugeFechaNac', 'conyugeTelefono'];
          const step3 = ['tieneVehiculoUsado', 'usadoMarca', 'usadoModelo', 'usadoAnio', 'usadoColor', 'usadoCombustible', 'comoLlego', 'observaciones'];

          if (step0.includes(firstField)) setCurrentStep(0);
          else if (step1.includes(firstField)) setCurrentStep(1);
          else if (step2.includes(firstField)) setCurrentStep(2);
          else if (step3.includes(firstField)) setCurrentStep(3);

          toast.error('Hay campos con errores. Revisá los campos marcados en rojo.');
          return;
        }
      }

      toast.error(serverError?.error || 'Error al crear la solicitud');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step Indicator ─────────────────────────────────────────────────────────

  function StepIndicator() {
    const Icon = STEP_ICONS[currentStep];

    return (
      <>
        {/* Mobile: compact indicator */}
        <div className="flex sm:hidden items-center justify-between mb-6 bg-[#1a2040] rounded-lg px-4 py-3 border border-[#4a6fd4]/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-[#4a6fd4]/25">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{STEP_LABELS[currentStep]}</div>
              <div className="text-[10px] text-[#8892b0]">Paso {currentStep + 1} de {STEP_LABELS.length}</div>
            </div>
          </div>
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {STEP_LABELS.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i < currentStep ? 'bg-emerald-500' : i === currentStep ? 'bg-[#4a6fd4] scale-125' : 'bg-[#1a2040] border border-[#8892b0]/20'
              }`} />
            ))}
          </div>
        </div>

        {/* Desktop: full step indicator */}
        <div className="hidden sm:flex items-center justify-center mb-8 pb-2">
          {STEP_LABELS.map((label, i) => {
            const StepIcon = STEP_ICONS[i];
            const isCompleted = i < currentStep;
            const isActive = i === currentStep;

            return (
              <div key={i} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    onClick={() => { if (isCompleted) { setDirection(i < currentStep ? 'prev' : 'next'); setCurrentStep(i); } }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-500 text-white cursor-pointer hover:bg-emerald-400 hover:scale-105'
                        : isActive
                          ? 'bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white shadow-lg shadow-[#4a6fd4]/25 scale-105'
                          : 'bg-[#1a2040] text-gray-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                  </div>
                  <span className={`text-[10px] mt-2 font-medium text-center w-16 lg:w-20 transition-colors duration-300 ${
                    isActive ? 'text-[#7b9ae8]' : isCompleted ? 'text-emerald-400' : 'text-gray-500'
                  }`}>
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`w-8 lg:w-12 h-0.5 mx-1 mt-[-20px] transition-colors duration-500 ${
                    i < currentStep ? 'bg-emerald-500' : 'bg-[#1a2040]'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  }

  // ── Steps ──────────────────────────────────────────────────────────────────

  function renderStep0() {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">Datos de la Solicitud</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nro. Solicitud *" error={errors.numeroContrato}>
            <Input className={errors.numeroContrato ? inputErr : inputOk} placeholder="Ej: 0001" value={formData.numeroContrato} onChange={e => updateField('numeroContrato', e.target.value)} />
          </FormField>
          <FormField label="Punto de Venta *" error={errors.puntoVenta}>
            <Select value={formData.puntoVenta || undefined} onValueChange={val => updateField('puntoVenta', val)}>
              <SelectTrigger className={`bg-[#1a2040] text-white h-11 rounded-lg cursor-pointer transition-all duration-200 ${errors.puntoVenta ? 'border-red-500/50 ring-1 ring-red-500/20' : 'border-[#4a6fd4]/10'}`}>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                <SelectItem value="SALON" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Salón</SelectItem>
                <SelectItem value="STAND" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Stand</SelectItem>
                <SelectItem value="CASA_CLIENTE" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Casa del Cliente</SelectItem>
                <SelectItem value="ONLINE" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Online</SelectItem>
                <SelectItem value="OTRO" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Otro</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Productor / Asesor *" error={errors.productorAsesor}>
            <Input className={errors.productorAsesor ? inputErr : inputOk} placeholder="Nombre del asesor" value={formData.productorAsesor} onChange={e => updateField('productorAsesor', e.target.value)} />
          </FormField>
          <FormField label="Tipo de Vehículo *" error={errors.tipoVehiculo}>
            <Select value={formData.tipoVehiculo || undefined} onValueChange={val => updateField('tipoVehiculo', val)}>
              <SelectTrigger className={`bg-[#1a2040] text-white h-11 rounded-lg cursor-pointer transition-all duration-200 ${errors.tipoVehiculo ? 'border-red-500/50 ring-1 ring-red-500/20' : 'border-[#4a6fd4]/10'}`}>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                <SelectItem value="AUTO" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Auto</SelectItem>
                <SelectItem value="UTILITARIO" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Utilitario</SelectItem>
                <SelectItem value="CAMIONETA" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Camioneta</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Marca *" error={errors.marca}>
            <Input className={errors.marca ? inputErr : inputOk} placeholder="Ej: Toyota" value={formData.marca} onChange={e => updateField('marca', e.target.value)} />
          </FormField>
          <FormField label="Modelo *" error={errors.modelo}>
            <Input className={errors.modelo ? inputErr : inputOk} placeholder="Ej: Corolla" value={formData.modelo} onChange={e => updateField('modelo', e.target.value)} />
          </FormField>
          <FormField label="Anticipo Mensual ($) *" error={errors.anticipoMensual}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8892b0]/60 text-sm">$</span>
              <Input className={`${errors.anticipoMensual ? inputErr : inputOk} pl-7`} placeholder="300.000" inputMode="numeric"
                value={currencyInput(formData.anticipoMensual)}
                onChange={e => updateField('anticipoMensual', currencyRaw(e.target.value))} />
            </div>
          </FormField>
          <FormField label="Período de Pago *" error={errors.periodoPago}>
            <Select value={formData.periodoPago || undefined} onValueChange={val => updateField('periodoPago', val)}>
              <SelectTrigger className={`bg-[#1a2040] text-white h-11 rounded-lg cursor-pointer transition-all duration-200 ${errors.periodoPago ? 'border-red-500/50 ring-1 ring-red-500/20' : 'border-[#4a6fd4]/10'}`}>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                <SelectItem value="1-10" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Del 1 al 10</SelectItem>
                <SelectItem value="10-20" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Del 10 al 20</SelectItem>
                <SelectItem value="20-30" className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">Del 20 al 30</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </div>
    );
  }

  function renderStep1() {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">Datos del Solicitante</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nombre Completo *" error={errors.solicitanteNombre}>
            <Input className={errors.solicitanteNombre ? inputErr : inputOk} placeholder="Nombre y Apellido" value={formData.solicitanteNombre} onChange={e => updateField('solicitanteNombre', e.target.value)} />
          </FormField>
          <FormField label="DNI *" error={errors.solicitanteDni}>
            <div className="relative">
              <Input className={errors.solicitanteDni ? inputErr : inputOk} placeholder="Ej: 12345678" value={formData.solicitanteDni}
                onChange={e => updateDni('solicitanteDni', e.target.value)} maxLength={8} inputMode="numeric" />
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono ${formData.solicitanteDni.length >= 7 ? 'text-emerald-400' : 'text-[#8892b0]/40'}`}>
                {formData.solicitanteDni.length}/8
              </span>
            </div>
          </FormField>
          <FormField label="Fecha de Nacimiento">
            <DatePicker value={formData.solicitanteFechaNac} onChange={v => updateField('solicitanteFechaNac', v)} placeholder="Fecha de nacimiento" fromYear={1940} toYear={new Date().getFullYear() - 16} />
          </FormField>
          <FormField label="Estado Civil">
            <Select value={formData.solicitanteEstadoCivil || undefined} onValueChange={val => updateField('solicitanteEstadoCivil', val)}>
              <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-11 rounded-lg cursor-pointer">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                {['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Unión de hecho'].map(ec => (
                  <SelectItem key={ec} value={ec} className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">{ec}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Domicilio" className="md:col-span-2">
            <Input className={inputOk} placeholder="Dirección completa" value={formData.solicitanteDomicilio} onChange={e => updateField('solicitanteDomicilio', e.target.value)} />
          </FormField>
          <FormField label="Barrio">
            <Input className={inputOk} placeholder="Barrio" value={formData.solicitanteBarrio} onChange={e => updateField('solicitanteBarrio', e.target.value)} />
          </FormField>
          <FormField label="Localidad">
            <Input className={inputOk} placeholder="Localidad" value={formData.solicitanteLocalidad} onChange={e => updateField('solicitanteLocalidad', e.target.value)} />
          </FormField>
          <FormField label="Código Postal">
            <Input className={inputOk} placeholder="CP" value={formData.solicitanteCp} onChange={e => updateField('solicitanteCp', onlyDigits(e.target.value, 6))} inputMode="numeric" />
          </FormField>
          <FormField label="Provincia">
            <Input className={inputOk} placeholder="Provincia" value={formData.solicitanteProvincia} onChange={e => updateField('solicitanteProvincia', e.target.value)} />
          </FormField>
          <FormField label="Celular" error={errors.solicitanteCelular}>
            <Input className={errors.solicitanteCelular ? inputErr : inputOk} placeholder="Ej: 264-4551234" value={formData.solicitanteCelular} onChange={e => updatePhone('solicitanteCelular', e.target.value)} inputMode="tel" />
          </FormField>
          <FormField label="Teléfono Fijo">
            <Input className={inputOk} placeholder="Teléfono fijo" value={formData.solicitanteTelFijo} onChange={e => updatePhone('solicitanteTelFijo', e.target.value)} inputMode="tel" />
          </FormField>
          <FormField label="Horario de Contacto">
            <Input className={inputOk} placeholder="Ej: 9 a 18hs" value={formData.solicitanteHrContacto} onChange={e => updateField('solicitanteHrContacto', e.target.value)} />
          </FormField>
          <FormField label="Ocupación">
            <Input className={inputOk} placeholder="Ocupación" value={formData.solicitanteOcupacion} onChange={e => updateField('solicitanteOcupacion', e.target.value)} />
          </FormField>
          <FormField label="Email" error={errors.solicitanteEmail}>
            <Input className={errors.solicitanteEmail ? inputErr : inputOk} type="email" placeholder="correo@ejemplo.com" value={formData.solicitanteEmail} onChange={e => updateField('solicitanteEmail', e.target.value)} />
          </FormField>
        </div>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">Datos del Cónyuge</h3>
        <p className="text-sm text-[#8892b0] bg-[#1a2040] rounded-lg px-4 py-3 border border-[#4a6fd4]/10">
          Estos campos son opcionales. Complete solo si corresponde.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nombre Completo">
            <Input className={inputOk} placeholder="Nombre y Apellido" value={formData.conyugeNombre} onChange={e => updateField('conyugeNombre', e.target.value)} />
          </FormField>
          <FormField label="DNI" error={errors.conyugeDni}>
            <div className="relative">
              <Input className={errors.conyugeDni ? inputErr : inputOk} placeholder="DNI del cónyuge" value={formData.conyugeDni}
                onChange={e => updateDni('conyugeDni', e.target.value)} maxLength={8} inputMode="numeric" />
              {formData.conyugeDni && (
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono ${formData.conyugeDni.length >= 7 ? 'text-emerald-400' : 'text-[#8892b0]/40'}`}>
                  {formData.conyugeDni.length}/8
                </span>
              )}
            </div>
          </FormField>
          <FormField label="Fecha de Nacimiento">
            <DatePicker value={formData.conyugeFechaNac} onChange={v => updateField('conyugeFechaNac', v)} placeholder="Fecha de nacimiento" fromYear={1940} toYear={new Date().getFullYear() - 16} />
          </FormField>
          <FormField label="Teléfono">
            <Input className={inputOk} placeholder="Teléfono del cónyuge" value={formData.conyugeTelefono} onChange={e => updatePhone('conyugeTelefono', e.target.value)} inputMode="tel" />
          </FormField>
        </div>
      </div>
    );
  }

  function renderStep3() {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">Vehículo Usado y Observaciones</h3>
        <div className="flex items-center gap-3 bg-[#1a2040] rounded-lg px-4 py-3 border border-[#4a6fd4]/10 cursor-pointer hover:border-[#4a6fd4]/20 transition-colors"
          onClick={() => updateField('tieneVehiculoUsado', !formData.tieneVehiculoUsado)}>
          <Checkbox checked={formData.tieneVehiculoUsado} onCheckedChange={checked => updateField('tieneVehiculoUsado', Boolean(checked))}
            className="border-[#4a6fd4]/30 data-[state=checked]:bg-[#4a6fd4] data-[state=checked]:border-[#4a6fd4] cursor-pointer" />
          <label className="text-sm text-white cursor-pointer select-none">El solicitante tiene un vehículo usado para entregar</label>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden transition-all duration-300 ${formData.tieneVehiculoUsado ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <FormField label="Marca del Usado *" error={errors.usadoMarca}>
            <Input className={errors.usadoMarca ? inputErr : inputOk} placeholder="Marca" value={formData.usadoMarca} onChange={e => updateField('usadoMarca', e.target.value)} />
          </FormField>
          <FormField label="Modelo del Usado *" error={errors.usadoModelo}>
            <Input className={errors.usadoModelo ? inputErr : inputOk} placeholder="Modelo" value={formData.usadoModelo} onChange={e => updateField('usadoModelo', e.target.value)} />
          </FormField>
          <FormField label="Año" error={errors.usadoAnio}>
            <Input className={errors.usadoAnio ? inputErr : inputOk} type="number" min="1970" max={new Date().getFullYear() + 1} placeholder="Ej: 2020" value={formData.usadoAnio} onChange={e => updateField('usadoAnio', e.target.value)} />
          </FormField>
          <FormField label="Color">
            <Input className={inputOk} placeholder="Color" value={formData.usadoColor} onChange={e => updateField('usadoColor', e.target.value)} />
          </FormField>
          <FormField label="Combustible">
            <Select value={formData.usadoCombustible || undefined} onValueChange={val => updateField('usadoCombustible', val)}>
              <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-11 rounded-lg cursor-pointer">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                {['Nafta', 'Diesel', 'GNC', 'Híbrido', 'Eléctrico'].map(c => (
                  <SelectItem key={c} value={c} className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="¿Cómo llegó a Di Parola?">
            <Select value={formData.comoLlego || undefined} onValueChange={val => updateField('comoLlego', val)}>
              <SelectTrigger className="bg-[#1a2040] border-[#4a6fd4]/10 text-white h-11 rounded-lg cursor-pointer">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2040] border-[#4a6fd4]/10">
                {['Instagram', 'Facebook', 'Radio', 'Recomendación', 'Publicidad', 'Visita espontánea', 'Otro'].map(c => (
                  <SelectItem key={c} value={c} className="text-white focus:bg-[#4a6fd4]/20 focus:text-white cursor-pointer">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField label="Observaciones">
          <Textarea className="bg-[#1a2040] border-[#4a6fd4]/10 text-white placeholder:text-[#8892b0]/50 focus:ring-[#4a6fd4] rounded-lg w-full px-3 py-3 text-sm outline-none border transition-shadow focus:ring-2 min-h-[100px]"
            placeholder="Notas adicionales..." value={formData.observaciones} onChange={e => updateField('observaciones', e.target.value)} />
        </FormField>
      </div>
    );
  }

  function renderStep4() {
    const uploadSlots = [
      { tipo: 'CONTRATO', label: 'Foto del Contrato', required: true, icon: FileText },
      { tipo: 'DNI_FRENTE', label: 'DNI Frente', required: true, icon: User },
      { tipo: 'DNI_DORSO', label: 'DNI Dorso', required: true, icon: User },
      { tipo: 'FOTO_AUTO', label: 'Foto del Auto Usado', required: false, icon: Car },
    ];
    const slotsToShow = formData.tieneVehiculoUsado ? uploadSlots : uploadSlots.filter(s => s.tipo !== 'FOTO_AUTO');

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">Documentación</h3>
        <p className="text-sm text-[#8892b0]">Suba las fotos requeridas del contrato y DNI. Formatos: JPG, PNG, PDF. Máximo 10MB por archivo.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {slotsToShow.map(slot => {
            const uploaded = getFileByTipo(slot.tipo);
            const Icon = slot.icon;
            const hasError = errors[slot.tipo];

            return (
              <div key={slot.tipo} className="space-y-2">
                <label className="block text-[10px] font-bold text-[#8892b0] uppercase tracking-[0.2em]">
                  {slot.label} {slot.required && '*'}
                </label>
                {uploaded ? (
                  <div className="relative group rounded-lg overflow-hidden border border-emerald-400/20 bg-[#1a2040] cursor-pointer">
                    {uploaded.file.type.startsWith('image/')
                      ? <img src={uploaded.preview} alt={slot.label} className="w-full h-48 object-cover" />
                      : <div className="w-full h-48 flex flex-col items-center justify-center gap-2"><FileText className="w-12 h-12 text-[#4a6fd4]" /><span className="text-sm text-[#8892b0]">{uploaded.file.name}</span></div>
                    }
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
                      <button onClick={() => handleFileSelect(slot.tipo)} className="p-2 rounded-lg bg-[#4a6fd4] text-white hover:bg-[#2648a1] transition-colors cursor-pointer" title="Cambiar"><Upload className="w-4 h-4" /></button>
                      <button onClick={() => removeFile(slot.tipo)} className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer" title="Eliminar"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="p-2 border-t border-emerald-400/10 flex items-center gap-2">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-xs text-emerald-400 truncate">{uploaded.file.name}</span>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => handleFileSelect(slot.tipo)}
                    className={`w-full h-48 rounded-lg border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-3 group cursor-pointer ${
                      hasError ? 'border-red-500/40 bg-red-500/5 hover:border-red-500/60' : 'border-[#4a6fd4]/20 bg-[#1a2040]/50 hover:bg-[#1a2040] hover:border-[#4a6fd4]/40'
                    }`}>
                    <div className={`p-3 rounded-xl transition-colors duration-200 ${hasError ? 'bg-red-500/10 group-hover:bg-red-500/20' : 'bg-[#4a6fd4]/10 group-hover:bg-[#4a6fd4]/20'}`}>
                      <Icon className={`w-6 h-6 ${hasError ? 'text-red-400' : 'text-[#4a6fd4]'}`} />
                    </div>
                    <div className="text-center">
                      <span className={`text-sm transition-colors duration-200 block ${hasError ? 'text-red-400' : 'text-[#8892b0] group-hover:text-white'}`}>Click para subir</span>
                      <span className="text-[10px] text-[#8892b0]/60">JPG, PNG o PDF</span>
                    </div>
                  </button>
                )}
                {hasError && <p className="flex items-center gap-1 text-[11px] text-red-400"><AlertCircle className="w-3 h-3 shrink-0" /> {hasError}</p>}
              </div>
            );
          })}
        </div>

        {files.length > 0 && (
          <div className="bg-[#1a2040] rounded-lg p-3 border border-emerald-400/10">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">{files.length} archivo{files.length > 1 ? 's' : ''} listo{files.length > 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-1">
              {files.map(f => (
                <div key={f.tipo} className="flex items-center justify-between text-xs">
                  <span className="text-[#8892b0]">{f.tipo.replace('_', ' ')}</span>
                  <span className="text-white">{(f.file.size / 1024).toFixed(0)} KB</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderStep5() {
    const fmt = (v: string | number) => v ? String(v) : '';
    const fmtMoney = (v: string) => v ? currencyFormat(v) : '';
    const PERIODOS: Record<string, string> = { '1-10': 'Del 1 al 10', '10-20': 'Del 10 al 20', '20-30': 'Del 20 al 30' };
    const PUNTOS: Record<string, string> = { SALON: 'Salón', STAND: 'Stand', CASA_CLIENTE: 'Casa del Cliente', ONLINE: 'Online', OTRO: 'Otro' };

    const sections = [
      { title: 'Datos de la Solicitud', fields: [
        ['Nro. Solicitud', fmt(formData.numeroContrato)], ['Punto de Venta', PUNTOS[formData.puntoVenta] || formData.puntoVenta],
        ['Asesor', fmt(formData.productorAsesor)], ['Tipo Vehículo', fmt(formData.tipoVehiculo)],
        ['Marca', fmt(formData.marca)], ['Modelo', fmt(formData.modelo)],
        ['Anticipo Mensual', fmtMoney(formData.anticipoMensual)], ['Período de Pago', PERIODOS[formData.periodoPago] || formData.periodoPago],
      ]},
      { title: 'Datos del Solicitante', fields: [
        ['Nombre', fmt(formData.solicitanteNombre)], ['DNI', fmt(formData.solicitanteDni)],
        ['Fecha Nac.', formData.solicitanteFechaNac ? new Date(formData.solicitanteFechaNac).toLocaleDateString('es-AR') : ''],
        ['Estado Civil', fmt(formData.solicitanteEstadoCivil)], ['Domicilio', fmt(formData.solicitanteDomicilio)],
        ['Localidad', [formData.solicitanteLocalidad, formData.solicitanteProvincia].filter(Boolean).join(', ')],
        ['Celular', fmt(formData.solicitanteCelular)], ['Email', fmt(formData.solicitanteEmail)],
      ]},
      { title: 'Cónyuge', fields: [
        ['Nombre', fmt(formData.conyugeNombre)], ['DNI', fmt(formData.conyugeDni)], ['Teléfono', fmt(formData.conyugeTelefono)],
      ]},
      { title: 'Vehículo Usado', fields: [
        ['Tiene Usado', formData.tieneVehiculoUsado ? 'Sí' : 'No'],
        ...(formData.tieneVehiculoUsado ? [['Marca', fmt(formData.usadoMarca)], ['Modelo', fmt(formData.usadoModelo)], ['Año', fmt(formData.usadoAnio)], ['Color', fmt(formData.usadoColor)]] : []),
        ['Cómo llegó', fmt(formData.comoLlego)],
      ]},
    ];

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">Revisión y Confirmación</h3>
        <p className="text-sm text-[#8892b0]">Verifique que todos los datos sean correctos antes de confirmar.</p>
        {sections.map(section => (
          <div key={section.title} className="bg-[#1a2040] rounded-lg border border-[#4a6fd4]/10 p-4">
            <h4 className="text-sm font-semibold text-[#7b9ae8] mb-3">{section.title}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              {section.fields.filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string} className="flex justify-between py-1">
                  <span className="text-xs text-[#8892b0]">{label as string}</span>
                  <span className="text-sm text-white font-medium text-right max-w-[60%] truncate">{value as string}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {files.length > 0 && (
          <div className="bg-[#1a2040] rounded-lg border border-[#4a6fd4]/10 p-4">
            <h4 className="text-sm font-semibold text-[#7b9ae8] mb-3">Documentación Adjunta</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {files.map(f => (
                <div key={f.tipo} className="rounded-lg overflow-hidden border border-[#4a6fd4]/10">
                  {f.file.type.startsWith('image/') ? <img src={f.preview} alt={f.tipo} className="w-full h-24 object-cover" /> : <div className="w-full h-24 flex items-center justify-center bg-[#131729]"><FileText className="w-8 h-8 text-[#4a6fd4]" /></div>}
                  <div className="p-1.5 text-center"><span className="text-[10px] text-[#8892b0]">{f.tipo.replace('_', ' ')}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const stepRenderers = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="pt-8 lg:pt-0">
      <button onClick={() => onNavigate('admin-contratos')}
        className="flex items-center gap-2 text-[#8892b0] hover:text-[#7b9ae8] transition-colors mb-6 text-sm cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Volver a Ventas
      </button>

      <Card className="bg-[#131729] border-[#4a6fd4]/8 max-w-4xl mx-auto">
        <CardContent className="p-5 md:p-8">
          <StepIndicator />

          {/* Step content with transition */}
          <div ref={contentRef} className="min-h-[400px] overflow-hidden">
            <div
              key={currentStep}
              className={`animate-in duration-300 ${
                direction === 'next' ? 'fade-in slide-in-from-right-4' : 'fade-in slide-in-from-left-4'
              }`}
            >
              {stepRenderers[currentStep]()}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-[#4a6fd4]/10">
            <Button variant="outline" onClick={handlePrev} disabled={currentStep === 0}
              className="bg-transparent border-[#4a6fd4]/20 text-[#8892b0] hover:text-white hover:border-[#4a6fd4]/40 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-all duration-200">
              <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
            </Button>

            {currentStep < 5 ? (
              <Button onClick={handleNext}
                className="bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white hover:opacity-90 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-[#4a6fd4]/25">
                Siguiente <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 cursor-pointer transition-all duration-200 disabled:cursor-not-allowed">
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{uploadingFiles ? 'Subiendo archivos...' : 'Creando solicitud...'}</>
                ) : (
                  <><Check className="w-4 h-4 mr-2" /> Confirmar y Crear Solicitud</>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
