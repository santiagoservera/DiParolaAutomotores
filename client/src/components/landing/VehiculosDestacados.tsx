import { ChevronRight } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { VEHICULOS_DESTACADOS } from "@/data";
import type { NavigationProps } from "@/types";

export function VehiculosDestacados({ onNavigate }: NavigationProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center space-y-4 mb-16">
        <h2 className="text-4xl font-bold text-[#004867]">
          Vehículos destacados
        </h2>
        <p className="text-gray-500 max-w-2xl mx-auto text-lg">
          Contamos con un stock rotativo de unidades garantizadas.
        </p>
      </div>

      {/* Grid de vehículos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        {VEHICULOS_DESTACADOS.map((vehiculo) => (
          <VehiculoCard key={vehiculo.id} vehiculo={vehiculo} />
        ))}
      </div>

      {/* CTA */}
      <div className="text-center mt-16">
        <Button
          variant="ghost"
          className="text-[#00adef] font-bold flex items-center gap-2 mx-auto"
          onClick={() => onNavigate("stock")}
        >
          Explorar todo el stock <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </section>
  );
}

interface VehiculoCardProps {
  vehiculo: (typeof VEHICULOS_DESTACADOS)[0];
}

function VehiculoCard({ vehiculo }: VehiculoCardProps) {
  return (
    <Card className="group border-none shadow-none  transition-colors p-2 cursor-pointer">
      <div className="aspect-[16/10] overflow-hidden rounded-lg mb-6">
        <ImageWithFallback
          src={vehiculo.img}
          alt={vehiculo.nombre}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      <div className="space-y-4 px-2 pb-4">
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00adef]">
            {vehiculo.categoria}
          </span>
          <h3 className="font-bold text-[#004867] text-xl tracking-tight">
            {vehiculo.nombre}
          </h3>
          <p className="text-sm text-gray-400 font-medium">
            Año {vehiculo.year} • {vehiculo.km}
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full hover:bg-[#004867] transition-all border-gray-200 cursor-pointer"
        >
          Ver detalles
        </Button>
      </div>
    </Card>
  );
}
