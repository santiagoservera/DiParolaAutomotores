import { Button } from "@/components/ui";
import { Logo } from "@/components/Logo";
import type { NavigationProps } from "@/types";

export function AboutSection({ onNavigate }: NavigationProps) {
  return (
    <section className="bg-muted py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row justify-center items-center gap-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <div className="h-72 w-72 rounded-full bg-background shadow-xl shadow-[#004867]/10 flex items-center justify-center">
              <Logo src={false} className="max-w-[75%] max-h-[75%] " />
            </div>
          </div>

          {/* Content */}
          <div className="max-w-xl space-y-8 text-center lg:text-left">
            <div className="space-y-4">
              <h2 className="text-4xl font-bold text-[#004867] dark:text-[#4db8db]">
                Trayectoria y Transparencia
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Di Parola Automotores nace con el compromiso de transformar la
                experiencia de compra de un vehículo. Con más de una década en
                el sector, nos enfocamos en ofrecer unidades chequeadas
                minuciosamente para garantizar su tranquilidad.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <div className="text-4xl font-bold text-[#004867] dark:text-[#4db8db]">+15</div>
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                  Años de historia
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-4xl font-bold text-[#004867] dark:text-[#4db8db]">+1000</div>
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                  Clientes satisfechos
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="px-10"
              onClick={() => onNavigate("about")}
            >
              Nuestra Historia
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
