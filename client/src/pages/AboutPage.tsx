import HeroImg from "@/assets/Hero.png";

export function AboutPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 space-y-32">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        {/* Content */}
        <div className="space-y-10">
          <h1 className="text-6xl font-bold text-[#004867] leading-tight">
            Pasión por lo que hacemos
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            Di Parola Automotores no es solo una concesionaria; es el resultado
            de años de dedicación al rubro automotriz. Entendemos que un auto es
            mucho más que un medio de transporte; es una herramienta de trabajo,
            un sueño familiar o una meta cumplida.
          </p>

          <div className="space-y-6">
            <FeatureItem number="01" title="Calidad Garantizada">
              Cada unidad ingresada pasa por un riguroso control mecánico y
              estético.
            </FeatureItem>

            <FeatureItem number="02" title="Trámites Ágiles">
              Nos encargamos de toda la gestión administrativa para que solo
              disfrutes.
            </FeatureItem>

            <FeatureItem number="03" title="Financiación Flexible">
              Ofrecemos múltiples opciones de pago adaptadas a tu situación.
            </FeatureItem>
          </div>
        </div>

        {/* Image */}
        <div className="relative">
          <div className="absolute -inset-4 border-2 border-[#004867]/10 rounded-3xl translate-x-8 translate-y-8" />
          <img
            src={HeroImg}
            alt="About"
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
      <div className="w-8 h-8 rounded-full bg-[#00adef] flex items-center justify-center text-white text-xs font-bold shrink-0">
        {number}
      </div>
      <div>
        <h4 className="font-bold text-[#004867] text-lg">{title}</h4>
        <p className="text-gray-500">{children}</p>
      </div>
    </div>
  );
}
