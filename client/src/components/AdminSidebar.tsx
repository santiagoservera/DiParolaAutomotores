import React from 'react';
import {
  LayoutDashboard,
  FileText,
  DollarSign,
  UserPlus,
  Settings,
  LogOut,
  ChevronRight,
  Upload,
  MoreHorizontal,
} from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '@/context/AuthContext';
import type { ViewType } from '@/types';

interface AdminSidebarProps {
  currentView: string;
  onNavigate: (view: ViewType) => void;
  onLogout: () => void;
}

const allMenuItems = [
  { id: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard, modulo: null },
  { id: 'admin-contratos', label: 'Ventas', icon: FileText, modulo: 'VENTAS' },
  { id: 'admin-cobranzas', label: 'Cobranzas', icon: DollarSign, modulo: 'COBRANZAS' },
  { id: 'admin-recepcion', label: 'Recepción', icon: UserPlus, modulo: 'RECEPCION' },
  { id: 'admin-importar', label: 'Importar', icon: Upload, modulo: 'CONFIGURACION' },
  { id: 'admin-configuracion', label: 'Config.', icon: Settings, modulo: 'CONFIGURACION' },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentView,
  onNavigate,
  onLogout,
}) => {
  const { usuario, tienePermiso } = useAuth();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const menuItems = allMenuItems.filter(
    item => item.modulo === null || tienePermiso(item.modulo, 'leer')
  );

  // Mobile: show main tabs (max 4) + "Más" if needed
  const MOBILE_MAX = 4;
  const primaryTabs = menuItems.slice(0, MOBILE_MAX);
  const overflowTabs = menuItems.slice(MOBILE_MAX);
  const hasOverflow = overflowTabs.length > 0;

  const isActive = (id: string) =>
    currentView === id || (id === 'admin-contratos' && currentView === 'admin-contrato-nuevo');

  // ── Desktop Sidebar (unchanged) ────────────────────────────────────────

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-white/5 flex flex-col items-center">
        <Logo className="h-16 w-16" src={true} />
        <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#7b9ae8]/60 font-bold">
          Panel de Gestión
        </div>
      </div>

      <div className="px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#4a6fd4] to-[#2648a1] flex items-center justify-center text-white text-sm font-bold">
            {usuario?.nombre?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{usuario?.nombre}</div>
            <div className="text-[10px] text-[#8892b0] truncate">{usuario?.rol?.nombre}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-4 mb-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#8892b0]/40">
            Módulos
          </span>
        </div>
        {menuItems.map((item) => {
          const active = isActive(item.id);
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as ViewType)}
              className={`w-full flex items-center justify-between px-6 py-3 transition-all duration-200 cursor-pointer ${
                active
                  ? 'bg-gradient-to-r from-[#4a6fd4]/20 to-transparent text-white border-r-2 border-[#4a6fd4]'
                  : 'text-[#8892b0] hover:bg-white/[0.03] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className={`w-[18px] h-[18px] ${active ? 'text-[#7b9ae8]' : ''}`} />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              {active && <ChevronRight className="w-3.5 h-3.5 text-[#7b9ae8]" />}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-2.5 w-full text-[#8892b0] hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all duration-200 text-sm font-medium cursor-pointer"
        >
          <LogOut className="w-[18px] h-[18px]" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 bg-[#0b0e18] h-screen fixed left-0 top-0 flex-col z-40 border-r border-[#4a6fd4]/8">
        {sidebarContent}
      </aside>

      {/* ── Mobile Bottom Tab Bar ───────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0b0e18] border-t border-[#4a6fd4]/10 safe-area-bottom">
        <div className="flex items-stretch">
          {primaryTabs.map((item) => {
            const active = isActive(item.id);
            return (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id as ViewType); setMoreOpen(false); }}
                className={`flex-1 flex flex-col items-center justify-center py-2 pt-2.5 gap-0.5 transition-colors duration-200 cursor-pointer relative ${
                  active ? 'text-[#7b9ae8]' : 'text-[#8892b0]/60 active:text-[#8892b0]'
                }`}
              >
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#4a6fd4]" />
                )}
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </button>
            );
          })}

          {/* "Más" tab for overflow items */}
          {hasOverflow && (
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex-1 flex flex-col items-center justify-center py-2 pt-2.5 gap-0.5 transition-colors duration-200 cursor-pointer relative ${
                moreOpen || overflowTabs.some(t => isActive(t.id)) ? 'text-[#7b9ae8]' : 'text-[#8892b0]/60 active:text-[#8892b0]'
              }`}
            >
              {(moreOpen || overflowTabs.some(t => isActive(t.id))) && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#4a6fd4]" />
              )}
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-tight">Más</span>
            </button>
          )}
        </div>

        {/* Overflow menu */}
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-[-1]" onClick={() => setMoreOpen(false)} />
            <div className="absolute bottom-full left-0 right-0 bg-[#131729] border-t border-[#4a6fd4]/10 shadow-2xl shadow-black/40 animate-in slide-in-from-bottom-2 fade-in duration-200">
              {overflowTabs.map((item) => {
                const active = isActive(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => { onNavigate(item.id as ViewType); setMoreOpen(false); }}
                    className={`w-full flex items-center gap-3 px-5 py-3.5 transition-colors duration-200 cursor-pointer ${
                      active ? 'text-[#7b9ae8] bg-[#4a6fd4]/10' : 'text-[#8892b0] active:bg-white/5'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                );
              })}
              <button
                onClick={() => { onLogout(); setMoreOpen(false); }}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-red-400 active:bg-red-400/5 transition-colors cursor-pointer border-t border-[#4a6fd4]/10"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">Cerrar Sesión</span>
              </button>
            </div>
          </>
        )}
      </nav>
    </>
  );
};
