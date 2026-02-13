import { Mail, Phone } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { INFO_CONTACTO } from '@/data';

export function ContactPage() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Formulario enviado');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
      <div className="bg-[#004867] rounded-[40px] overflow-hidden shadow-2xl flex flex-col lg:flex-row">
        {/* Info */}
        <div className="p-16 lg:w-1/2 space-y-10 text-white">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold">Hablemos</h1>
            <p className="text-gray-300 text-lg">
              ¿Tenés dudas sobre una unidad o querés tasar tu vehículo? Envianos
              un mensaje y te responderemos a la brevedad.
            </p>
          </div>

          <div className="space-y-8">
            <ContactInfo
              icon={Mail}
              label="Email"
              value={INFO_CONTACTO.email}
            />
            <ContactInfo
              icon={Phone}
              label="Atención Directa"
              value={INFO_CONTACTO.telefonos[0]}
            />
          </div>

          <div className="pt-10 border-t border-white/10">
            <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
              Seguinos
            </div>
            <div className="flex gap-6">
              <a
                href={INFO_CONTACTO.redes.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xl font-bold hover:text-[#00adef] cursor-pointer transition-colors"
              >
                Instagram
              </a>
              <a
                href={INFO_CONTACTO.redes.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xl font-bold hover:text-[#00adef] cursor-pointer transition-colors"
              >
                Facebook
              </a>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white p-16 lg:w-1/2">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Nombre
                </label>
                <Input
                  placeholder="Tu nombre"
                  className="border-b border-gray-200 rounded-none px-0 focus:ring-0 focus:border-[#00adef] bg-transparent"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="email@ejemplo.com"
                  className="border-b border-gray-200 rounded-none px-0 focus:ring-0 focus:border-[#00adef] bg-transparent"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Mensaje
              </label>
              <textarea
                className="w-full p-0 py-4 border-b border-gray-200 rounded-none focus:ring-0 focus:border-[#00adef] outline-none bg-transparent min-h-[120px] resize-none"
                placeholder="Escribí tu consulta aquí..."
                required
              />
            </div>

            <Button type="submit" className="w-full h-14 text-lg">
              Enviar mensaje
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

interface ContactInfoProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

function ContactInfo({ icon: Icon, label, value }: ContactInfoProps) {
  return (
    <div className="flex gap-6 items-center">
      <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
        <Icon className="w-6 h-6 text-[#00adef]" />
      </div>
      <div>
        <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">
          {label}
        </div>
        <div className="text-lg">{value}</div>
      </div>
    </div>
  );
}
