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

const MobileAccordion: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, icon, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <span className="flex items-center gap-3 font-semibold text-sm tracking-wide uppercase text-foreground">
          {icon}
          {title}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[var(--brand-light)] transition-transform duration-300 ${
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
    <footer className="bg-background dark:bg-[#0f1a3a] text-foreground dark:text-white border-t border-border dark:border-white/10 pt-16 pb-8">
      {/* DESKTOP */}
      <div className="hidden md:grid max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid-cols-4 gap-12">
        <div className="space-y-6">
          <Logo className="h-32 w-42 -ml-2 rounded-3xl" src={false} />
          <p className="text-muted-foreground dark:text-white/60 text-sm leading-relaxed">
            Tu confianza sobre ruedas. Concesionaria brindando transparencia y
            calidad en cada unidad.
          </p>
          <div className="flex gap-4">
            <a
              href="https://www.instagram.com/automotores.diparola/"
              className="text-muted-foreground dark:text-white/60 hover:text-[var(--brand)] dark:hover:text-[var(--brand-accent)] transition-colors"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="https://www.facebook.com/share/1EAWxRrpRK/?mibextid=wwXIfr"
              className="text-muted-foreground dark:text-white/60 hover:text-[var(--brand)] dark:hover:text-[var(--brand-accent)] transition-colors"
            >
              <Facebook className="w-5 h-5" />
            </a>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-6 text-[var(--brand)] dark:text-white">
            Navegación
          </h4>
          <ul className="space-y-3 text-sm text-muted-foreground dark:text-white/50">
            <li>
              <button
                onClick={() => onNavigate("home")}
                className="hover:text-[var(--brand)] dark:hover:text-white transition-colors"
              >
                Inicio
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigate("about")}
                className="hover:text-[var(--brand)] dark:hover:text-white transition-colors"
              >
                Empresa
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigate("contact")}
                className="hover:text-[var(--brand)] dark:hover:text-white transition-colors"
              >
                Contacto
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-6 text-[var(--brand)] dark:text-white">
            Contacto
          </h4>
          <ul className="space-y-4 text-sm text-muted-foreground dark:text-white/50">
            <li className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[var(--brand-light)] shrink-0" />
              <span>Chile Este 445</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-[var(--brand-light)] shrink-0" />
              <span>+54 9 2643 16-0888</span>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-[var(--brand-light)] shrink-0" />
              <span>Consultas@diparolaautomotores.com</span>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-6 text-[var(--brand)] dark:text-white">
            Horarios
          </h4>
          <ul className="space-y-3 text-sm text-muted-foreground dark:text-white/50">
            <li>Lunes a Viernes: 09:00 - 19:00</li>
            <li>Sábados: 09:00 - 13:00</li>
            <li>Domingos: Cerrado</li>
          </ul>
        </div>
      </div>

      {/* MOBILE */}
      <div className="md:hidden px-5">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo className="h-20 w-20 rounded-3xl mb-4" src={false} />
          <p className="text-muted-foreground dark:text-white/50 text-sm leading-relaxed max-w-xs">
            Tu confianza sobre ruedas. Transparencia y calidad en cada unidad.
          </p>

          <div className="flex gap-3 mt-5">
            <a
              href="https://www.instagram.com/automotores.diparola/"
              className="flex items-center gap-2 bg-[var(--brand)]/5 dark:bg-white/10 rounded-full px-4 py-2 text-xs font-medium text-[var(--brand)] dark:text-white/80 hover:bg-[var(--brand)]/10 dark:hover:bg-white/20 transition-colors"
            >
              <Instagram className="w-4 h-4" />
              Instagram
            </a>
            <a
              href="https://www.facebook.com/share/1EAWxRrpRK/?mibextid=wwXIfr"
              className="flex items-center gap-2 bg-[var(--brand)]/5 dark:bg-white/10 rounded-full px-4 py-2 text-xs font-medium text-[var(--brand)] dark:text-white/80 hover:bg-[var(--brand)]/10 dark:hover:bg-white/20 transition-colors"
            >
              <Facebook className="w-4 h-4" />
              Facebook
            </a>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <a
            href="tel:+5492643160888"
            className="flex flex-col items-center gap-2 bg-[var(--brand)]/5 dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl p-4 active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--brand-light)]/10 dark:bg-[var(--brand-light)]/20 flex items-center justify-center">
              <Phone className="w-5 h-5 text-[var(--brand-light)]" />
            </div>
            <span className="text-xs font-medium text-foreground dark:text-white/80">
              Llamar
            </span>
          </a>

          <a
            href="mailto:Consultas@diparolaautomotores.com"
            className="flex flex-col items-center gap-2 bg-[var(--brand)]/5 dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl p-4 active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--brand-light)]/10 dark:bg-[var(--brand-light)]/20 flex items-center justify-center">
              <Mail className="w-5 h-5 text-[var(--brand-light)]" />
            </div>
            <span className="text-xs font-medium text-foreground dark:text-white/80">
              Email
            </span>
          </a>

          <a
            href="https://maps.app.goo.gl/bwNbzbHJnTZ8SiAs8"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 bg-[var(--brand)]/5 dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl p-4 active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--brand-light)]/10 dark:bg-[var(--brand-light)]/20 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-[var(--brand-light)]" />
            </div>
            <span className="text-xs font-medium text-foreground dark:text-white/80">
              Cómo llegar
            </span>
          </a>
        </div>

        <div className="mb-6">
          <MobileAccordion
            title="Horarios"
            icon={<Clock className="w-4 h-4 text-[var(--brand-light)]" />}
            defaultOpen
          >
            <div className="space-y-2 pl-7">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground dark:text-white/50">
                  Lun – Vie
                </span>
                <span className="text-foreground dark:text-white/80 font-medium">
                  09:00 – 19:00
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground dark:text-white/50">
                  Sábados
                </span>
                <span className="text-foreground dark:text-white/80 font-medium">
                  09:00 – 13:00
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground dark:text-white/50">
                  Domingos
                </span>
                <span className="text-red-500 dark:text-red-400/80 font-medium">
                  Cerrado
                </span>
              </div>
            </div>
          </MobileAccordion>

          <MobileAccordion
            title="Navegación"
            icon={<MapPin className="w-4 h-4 text-[var(--brand-light)]" />}
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
                  className="text-left text-sm text-muted-foreground dark:text-white/60 hover:text-[var(--brand)] dark:hover:text-white py-1 transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </MobileAccordion>
        </div>

        <div className="flex items-center gap-3 bg-[var(--brand)]/5 dark:bg-white/5 rounded-xl px-4 py-3 mb-6">
          <MapPin className="w-4 h-4 text-[var(--brand-light)] shrink-0" />
          <span className="text-sm text-muted-foreground dark:text-white/60">
            Chile Este 445, San Juan
          </span>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-8 border-t border-border dark:border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground dark:text-white/40">
        <p>
          © {new Date().getFullYear()} Diparola Automotores. Todos los derechos
          reservados.
        </p>
        <div className="flex gap-6">
          <button
            onClick={() => onNavigate("login")}
            className="hover:text-[var(--brand)] dark:hover:text-white/70 transition-colors"
          >
            Acceso interno
          </button>
          <a
            href="#"
            className="hover:text-[var(--brand)] dark:hover:text-white/70 transition-colors"
          >
            Términos y Condiciones
          </a>
          <a
            href="#"
            className="hover:text-[var(--brand)] dark:hover:text-white/70 transition-colors"
          >
            Privacidad
          </a>
        </div>
      </div>
    </footer>
  );
};
