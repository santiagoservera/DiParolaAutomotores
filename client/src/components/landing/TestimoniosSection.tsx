import { Star, Quote } from "lucide-react";
import { TESTIMONIOS } from "@/data";
import type { Testimonio } from "@/types";

export function TestimoniosSection() {
  const testimoniosConFoto = TESTIMONIOS.filter((t) => t.imagen);
  const testimoniosSinFoto = TESTIMONIOS.filter((t) => !t.imagen);

  return (
    <section className="py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <span className="text-[#00adef] font-bold tracking-widest uppercase text-sm">
            Clientes Satisfechos
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-[#004867]">
            Historias de éxito
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto text-lg">
            Conocé a quienes ya encontraron su vehículo ideal con nosotros
          </p>
        </div>

        {/* Testimonios con fotos grandes */}
        <div className="space-y-20">
          {testimoniosConFoto.map((testimonio, index) => (
            <TestimonioDestacado
              key={testimonio.id}
              testimonio={testimonio}
              invertido={index % 2 !== 0}
            />
          ))}
        </div>

        {/* Testimonios adicionales sin foto */}
        {testimoniosSinFoto.length > 0 && (
          <div className="mt-20">
            <h3 className="text-2xl font-bold text-[#004867] text-center mb-10">
              Más opiniones
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
              {testimoniosSinFoto.map((testimonio) => (
                <TestimonioCard key={testimonio.id} testimonio={testimonio} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

interface TestimonioDestacadoProps {
  testimonio: Testimonio;
  invertido?: boolean;
}

function TestimonioDestacado({
  testimonio,
  invertido = false,
}: TestimonioDestacadoProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
      {/* Imagen grande */}
      <div className={`relative ${invertido ? "lg:order-2" : "lg:order-1"}`}>
        <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl">
          <img
            src={testimonio.imagen}
            alt={`${testimonio.nombre} con su ${testimonio.vehiculo}`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

          {/* Badge del vehículo */}
          <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-sm px-5 py-2.5 rounded-full shadow-lg">
            <span className="text-[#004867] font-bold text-lg">
              {testimonio.vehiculo}
            </span>
          </div>
        </div>

        {/* Decoración */}
        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-[#00adef]/10 rounded-full -z-10" />
        <div className="absolute -top-6 -left-6 w-20 h-20 bg-[#004867]/10 rounded-full -z-10" />
      </div>

      {/* Contenido */}
      <div
        className={`space-y-6 ${invertido ? "lg:order-1 lg:text-right" : "lg:order-2"}`}
      >
        <div className={`${invertido ? "lg:ml-auto" : ""} w-fit`}>
          <div className="w-16 h-16 bg-[#00adef] rounded-2xl flex items-center justify-center shadow-lg shadow-[#00adef]/30">
            <Quote className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className={`flex gap-1 ${invertido ? "lg:justify-end" : ""}`}>
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-6 h-6 ${
                i < testimonio.rating
                  ? "fill-[#00adef] text-[#00adef]"
                  : "text-gray-200"
              }`}
            />
          ))}
        </div>

        <blockquote className="text-xl lg:text-2xl text-gray-700 leading-relaxed font-medium">
          "{testimonio.texto}"
        </blockquote>

        <div
          className={`flex items-center gap-4 pt-4 ${invertido ? "lg:flex-row-reverse" : ""}`}
        >
          <div className="w-1.5 h-14 bg-gradient-to-b from-[#004867] to-[#00adef] rounded-full" />
          <div className={invertido ? "lg:text-right" : ""}>
            <div className="text-2xl font-bold text-[#004867]">
              {testimonio.nombre}
            </div>
            <div className="text-[#00adef] font-medium text-lg">
              Feliz propietario de {testimonio.vehiculo}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TestimonioCardProps {
  testimonio: Testimonio;
}

function TestimonioCard({ testimonio }: TestimonioCardProps) {
  return (
    <div className="group relative bg-white rounded-2xl p-8 shadow-lg shadow-gray-200/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 max-w-md w-full">
      <div className="absolute -top-4 left-8">
        <div className="w-10 h-10 bg-[#00adef] rounded-full flex items-center justify-center shadow-lg shadow-[#00adef]/30">
          <Quote className="w-5 h-5 text-white" />
        </div>
      </div>

      <div className="pt-4 space-y-6">
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-4 h-4 ${
                i < testimonio.rating
                  ? "fill-[#00adef] text-[#00adef]"
                  : "text-gray-200"
              }`}
            />
          ))}
        </div>

        <p className="text-gray-600 leading-relaxed text-lg">
          "{testimonio.texto}"
        </p>

        <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#004867] to-[#00adef] flex items-center justify-center text-white font-bold text-xl shadow-lg">
            {testimonio.nombre.charAt(0)}
          </div>
          <div>
            <div className="font-bold text-[#004867] text-lg">
              {testimonio.nombre}
            </div>
            {testimonio.vehiculo && (
              <div className="text-[#00adef] font-medium">
                {testimonio.vehiculo}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
