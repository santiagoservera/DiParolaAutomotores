import { ChevronRight } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { INFO_CONTACTO, VEHICULOS_DESTACADOS } from "@/data";
import type { NavigationProps } from "@/types";

export function VehiculosDestacados({ onNavigate }: NavigationProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center space-y-4 mb-16">
        <h2 className="text-4xl font-bold text-[#004867] dark:text-[#4db8db]">
          Vehículos destacados
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
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
  const handleConsultar = () => {
    const mensaje = encodeURIComponent(
      `¡Hola! Te escribo por el ${vehiculo.nombre} ${vehiculo.year} que vi en el sitio web. ¿Me podés dar más información?`,
    );
    window.open(
      `https://wa.me/${INFO_CONTACTO.whatsapp}?text=${mensaje}`,
      "_blank",
    );
  };

  return (
    <Card className="group border-none shadow-none transition-colors p-2 cursor-pointer">
      <div className="aspect-[16/10] overflow-hidden rounded-lg mb-6">
        <ImageWithFallback
          src={vehiculo.img}
          alt={vehiculo.nombre}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      <div className="space-y-4 px-2 pb-4">
        <div className="space-y-1">
          <h3 className="font-bold text-[#004867] dark:text-[#4db8db] text-xl tracking-tight">
            {vehiculo.nombre}
          </h3>
          <p className="text-sm text-muted-foreground font-medium">
            Año {vehiculo.year}
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full hover:bg-[#004867] transition-all border-border cursor-pointer"
          onClick={handleConsultar}
        >
          Consultar
        </Button>
      </div>
    </Card>
  );
}
