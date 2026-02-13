import { FileText } from 'lucide-react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminDashboard } from './AdminDashboard';
import { Button } from '@/components/ui';
import type { ViewType, NavigationProps } from '@/types';

interface AdminLayoutProps extends NavigationProps {
  currentView: ViewType;
  onLogout: () => void;
}

export function AdminLayout({ currentView, onNavigate, onLogout }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar
        currentView={currentView}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      <main className="ml-64 p-10">
        <div className="max-w-6xl mx-auto">
          {currentView === 'admin-dashboard' && <AdminDashboard />}

          {['admin-vehicles', 'admin-clients', 'admin-sales', 'admin-content'].includes(currentView) && (
            <PlaceholderSection
              section={currentView.split('-')[1]}
              onBack={() => onNavigate('admin-dashboard')}
            />
          )}
        </div>
      </main>
    </div>
  );
}

interface PlaceholderSectionProps {
  section: string;
  onBack: () => void;
}

function PlaceholderSection({ section, onBack }: PlaceholderSectionProps) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-gray-300">
      <FileText className="w-20 h-20 mb-6 opacity-20" />
      <h2 className="text-2xl font-bold text-[#004867]">Sección de Gestión</h2>
      <p className="text-gray-500 mt-2">
        Vista de {section} - Próximamente
      </p>
      <Button variant="outline" className="mt-8" onClick={onBack}>
        Volver al Dashboard
      </Button>
    </div>
  );
}
