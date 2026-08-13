import React, { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Loader2, Eye, ArrowRight, Users, DollarSign } from 'lucide-react';
import { importarService } from '@/services/api';
import { currencyFormat } from '@/lib/utils';

interface PreviewData {
  hojas: string[];
  hojaClientesUsada: string | null;
  hojaCobranzaUsada: string | null;
  clientes: Array<{
    solicitanteNombre: string;
    solicitanteDni: string;
    puntoVenta: string;
    productorAsesor: string;
    solicitanteLocalidad: string | null;
    solicitanteCelular: string | null;
    periodoPago: string;
    cuotas: Array<{ mes: number; monto: number | null }>;
    yaExiste: boolean;
  }>;
  cobranzas: Array<{
    nombre: string;
    periodoPago: string;
    cantidadPagos: number;
    totalPagado: number;
    notas: string | null;
  }>;
  resumen: {
    totalClientes: number;
    nuevos: number;
    existentes: number;
    totalCobranzas: number;
  };
}

interface ImportResult {
  message: string;
  resultados: {
    contratosCreados: number;
    contratosExistentes: number;
    cuotasCreadas: number;
    cuotasActualizadas: number;
    errores: string[];
  };
}

export function ImportarPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'clientes' | 'cobranzas'>('clientes');

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 10 * 1024 * 1024) { setError('El archivo no puede superar los 10MB'); return; }
      if (selected.size === 0) { setError('El archivo está vacío'); return; }
      setFile(selected);
      setPreview(null);
      setResult(null);
      setError(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith('.xlsx') || dropped.name.endsWith('.xls'))) {
      if (dropped.size > 10 * 1024 * 1024) { setError('El archivo no puede superar los 10MB'); return; }
      setFile(dropped);
      setPreview(null);
      setResult(null);
      setError(null);
    } else {
      setError('Solo se permiten archivos Excel (.xlsx, .xls)');
    }
  }, []);

  const handlePreview = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      const { data } = await importarService.preview(formData);
      setPreview(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al previsualizar el archivo');
    } finally {
      setLoading(false);
    }
  }, [file]);

  const handleImport = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      const { data } = await importarService.importar(formData);
      setResult(data);
      setPreview(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al importar el archivo');
    } finally {
      setLoading(false);
    }
  }, [file]);

  const resetAll = useCallback(() => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  }, []);

  const formatMoney = currencyFormat;

  // ── Resultado final ──────────────────────────────────────────────────────
  if (result) {
    const r = result.resultados;
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Importar Excel</h1>

        <div className="bg-[#131729] border border-emerald-500/20 rounded-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <h2 className="text-xl font-semibold text-white">{result.message}</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#0b0e18] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">{r.contratosCreados}</div>
              <div className="text-xs text-[#8892b0] mt-1">Contratos creados</div>
            </div>
            <div className="bg-[#0b0e18] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">{r.contratosExistentes}</div>
              <div className="text-xs text-[#8892b0] mt-1">Ya existentes</div>
            </div>
            <div className="bg-[#0b0e18] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{r.cuotasCreadas}</div>
              <div className="text-xs text-[#8892b0] mt-1">Cuotas creadas</div>
            </div>
            <div className="bg-[#0b0e18] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{r.cuotasActualizadas}</div>
              <div className="text-xs text-[#8892b0] mt-1">Cuotas actualizadas</div>
            </div>
          </div>

          {r.errores.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-red-400 mb-2">
                Errores ({r.errores.length})
              </h3>
              <ul className="space-y-1">
                {r.errores.map((err, i) => (
                  <li key={i} className="text-xs text-red-300">{err}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={resetAll}
            className="px-6 py-2.5 bg-[#4a6fd4] hover:bg-[#3d5cb8] text-white rounded-lg text-sm font-medium transition-colors"
          >
            Importar otro archivo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Importar Excel</h1>
      <p className="text-[#8892b0] text-sm">
        Sube un archivo Excel con las hojas de "Carga de Clientes" y "Cobranza" para importar datos masivamente.
      </p>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-300">{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4 text-red-400 hover:text-red-300" />
          </button>
        </div>
      )}

      {/* Upload zone */}
      {!preview && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          className="bg-[#131729] border-2 border-dashed border-[#4a6fd4]/20 hover:border-[#4a6fd4]/40 rounded-xl p-12 text-center transition-colors"
        >
          <FileSpreadsheet className="w-12 h-12 text-[#4a6fd4]/40 mx-auto mb-4" />
          <p className="text-[#8892b0] mb-4">
            {file ? (
              <span className="text-white font-medium">{file.name}</span>
            ) : (
              'Arrastra un archivo Excel aquí o haz clic para seleccionar'
            )}
          </p>

          <div className="flex items-center justify-center gap-3">
            <label className="cursor-pointer px-4 py-2 bg-[#1a2040] hover:bg-[#232a4a] text-[#7b9ae8] rounded-lg text-sm font-medium transition-colors border border-[#4a6fd4]/20">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="w-4 h-4 inline mr-2" />
              Seleccionar archivo
            </label>

            {file && (
              <button
                onClick={handlePreview}
                disabled={loading}
                className="px-4 py-2 bg-[#4a6fd4] hover:bg-[#3d5cb8] text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                Previsualizar
              </button>
            )}
          </div>

          <p className="text-xs text-[#8892b0]/50 mt-4">
            Formatos: .xlsx, .xls (max 10MB)
          </p>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          {/* Resumen */}
          <div className="bg-[#131729] border border-[#4a6fd4]/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Vista previa</h2>
              <button
                onClick={resetAll}
                className="text-[#8892b0] hover:text-white text-sm"
              >
                Cambiar archivo
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-[#0b0e18] rounded-lg p-3">
                <div className="text-xl font-bold text-white">{preview.resumen.totalClientes}</div>
                <div className="text-xs text-[#8892b0]">Clientes encontrados</div>
              </div>
              <div className="bg-[#0b0e18] rounded-lg p-3">
                <div className="text-xl font-bold text-emerald-400">{preview.resumen.nuevos}</div>
                <div className="text-xs text-[#8892b0]">Nuevos a importar</div>
              </div>
              <div className="bg-[#0b0e18] rounded-lg p-3">
                <div className="text-xl font-bold text-amber-400">{preview.resumen.existentes}</div>
                <div className="text-xs text-[#8892b0]">Ya existentes</div>
              </div>
              <div className="bg-[#0b0e18] rounded-lg p-3">
                <div className="text-xl font-bold text-blue-400">{preview.resumen.totalCobranzas}</div>
                <div className="text-xs text-[#8892b0]">Registros de cobranza</div>
              </div>
            </div>

            <div className="text-xs text-[#8892b0]">
              Hojas detectadas: {preview.hojas.join(', ')}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-[#0b0e18] p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('clientes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'clientes'
                  ? 'bg-[#4a6fd4] text-white'
                  : 'text-[#8892b0] hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              Clientes ({preview.clientes.length})
            </button>
            <button
              onClick={() => setActiveTab('cobranzas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'cobranzas'
                  ? 'bg-[#4a6fd4] text-white'
                  : 'text-[#8892b0] hover:text-white'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Cobranzas ({preview.cobranzas.length})
            </button>
          </div>

          {/* Table */}
          <div className="bg-[#131729] border border-[#4a6fd4]/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              {activeTab === 'clientes' ? (
                <table className="w-full text-sm">
                  <thead className="bg-[#0b0e18] sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-4 py-3 text-[#8892b0] font-medium">Estado</th>
                      <th className="text-left px-4 py-3 text-[#8892b0] font-medium">Nombre</th>
                      <th className="text-left px-4 py-3 text-[#8892b0] font-medium">DNI</th>
                      <th className="text-left px-4 py-3 text-[#8892b0] font-medium">Localidad</th>
                      <th className="text-left px-4 py-3 text-[#8892b0] font-medium">Asesor</th>
                      <th className="text-left px-4 py-3 text-[#8892b0] font-medium">Periodo</th>
                      <th className="text-left px-4 py-3 text-[#8892b0] font-medium">Cuotas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {preview.clientes.map((c, i) => (
                      <tr key={i} className={c.yaExiste ? 'opacity-50' : ''}>
                        <td className="px-4 py-2.5">
                          {c.yaExiste ? (
                            <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 rounded-full">
                              Existente
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 rounded-full">
                              Nuevo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-white font-medium">{c.solicitanteNombre}</td>
                        <td className="px-4 py-2.5 text-[#8892b0]">{c.solicitanteDni}</td>
                        <td className="px-4 py-2.5 text-[#8892b0]">{c.solicitanteLocalidad || '-'}</td>
                        <td className="px-4 py-2.5 text-[#8892b0]">{c.productorAsesor}</td>
                        <td className="px-4 py-2.5 text-[#8892b0]">{c.periodoPago}</td>
                        <td className="px-4 py-2.5 text-[#8892b0]">
                          {(c.cuotas || []).filter((q: any) => q.monto !== null).length}/8 cuotas
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-[#0b0e18] sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-4 py-3 text-[#8892b0] font-medium">Cliente</th>
                      <th className="text-left px-4 py-3 text-[#8892b0] font-medium">Periodo</th>
                      <th className="text-left px-4 py-3 text-[#8892b0] font-medium">Pagos</th>
                      <th className="text-left px-4 py-3 text-[#8892b0] font-medium">Total pagado</th>
                      <th className="text-left px-4 py-3 text-[#8892b0] font-medium">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {preview.cobranzas.map((c, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 text-white font-medium">{c.nombre}</td>
                        <td className="px-4 py-2.5 text-[#8892b0]">{c.periodoPago}</td>
                        <td className="px-4 py-2.5 text-[#8892b0]">{c.cantidadPagos}</td>
                        <td className="px-4 py-2.5 text-emerald-400 font-medium">{formatMoney(c.totalPagado)}</td>
                        <td className="px-4 py-2.5 text-[#8892b0] text-xs max-w-[200px] truncate">{c.notas || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Action */}
          <div className="flex items-center justify-between bg-[#131729] border border-[#4a6fd4]/10 rounded-xl p-4">
            <div className="text-sm text-[#8892b0]">
              {preview.resumen.nuevos > 0 && <>Se crearán <span className="text-white font-semibold">{preview.resumen.nuevos}</span> contratos nuevos. </>}
              {preview.resumen.existentes > 0 && (
                <><span className="text-amber-400">{preview.resumen.existentes} existentes</span> se actualizarán con cuotas faltantes. </>
              )}
              Se procesarán <span className="text-white font-semibold">{preview.resumen.totalCobranzas}</span> registros de cobranza.
            </div>
            <button
              onClick={handleImport}
              disabled={loading || (preview.resumen.nuevos === 0 && preview.resumen.existentes === 0)}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ml-4"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              Importar datos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
