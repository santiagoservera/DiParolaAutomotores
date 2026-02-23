import { Button } from "@/components/ui";

import type { NavigationProps } from "@/types";
import HeroImg from "@/assets/Hero.png";
export function HeroSection({ onNavigate }: NavigationProps) {
  return (
    <section className="relative h-[80vh] flex items-center bg-background overflow-hidden">
      {/* Background shape */}
      <div className="absolute right-0 top-0 w-1/2 h-full bg-[#004867]/5 dark:bg-[#00adef]/5 skew-x-[-10deg] translate-x-32 hidden lg:block" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full grid grid-cols-1 lg:grid-cols-2 items-center gap-12 z-10">
        {/* Content */}
        <div className="space-y-8">
          <div className="space-y-4">
            <span className="text-[#00adef] font-bold tracking-widest uppercase text-sm">
              Di Parola Automotores
            </span>
            <h1 className="text-5xl lg:text-7xl font-bold text-[#004867] dark:text-[#4db8db] leading-tight">
              Calidad y confianza en cada unidad
            </h1>
            <p className="text-xl text-muted-foreground max-w-lg leading-relaxed">
              Encuentra tu próximo vehículo en nuestra selección curada de
              usados seleccionados y 0km.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 pt-4">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => onNavigate("stock")}
              className="px-8 py-6 text-lg"
            >
              Ver vehículos disponibles
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => onNavigate("contact")}
              className="px-8 py-6 text-lg border-2"
            >
              Contactar asesor
            </Button>
          </div>
        </div>

        {/* Hero Image */}
        <div className="hidden lg:block relative h-full">
          <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent z-10" />
          <img
            src={HeroImg}
            alt="Hero Image"
            className="w-full h-full object-cover rounded-lg"
          />
        </div>
      </div>
    </section>
  );
}
