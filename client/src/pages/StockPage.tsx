import { Search, Filter } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { VEHICULOS_DESTACADOS } from "@/data";

export function StockPage() {
  // Duplicamos para mostrar más items en la demo
  const vehiculos = [...VEHICULOS_DESTACADOS, ...VEHICULOS_DESTACADOS];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-16">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-5xl font-bold text-[#004867] dark:text-[#4db8db]">
          Vehículos Disponibles
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Explora nuestra colección completa. Todas las unidades cuentan con
          documentación al día y garantía de procedencia.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-6 items-center justify-between border-b border-border pb-10">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar por marca o modelo..."
            className="pl-12 h-14 bg-muted border-none rounded-xl"
          />
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <Button
            variant="outline"
            className="flex-1 md:flex-none h-14 rounded-xl px-8 gap-2"
          >
            <Filter className="w-5 h-5" />
            Filtrar unidades
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">
        {vehiculos.map((vehiculo, i) => (
          <Card
            key={`${vehiculo.id}-${i}`}
            className="group border-none shadow-none hover:bg-muted transition-all p-3 rounded-2xl"
          >
            <div className="aspect-[16/10] overflow-hidden rounded-xl mb-6 shadow-sm">
              <ImageWithFallback
                src={vehiculo.img}
                alt={vehiculo.nombre}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            </div>
            <div className="space-y-4 px-2 pb-2">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00adef]">
                  {vehiculo.categoria}
                </span>
                <h3 className="font-bold text-[#004867] dark:text-[#4db8db] text-lg leading-tight">
                  {vehiculo.nombre}
                </h3>
                <p className="text-sm text-muted-foreground font-medium">
                  Año {vehiculo.year} • {vehiculo.km}
                </p>
              </div>
              <Button
                variant="primary"
                className="w-full h-11 text-[#004867] dark:text-[#4db8db] border border-[#004867] dark:border-[#4db8db] hover:bg-background hover:text-[#004867] dark:hover:text-[#4db8db] transition-all cursor-pointer"
              >
                Consultar Ahora
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
