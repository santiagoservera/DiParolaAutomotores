import { useCallback, useEffect, useState } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { TESTIMONIOS } from "@/data";
import type { Testimonio } from "@/types";

export function TestimoniosSection() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    slidesToScroll: 1,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    setScrollSnaps(emblaApi.scrollSnapList());
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  return (
    <section className="py-20 bg-gradient-to-b from-background to-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header + flechas */}
        <div className="flex items-end justify-between mb-10">
          <div className="space-y-2">
            <span className="text-[var(--brand-light)] font-bold tracking-widest uppercase text-xs">
              Clientes Satisfechos
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold text-[var(--brand)]">
              Historias de éxito
            </h2>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={scrollPrev}
              className="w-10 h-10 rounded-full border border-border bg-background hover:bg-muted flex items-center justify-center text-[var(--brand)] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={scrollNext}
              className="w-10 h-10 rounded-full border border-border bg-background hover:bg-muted flex items-center justify-center text-[var(--brand)] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Carousel */}
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex -ml-4">
            {TESTIMONIOS.map((testimonio) => (
              <div
                key={testimonio.id}
                className="flex-[0_0_85%] sm:flex-[0_0_45%] lg:flex-[0_0_33.333%] min-w-0 pl-4"
              >
                <TestimonioCard testimonio={testimonio} />
              </div>
            ))}
          </div>
        </div>

        {/* Dots + flechas mobile */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={scrollPrev}
            className="sm:hidden w-9 h-9 rounded-full border border-border bg-background flex items-center justify-center text-[var(--brand)] cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex gap-1.5">
            {scrollSnaps.map((_, index) => (
              <button
                key={index}
                onClick={() => emblaApi?.scrollTo(index)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  index === selectedIndex
                    ? "w-6 bg-[var(--brand)]"
                    : "w-1.5 bg-[var(--brand)]/20 hover:bg-[var(--brand)]/40"
                }`}
              />
            ))}
          </div>

          <button
            onClick={scrollNext}
            className="sm:hidden w-9 h-9 rounded-full border border-border bg-background flex items-center justify-center text-[var(--brand)] cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

function TestimonioCard({ testimonio }: { testimonio: Testimonio }) {
  return (
    <div className="group bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden h-full flex flex-col">
      {/* Imagen compacta */}
      {testimonio.imagen ? (
        <div className="relative h-44 overflow-hidden">
          <img
            src={testimonio.imagen}
            alt={`${testimonio.nombre} con su ${testimonio.vehiculo}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          {testimonio.vehiculo && (
            <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-card/90 px-3 py-1 rounded-full">
              <span className="text-[var(--brand)] font-bold text-xs">
                {testimonio.vehiculo}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="h-20 bg-gradient-to-r from-[var(--brand)] to-[var(--brand-light)] flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white text-lg font-bold">
            {testimonio.nombre.charAt(0)}
          </div>
        </div>
      )}

      {/* Contenido */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex gap-0.5 mb-3">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-3.5 h-3.5 ${
                i < testimonio.rating
                  ? "fill-[var(--brand-light)] text-[var(--brand-light)]"
                  : "text-gray-200 dark:text-gray-600"
              }`}
            />
          ))}
        </div>

        <blockquote className="text-sm leading-relaxed text-foreground/80 flex-1 line-clamp-4">
          "{testimonio.texto}"
        </blockquote>

        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border">
          <div className="w-8 h-8 rounded-full bg-[var(--brand)]/10 flex items-center justify-center text-[var(--brand)] text-xs font-bold shrink-0">
            {testimonio.nombre.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--brand)] truncate">
              {testimonio.nombre}
            </div>
            {testimonio.vehiculo && (
              <div className="text-[var(--brand-light)] text-xs truncate">
                {testimonio.vehiculo}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
