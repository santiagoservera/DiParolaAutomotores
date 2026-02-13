import React from "react";
import {
  LayoutDashboard,
  Car,
  Users,
  TrendingUp,
  FileText,
  LogOut,
  Settings,
  ChevronRight,
} from "lucide-react";
import { Logo } from "./Logo";
import type { ViewType } from "@/types";

interface AdminSidebarProps {
  currentView: string;
  onNavigate: (view: ViewType) => void;
  onLogout: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentView,
  onNavigate,
  onLogout,
}) => {
  const menuItems = [
    { id: "admin-dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "admin-vehicles", label: "Vehículos", icon: Car },
    { id: "admin-clients", label: "Clientes", icon: Users },
    { id: "admin-sales", label: "Ventas", icon: TrendingUp },
    { id: "admin-content", label: "Contenido", icon: FileText },
    { id: "admin-settings", label: "Configuración", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#004867] h-screen fixed left-0 top-0 flex flex-col text-white">
      <div className="p-6 border-b border-white/10 flex flex-col items-center">
        <Logo className="h-24 w-24" src={true} />
        <div className="mt-2 text-[10px] uppercase tracking-widest text-blue-300/60 font-bold">
          Panel Administrativo
        </div>
      </div>

      <nav className="flex-1 py-6">
        {menuItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as ViewType)}
              className={`w-full flex items-center justify-between px-6 py-3 transition-colors ${
                isActive
                  ? "bg-[#00adef] text-white shadow-lg"
                  : "text-blue-100/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              {isActive && <ChevronRight className="w-4 h-4" />}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#2a4a5a]">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-2 w-full text-gray-400 hover:text-red-400 transition-colors text-sm font-medium"
        >
          <LogOut className="w-5 h-5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
};
