import React, { useState } from "react";
import {
  Mail,
  Phone,
  MapPin,
  Instagram,
  Facebook,
  ChevronDown,
  Clock,
  Navigation,
} from "lucide-react";
import { Logo } from "./Logo";

interface FooterProps {
  onNavigate: (view: string) => void;
}

/* ── Collapsible section (mobile only) ── */
const MobileAccordion: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, icon, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/10 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <span className="flex items-center gap-3 font-semibold text-sm tracking-wide uppercase">
          {icon}
          {title}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-blue-300 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "max-h-60 pb-4" : "max-h-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
};

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-[#004867] dark:bg-[#0a2a3a] text-white pt-16 pb-8">
      {/* ═══════════════════════════════════════════
          DESKTOP LAYOUT  (md+)  — sin cambios
         ═══════════════════════════════════════════ */}
      <div className="hidden md:grid max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid-cols-4 gap-12">
        {/* Brand */}
        <div className="space-y-6">
          <Logo className="h-24 w-24 -ml-2 rounded-3xl" src={true} />
          <p className="text-blue-100/70 text-sm leading-relaxed">
            Tu confianza sobre ruedas. Concesionaria líder brindando
            transparencia y calidad en cada unidad.
          </p>
          <div className="flex gap-4">
            <a
              href="https://www.facebook.com/share/1EAWxRrpRK/?mibextid=wwXIfr"
              className="text-blue-200 hover:text-[#00adef] transition-colors"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="https://www.instagram.com/automotores.diparola/"
              className="text-blue-200 hover:text-[#00adef] transition-colors"
            >
              <Facebook className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* Nav */}
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

        {/* Contacto */}
        <div>
          <h4 className="font-semibold mb-6">Contacto</h4>
          <ul className="space-y-4 text-sm text-gray-400">
            <li className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#00adef] shrink-0" />
              <span>Chile Este 445</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-[#00adef] shrink-0" />
              <span>+54 9 2643 16-0888</span>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-[#00adef] shrink-0" />
              <span>Consultas@diparolaautomotores.com</span>
            </li>
          </ul>
        </div>

        {/* Horarios */}
        <div>
          <h4 className="font-semibold mb-6">Horarios</h4>
          <ul className="space-y-3 text-sm text-gray-400">
            <li>Lunes a Viernes: 09:00 - 19:00</li>
            <li>Sábados: 09:00 - 13:00</li>
            <li>Domingos: Cerrado</li>
          </ul>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          MOBILE LAYOUT  (<md)
         ═══════════════════════════════════════════ */}
      <div className="md:hidden px-5">
        {/* Brand header centrado */}
        <div className="flex flex-col items-center text-center mb-8">
          <Logo className="h-20 w-20 rounded-3xl mb-4" src={true} />
          <p className="text-blue-100/60 text-sm leading-relaxed max-w-xs">
            Tu confianza sobre ruedas. Transparencia y calidad en cada unidad.
          </p>

          {/* Social pills */}
          <div className="flex gap-3 mt-5">
            <a
              href="https://www.instagram.com/automotores.diparola/"
              className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 text-xs font-medium text-blue-100 hover:bg-white/20 transition-colors"
            >
              <Instagram className="w-4 h-4" />
              Instagram
            </a>
            <a
              href="https://www.facebook.com/share/1EAWxRrpRK/?mibextid=wwXIfr"
              className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 text-xs font-medium text-blue-100 hover:bg-white/20 transition-colors"
            >
              <Facebook className="w-4 h-4" />
              Facebook
            </a>
          </div>
        </div>

        {/* Quick‑action cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <a
            href="tel:+5492643160888"
            className="flex flex-col items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-4 active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 rounded-full bg-[#00adef]/20 flex items-center justify-center">
              <Phone className="w-5 h-5 text-[#00adef]" />
            </div>
            <span className="text-xs font-medium text-blue-100">Llamar</span>
          </a>

          <a
            href="mailto:Consultas@diparolaautomotores.com"
            className="flex flex-col items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-4 active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 rounded-full bg-[#00adef]/20 flex items-center justify-center">
              <Mail className="w-5 h-5 text-[#00adef]" />
            </div>
            <span className="text-xs font-medium text-blue-100">Email</span>
          </a>

          <a
            href="https://maps.app.goo.gl/bwNbzbHJnTZ8SiAs8"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-4 active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 rounded-full bg-[#00adef]/20 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-[#00adef]" />
            </div>
            <span className="text-xs font-medium text-blue-100">
              Cómo llegar
            </span>
          </a>
        </div>

        {/* Accordion sections */}
        <div className="mb-6">
          <MobileAccordion
            title="Horarios"
            icon={<Clock className="w-4 h-4 text-[#00adef]" />}
            defaultOpen
          >
            <div className="space-y-2 pl-7">
              <div className="flex justify-between text-sm">
                <span className="text-blue-100/60">Lun – Vie</span>
                <span className="text-blue-100 font-medium">09:00 – 19:00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-100/60">Sábados</span>
                <span className="text-blue-100 font-medium">09:00 – 13:00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-100/60">Domingos</span>
                <span className="text-red-400/80 font-medium">Cerrado</span>
              </div>
            </div>
          </MobileAccordion>

          <MobileAccordion
            title="Navegación"
            icon={<MapPin className="w-4 h-4 text-[#00adef]" />}
          >
            <div className="grid grid-cols-2 gap-2 pl-7">
              {[
                { label: "Inicio", view: "home" },

                { label: "Empresa", view: "about" },
                { label: "Contacto", view: "contact" },
              ].map((item) => (
                <button
                  key={item.view}
                  onClick={() => onNavigate(item.view)}
                  className="text-left text-sm text-blue-100/70 hover:text-white py-1 transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </MobileAccordion>
        </div>

        {/* Dirección pill */}
        <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 mb-6">
          <MapPin className="w-4 h-4 text-[#00adef] shrink-0" />
          <span className="text-sm text-blue-100/70">
            Chile Este 445, San Juan
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          BOTTOM BAR  (shared)
         ═══════════════════════════════════════════ */}
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
