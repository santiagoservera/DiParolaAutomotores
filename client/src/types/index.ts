// Tipos para Vehículos
export interface Vehiculo {
  id: number;
  marca: string;
  modelo: string;
  nombre: string;
  year: number;
  km: string;
  precio?: string;
  img: string;
  categoria: string;
}

// Tipos para Testimonios
export interface Testimonio {
  id: number;
  nombre: string;
  texto: string;
  rating: number;
  imagen?: string;
  vehiculo?: string;
}

// Tipos para navegación
export type ViewType = 
  | 'home' 
  | 'stock' 
  | 'about' 
  | 'contact' 
  | 'login'
  | 'admin-dashboard'
  | 'admin-vehicles'
  | 'admin-clients'
  | 'admin-sales'
  | 'admin-content';

export interface NavigationProps {
  onNavigate: (view: ViewType) => void;
  currentView?: ViewType;
}
