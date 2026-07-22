import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminDashboard } from './AdminDashboard';
import { ContratosPage } from '@/pages/admin/ContratosPage';
import { ContratoFormPage } from '@/pages/admin/ContratoFormPage';
import { CobranzasPage } from '@/pages/admin/CobranzasPage';
import { RecepcionPage } from '@/pages/admin/RecepcionPage';
import { ConfiguracionPage } from '@/pages/admin/ConfiguracionPage';
import { ImportarPage } from '@/pages/admin/ImportarPage';
import type { ViewType, NavigationProps } from '@/types';

interface AdminLayoutProps extends NavigationProps {
  currentView: ViewType;
  onLogout: () => void;
}

export function AdminLayout({
  currentView,
  onNavigate,
  onLogout,
}: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0b0e18]">
      <AdminSidebar
        currentView={currentView}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      <main className="lg:ml-64 min-h-screen pb-20 lg:pb-0">
        <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto">
          {currentView === 'admin-dashboard' && <AdminDashboard onNavigate={onNavigate} />}
          {currentView === 'admin-contratos' && <ContratosPage onNavigate={onNavigate} />}
          {currentView === 'admin-contrato-nuevo' && <ContratoFormPage onNavigate={onNavigate} />}
          {currentView === 'admin-cobranzas' && <CobranzasPage />}
          {currentView === 'admin-recepcion' && <RecepcionPage />}
          {currentView === 'admin-importar' && <ImportarPage />}
          {currentView === 'admin-configuracion' && <ConfiguracionPage />}
        </div>
      </main>
    </div>
  );
}
