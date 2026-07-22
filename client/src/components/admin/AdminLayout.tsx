import { useEffect, useState, useRef } from 'react';
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

function PageTransition({ viewKey, children }: { viewKey: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const prevKey = useRef(viewKey);

  useEffect(() => {
    if (viewKey !== prevKey.current) {
      setShow(false);
      prevKey.current = viewKey;
      requestAnimationFrame(() => requestAnimationFrame(() => setShow(true)));
    } else {
      setShow(true);
    }
  }, [viewKey]);

  return (
    <div className={`transition-all duration-300 ease-out ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
      {children}
    </div>
  );
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
          <PageTransition viewKey={currentView}>
            {currentView === 'admin-dashboard' && <AdminDashboard onNavigate={onNavigate} />}
            {currentView === 'admin-contratos' && <ContratosPage onNavigate={onNavigate} />}
            {currentView === 'admin-contrato-nuevo' && <ContratoFormPage onNavigate={onNavigate} />}
            {currentView === 'admin-cobranzas' && <CobranzasPage />}
            {currentView === 'admin-recepcion' && <RecepcionPage />}
            {currentView === 'admin-importar' && <ImportarPage />}
            {currentView === 'admin-configuracion' && <ConfiguracionPage />}
          </PageTransition>
        </div>
      </main>
    </div>
  );
}
