import React from "react";
import { Mail, Phone, MapPin, Instagram, Facebook } from "lucide-react";
import { Logo } from "./Logo";

interface FooterProps {
  onNavigate: (view: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-[#004867] text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="space-y-6">
          <Logo className="h-24 w-24 -ml-2" src={true} />
          <p className="text-blue-100/70 text-sm leading-relaxed">
            Tu confianza sobre ruedas. Concesionaria líder brindando
            transparencia y calidad en cada unidad.
          </p>
          <div className="flex gap-4">
            <a
              href="#"
              className="text-blue-200 hover:text-[#00adef] transition-colors"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="#"
              className="text-blue-200 hover:text-[#00adef] transition-colors"
            >
              <Facebook className="w-5 h-5" />
            </a>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-6">Navegación</h4>
          <ul className="space-y-3 text-sm text-gray-400">
            <li>
              <button
                onClick={() => onNavigate("home")}
                className="hover:text-white transition-colors"
              >
                Inicio
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigate("stock")}
                className="hover:text-white transition-colors"
              >
                Vehículos
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigate("about")}
                className="hover:text-white transition-colors"
              >
                Empresa
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigate("contact")}
                className="hover:text-white transition-colors"
              >
                Contacto
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-6">Contacto</h4>
          <ul className="space-y-4 text-sm text-gray-400">
            <li className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#00adef] shrink-0" />
              <span>Av. Principal 1234, Ciudad Autonoma</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-[#00adef] shrink-0" />
              <span>+54 11 1234-5678</span>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-[#00adef] shrink-0" />
              <span>contacto@diparola.com.ar</span>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-6">Horarios</h4>
          <ul className="space-y-3 text-sm text-gray-400">
            <li>Lunes a Viernes: 09:00 - 19:00</li>
            <li>Sábados: 09:00 - 13:00</li>
            <li>Domingos: Cerrado</li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-8 border-t border-gray-700/50 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
        <p>
          © {new Date().getFullYear()} Diparola Automotores. Todos los derechos
          reservados.
        </p>
        <div className="flex gap-6">
          <button
            onClick={() => onNavigate("login")}
            className="hover:text-gray-300 transition-colors"
          >
            Acceso interno
          </button>
          <a href="#" className="hover:text-gray-300 transition-colors">
            Términos y Condiciones
          </a>
          <a href="#" className="hover:text-gray-300 transition-colors">
            Privacidad
          </a>
        </div>
      </div>
    </footer>
  );
};
