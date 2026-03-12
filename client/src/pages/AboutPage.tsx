import HeroImg from "@/assets/Hero.png";

export function AboutPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 space-y-32">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        {/* Content */}
        <div className="space-y-10">
          <h1 className="text-4xl font-bold text-[var(--brand)] leading-tight">
            Un equipo con experiencia, un proyecto con alma
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Di Parola Automotores nació en San Juan con una idea clara: que
            comprar un auto no tiene por qué ser una experiencia estresante.
            Somos un equipo joven pero con años recorriendo el rubro automotor,
            y eso nos da la confianza para elegir las mejores unidades y
            asesorarte de verdad.
          </p>

          <p className="text-lg text-muted-foreground leading-relaxed">
            Sabemos lo que significa ahorrar para un auto, buscar el modelo
            justo, desconfiar de lo que te ofrecen. Por eso acá cada vehículo
            pasa por nuestras manos antes de llegar a las tuyas. Sin letras
            chicas, sin sorpresas.
          </p>

          <div className="space-y-6">
            <FeatureItem number="01" title="Revisión real, no de papel">
              Cada unidad se inspecciona mecánica y estéticamente antes de
              publicarse. Si algo no nos convence, no la ofrecemos.
            </FeatureItem>

            <FeatureItem number="02" title="Trámites sin vueltas">
              Nos encargamos de transferencias, verificaciones y toda la gestión
              para que vos solo te preocupes por elegir.
            </FeatureItem>

            <FeatureItem number="03" title="Te escuchamos de verdad">
              No te vamos a empujar un auto que no necesitás. Nos tomamos el
              tiempo de entender qué buscás y te asesoramos en serio.
            </FeatureItem>
          </div>
        </div>

        {/* Image */}
        <div className="relative">
          <div className="absolute -inset-4 border-2 border-[var(--brand)]/10 rounded-3xl translate-x-8 translate-y-8" />
          <img
            src={HeroImg}
            alt="Di Parola Automotores"
            className="relative w-full h-[600px] object-cover rounded-3xl shadow-2xl"
          />
        </div>
      </div>
    </div>
  );
}

interface FeatureItemProps {
  number: string;
  title: string;
  children: React.ReactNode;
}

function FeatureItem({ number, title, children }: FeatureItemProps) {
  return (
    <div className="flex gap-6 items-start">
      <div className="w-8 h-8 rounded-full bg-[var(--brand-light)] flex items-center justify-center text-white text-xs font-bold shrink-0">
        {number}
      </div>
      <div>
        <h4 className="font-bold text-[var(--brand)] text-lg">{title}</h4>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
