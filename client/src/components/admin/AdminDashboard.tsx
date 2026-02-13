import {
  Plus,
  TrendingUp,
  Users,
  Car as CarIcon,
  MessageSquare,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';

export function AdminDashboard() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-[#004867]">
            Dashboard Administrativo
          </h1>
          <p className="text-gray-500">Métricas generales del negocio</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm">
            Exportar Reporte
          </Button>
          <Button variant="primary" size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva Unidad
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Unidades Disponibles"
          value="42"
          icon={CarIcon}
          color="text-blue-600"
        />
        <StatCard
          label="Consultas este mes"
          value="128"
          icon={MessageSquare}
          color="text-green-600"
        />
        <StatCard
          label="Visitas Web"
          value="2.4k"
          icon={TrendingUp}
          color="text-[#00adef]"
        />
        <StatCard
          label="Clientes Registrados"
          value="856"
          icon={Users}
          color="text-purple-600"
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Últimos movimientos */}
        <Card className="lg:col-span-2 border-none shadow-lg shadow-gray-200/50">
          <div className="p-6 border-b border-gray-50">
            <h3 className="font-bold text-[#004867]">Últimos movimientos</h3>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              {MOVIMIENTOS.map((mov, i) => (
                <MovimientoItem key={i} {...mov} />
              ))}
            </div>
          </div>
        </Card>

        {/* Próximas visitas */}
        <Card className="border-none shadow-lg shadow-gray-200/50">
          <div className="p-6 border-b border-gray-50">
            <h3 className="font-bold text-[#004867]">Próximas Visitas</h3>
          </div>
          <div className="p-6 space-y-6">
            {VISITAS.map((visita, i) => (
              <VisitaItem key={i} {...visita} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Componentes internos
interface StatCardProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  return (
    <Card className="p-6 border-none shadow-md shadow-gray-200/50">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 bg-gray-50 rounded-xl ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <div className="space-y-1">
        <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          {label}
        </span>
        <h3 className="text-3xl font-bold text-[#004867]">{value}</h3>
      </div>
    </Card>
  );
}

interface MovimientoItemProps {
  titulo: string;
  detalle: string;
  estado: string;
}

function MovimientoItem({ titulo, detalle, estado }: MovimientoItemProps) {
  return (
    <div className="flex items-center justify-between pb-4 border-b border-gray-50 last:border-0 last:pb-0">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
          <CarIcon className="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <div className="font-bold text-[#004867]">{titulo}</div>
          <div className="text-xs text-gray-400">{detalle}</div>
        </div>
      </div>
      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
        {estado}
      </span>
    </div>
  );
}

interface VisitaItemProps {
  nombre: string;
  hora: string;
  descripcion: string;
}

function VisitaItem({ nombre, hora, descripcion }: VisitaItemProps) {
  return (
    <div className="flex gap-4 items-start">
      <div className="bg-[#004867] text-white text-[10px] font-bold px-2 py-1 rounded shrink-0">
        {hora}
      </div>
      <div className="space-y-1">
        <div className="text-sm font-bold text-[#004867]">{nombre}</div>
        <div className="text-xs text-gray-500">{descripcion}</div>
      </div>
    </div>
  );
}

// Datos de ejemplo
const MOVIMIENTOS: MovimientoItemProps[] = [
  { titulo: 'Ingreso de Nueva Unidad', detalle: 'Hace 2 horas • Toyota Hilux 2024', estado: 'Activo' },
  { titulo: 'Venta Confirmada', detalle: 'Hace 4 horas • VW Taos 2023', estado: 'Completado' },
  { titulo: 'Nueva Simulación', detalle: 'Hace 6 horas • Ford Ranger 2022', estado: 'Pendiente' },
  { titulo: 'Pago Registrado', detalle: 'Hace 8 horas • Cuota 3/12', estado: 'Activo' },
];

const VISITAS: VisitaItemProps[] = [
  { nombre: 'Carlos Mendoza', hora: '10:30 AM', descripcion: 'Ver Toyota Corolla' },
  { nombre: 'Elena Solis', hora: '12:00 PM', descripcion: 'Tasación de usado' },
  { nombre: 'Miguel Angel', hora: '04:15 PM', descripcion: 'Entrega de documentación' },
];
