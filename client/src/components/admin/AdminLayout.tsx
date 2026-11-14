import { useEffect, useState, useRef, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, Home } from 'lucide-react';
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

// Error boundary por página: si una vista falla, el sidebar/bottom bar siguen usables
class PageErrorBoundary extends Component<{ children: ReactNode; onHome: () => void }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error en la página:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-4 p-6 sm:p-8 rounded-xl bg-[#131729] border border-red-500/20 max-w-md w-full">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Algo salió mal en esta sección</h2>
            <p className="text-sm text-[#8892b0]">Ocurrió un error inesperado. Podés volver al inicio o elegir otra sección del menú.</p>
            <button onClick={() => { this.setState({ hasError: false }); this.props.onHome(); }}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#4a6fd4] text-white text-sm font-semibold cursor-pointer hover:bg-[#3a5fc4]">
              <Home className="w-4 h-4" /> Volver al inicio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AdminLayout({
  currentView,
  onNavigate,
  onLogout,
}: AdminLayoutProps) {
  // Evitar pull-to-refresh accidental en mobile mientras se está en el admin
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overscrollBehaviorY;
    const prevBody = body.style.overscrollBehaviorY;
    html.style.overscrollBehaviorY = 'contain';
    body.style.overscrollBehaviorY = 'contain';
    return () => {
      html.style.overscrollBehaviorY = prevHtml;
      body.style.overscrollBehaviorY = prevBody;
    };
  }, []);

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
            <PageErrorBoundary key={currentView} onHome={() => onNavigate('admin-dashboard')}>
            {currentView === 'admin-dashboard' && <AdminDashboard onNavigate={onNavigate} />}
            {currentView === 'admin-contratos' && <ContratosPage onNavigate={onNavigate} />}
            {currentView === 'admin-contrato-nuevo' && <ContratoFormPage onNavigate={onNavigate} />}
            {currentView === 'admin-cobranzas' && <CobranzasPage />}
            {currentView === 'admin-recepcion' && <RecepcionPage />}
            {currentView === 'admin-importar' && <ImportarPage />}
            {currentView === 'admin-configuracion' && <ConfiguracionPage />}
            </PageErrorBoundary>
          </PageTransition>
        </div>
      </main>
    </div>
  );
}
