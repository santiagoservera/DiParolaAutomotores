import React from "react";
import { Menu, X, Sun, Moon } from "lucide-react";
import { Button } from "./ui";
import { Logo } from "./Logo";

interface NavbarProps {
  onNavigate: (view: string) => void;
  isDark: boolean;
  onToggleDark: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onNavigate,
  isDark,
  onToggleDark,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <nav className="bg-background border-b border-border sticky top-0 z-50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-24">
          <div className="flex items-center">
            <button
              onClick={() => onNavigate("home")}
              className="flex items-center py-2"
            >
              <Logo className="h-20 w-20" />
            </button>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => onNavigate("home")}
              className="text-muted-foreground hover:text-[#004867] dark:hover:text-[#00adef] text-sm font-medium transition-colors"
            >
              Inicio
            </button>
            <button
              onClick={() => onNavigate("stock")}
              className="text-muted-foreground hover:text-[#004867] dark:hover:text-[#00adef] text-sm font-medium transition-colors"
            >
              Vehículos
            </button>
            <button
              onClick={() => onNavigate("about")}
              className="text-muted-foreground hover:text-[#004867] dark:hover:text-[#00adef] text-sm font-medium transition-colors"
            >
              Sobre Nosotros
            </button>
            <button
              onClick={() => onNavigate("contact")}
              className="text-muted-foreground hover:text-[#004867] dark:hover:text-[#00adef] text-sm font-medium transition-colors"
            >
              Contacto
            </button>

            {/* Toggle dark mode */}
            <button
              onClick={onToggleDark}
              className="p-2 rounded-full text-muted-foreground hover:text-[#004867] dark:hover:text-[#00adef] hover:bg-muted transition-colors"
              aria-label="Cambiar tema"
            >
              {isDark ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            <Button variant="secondary" onClick={() => onNavigate("stock")}>
              Ver vehículos
            </Button>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={onToggleDark}
              className="p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Cambiar tema"
            >
              {isDark ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-muted-foreground"
            >
              {isOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden bg-background border-t border-border px-4 py-4 space-y-4 transition-colors">
          <button
            onClick={() => {
              onNavigate("home");
              setIsOpen(false);
            }}
            className="block w-full text-left text-muted-foreground py-2"
          >
            Inicio
          </button>
          <button
            onClick={() => {
              onNavigate("stock");
              setIsOpen(false);
            }}
            className="block w-full text-left text-muted-foreground py-2"
          >
            Vehículos
          </button>
          <button
            onClick={() => {
              onNavigate("about");
              setIsOpen(false);
            }}
            className="block w-full text-left text-muted-foreground py-2"
          >
            Sobre Nosotros
          </button>
          <button
            onClick={() => {
              onNavigate("contact");
              setIsOpen(false);
            }}
            className="block w-full text-left text-muted-foreground py-2"
          >
            Contacto
          </button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              onNavigate("stock");
              setIsOpen(false);
            }}
          >
            Ver vehículos
          </Button>
        </div>
      )}
    </nav>
  );
};
