import { Button } from "@/components/ui";
import type { NavigationProps } from "@/types";
import HeroImg from "@/assets/Hero.png";

export function HeroSection({ onNavigate }: NavigationProps) {
  return (
    <section className="relative h-[80vh] flex items-center bg-background overflow-hidden">
      <div className="absolute right-0 top-0 w-1/2 h-full bg-[var(--brand)]/5 skew-x-[-10deg] translate-x-32 hidden lg:block" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full grid grid-cols-1 lg:grid-cols-2 items-center gap-12 z-10">
        <div className="space-y-8">
          <div className="space-y-4">
            <span className="text-[var(--brand-light)] font-bold tracking-widest uppercase text-sm">
              Di Parola Automotores
            </span>
            <h1 className="text-5xl lg:text-7xl font-bold text-[var(--brand)] leading-tight">
              Cumplí tu sueño, encontrá tu próximo vehículo
            </h1>
            <p className="text-xl text-muted-foreground max-w-lg leading-relaxed">
              Usados seleccionados y 0km con la garantía y el respaldo de
              quienes entienden de autos.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 pt-4">
            <Button
              size="lg"
              onClick={() => onNavigate("contact")}
              className="px-8 py-6 text-lg cursor-pointer"
            >
              Contactar asesor
            </Button>
          </div>
        </div>

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
