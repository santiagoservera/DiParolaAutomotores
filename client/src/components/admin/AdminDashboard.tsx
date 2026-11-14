import { useEffect, useState } from 'react';
import {
  FileText, UserPlus, Clock, TrendingUp, Plus, ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { contratosService, cobranzasService, recepcionService } from '@/services/api';
import type { ViewType } from '@/types';
import { MetricasPanel } from './metricas/MetricasPanel';
import { VencidasDetalle } from './metricas/VencidasDetalle';

interface DashboardProps { onNavigate: (view: ViewType) => void; }

export function AdminDashboard({ onNavigate }: DashboardProps) {
  const { usuario, tienePermiso } = useAuth();
  const [stats, setStats] = useState({ contratos: 0, cuotasPendientes: 0, recepcionesPendientes: 0, cuotasVencidas: 0 });
  const [recentContratos, setRecentContratos] = useState<any[]>([]);
  const [proximasCitas, setProximasCitas] = useState<any[]>([]);
  const [vencidas, setVencidas] = useState<any[]>([]);

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    try {
      const promises: Promise<any>[] = [];

      if (tienePermiso('VENTAS', 'leer')) {
        promises.push(
          contratosService.listar({ limit: 5 }).then(r => {
            setRecentContratos(r.data.data);
            setStats(s => ({ ...s, contratos: r.data.pagination.total }));
          })
        );
      }

      if (tienePermiso('COBRANZAS', 'leer')) {
        promises.push(
          cobranzasService.listar({ estado: 'PENDIENTE', limit: 1 }).then(r => {
            setStats(s => ({ ...s, cuotasPendientes: r.data.pagination.total }));
          })
        );
        promises.push(
          cobranzasService.vencidas().then(r => {
            setVencidas(r.data.data || []);
            setStats(s => ({ ...s, cuotasVencidas: r.data.total || 0 }));
          })
        );
      }

      if (tienePermiso('RECEPCION', 'leer')) {
        promises.push(
          recepcionService.listar({ estado: 'PENDIENTE', limit: 1 }).then(r => {
            setStats(s => ({ ...s, recepcionesPendientes: r.data.pagination.total }));
          })
        );
        promises.push(
          recepcionService.citas({ desde: new Date().toISOString() }).then(r => { setProximasCitas(r.data.slice(0, 4)); })
        );
      }

      await Promise.allSettled(promises);
    } catch (err) { console.error('Error cargando dashboard:', err); }
  }

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pt-8 lg:pt-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">{greeting()}, {usuario?.nombre?.split(' ')[0]}</h1>
          <p className="text-[#8892b0] mt-1">Resumen general del sistema</p>
        </div>
        {tienePermiso('VENTAS', 'crear') && (
          <button onClick={() => onNavigate('admin-contrato-nuevo')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#2648a1] to-[#4a6fd4] text-white text-sm font-semibold shadow-lg shadow-[#2648a1]/20 hover:shadow-[#2648a1]/40 transition-all cursor-pointer">
            <Plus className="w-4 h-4" /> Nuevo Contrato
          </button>
        )}
      </div>

      {/* Métricas + Actividad (acordeones) */}
      {tienePermiso('VENTAS', 'leer') && <MetricasPanel onNavigate={onNavigate} vencidas={vencidas} />}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Contratos Activos" value={stats.contratos} icon={FileText} gradient="from-[#2648a1]/20 to-[#4a6fd4]/5" iconColor="text-[#7b9ae8]" />
        <StatCard label="Cuotas Pendientes" value={stats.cuotasPendientes} icon={Clock} gradient="from-amber-500/20 to-amber-500/5" iconColor="text-amber-400" />
        <StatCard label="Cuotas Vencidas" value={stats.cuotasVencidas} icon={AlertTriangle} gradient="from-red-500/20 to-red-500/5" iconColor="text-red-400"
          onClick={tienePermiso('COBRANZAS', 'leer') ? () => onNavigate('admin-cobranzas') : undefined} alert={stats.cuotasVencidas > 0} />
        <StatCard label="Recepciones Pend." value={stats.recepcionesPendientes} icon={UserPlus} gradient="from-emerald-500/20 to-emerald-500/5" iconColor="text-emerald-400" />
      </div>

      {/* Cuotas vencidas (si no hay acceso a métricas, se muestran sueltas) */}
      {!tienePermiso('VENTAS', 'leer') && (
        <VencidasDetalle vencidas={vencidas} onVerTodas={() => onNavigate('admin-cobranzas')} />
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Últimos contratos */}
        <Card className="lg:col-span-2 border-[#4a6fd4]/8 bg-[#131729] shadow-none">
          <div className="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#7b9ae8]" /> Últimos Contratos
            </h3>
            {tienePermiso('VENTAS', 'leer') && (
              <button onClick={() => onNavigate('admin-contratos')} className="text-xs text-[#4a6fd4] hover:text-[#7b9ae8] flex items-center gap-1 cursor-pointer">
                Ver todos <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="p-4 sm:p-5">
            {recentContratos.length === 0 ? (
              <p className="text-[#8892b0] text-sm text-center py-8">No hay contratos aún</p>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {recentContratos.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#4a6fd4]/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-[#7b9ae8]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">#{c.numeroContrato} - {c.solicitanteNombre}</div>
                        <div className="text-xs text-[#8892b0]">{c.marca} {c.modelo} · {c._count?.cuotas || 0} cuotas</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md shrink-0 ${
                      c.estado === 'ACTIVO' ? 'text-emerald-400 bg-emerald-400/10' :
                      c.estado === 'COMPLETADO' ? 'text-[#7b9ae8] bg-[#4a6fd4]/10' : 'text-red-400 bg-red-400/10'
                    }`}>{c.estado}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Próximas citas */}
        <Card className="border-[#4a6fd4]/8 bg-[#131729] shadow-none">
          <div className="p-4 sm:p-5 border-b border-white/5">
            <h3 className="font-semibold text-white flex items-center gap-2"><Clock className="w-4 h-4 text-amber-400" /> Próximas Citas</h3>
          </div>
          <div className="p-4 sm:p-5">
            {proximasCitas.length === 0 ? (
              <p className="text-[#8892b0] text-sm text-center py-8">No hay citas agendadas</p>
            ) : (
              <div className="space-y-4">
                {proximasCitas.map((cita: any) => (
                  <div key={cita.id} className="flex gap-3 items-start">
                    <div className="bg-gradient-to-br from-[#4a6fd4] to-[#2648a1] text-white text-[10px] font-bold px-2 py-1 rounded-md shrink-0">
                      {new Date(cita.fechaCita).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">{cita.nombre}</div>
                      <div className="text-xs text-[#8892b0] truncate">{cita.notasCita || cita.motivo}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, gradient, iconColor, onClick, alert }: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>;
  gradient: string; iconColor: string; onClick?: () => void; alert?: boolean;
}) {
  return (
    <Card className={`p-4 sm:p-5 border-[#4a6fd4]/8 bg-[#131729] shadow-none ${onClick ? 'cursor-pointer hover:border-[#4a6fd4]/20 transition-colors' : ''} ${alert ? '!border-red-500/30 animate-pulse-slow' : ''}`}
      onClick={onClick}>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className={`p-2.5 sm:p-3 rounded-xl bg-gradient-to-br ${gradient}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <div className="text-xl sm:text-2xl font-bold text-white">{value}</div>
          <div className="text-[10px] sm:text-xs text-[#8892b0] mt-0.5">{label}</div>
        </div>
      </div>
    </Card>
  );
}
