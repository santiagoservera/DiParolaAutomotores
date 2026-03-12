import { Button } from "@/components/ui";
import { Logo } from "@/components/Logo";
import type { NavigationProps } from "@/types";

export function AboutSection({ onNavigate }: NavigationProps) {
  return (
    <section className="bg-muted py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row justify-center items-center gap-16">
          <div className="flex-shrink-0">
            <div className="h-72 w-72 rounded-full bg-background shadow-xl shadow-[var(--brand)]/10 flex items-center justify-center">
              <Logo src={false} className="max-w-[75%] max-h-[75%]" />
            </div>
          </div>

          <div className="max-w-xl space-y-8 text-center lg:text-left">
            <div className="space-y-4">
              <h2 className="text-4xl font-bold text-[var(--brand)]">
                Trayectoria y Transparencia
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Di Parola Automotores es un proyecto nuevo, pero detrás hay un
                equipo con años de experiencia en el rubro automotor. Conocemos
                el mercado, sabemos elegir las mejores unidades y te acompañamos
                en cada paso para que tu compra sea segura y sin sorpresas.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <div className="text-4xl font-bold text-[var(--brand)]">
                  +10
                </div>
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                  Años de experiencia en el rubro
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-4xl font-bold text-[var(--brand)]">
                  100%
                </div>
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                  Unidades verificadas
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="px-10"
              onClick={() => onNavigate("about")}
            >
              Conocenos
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
