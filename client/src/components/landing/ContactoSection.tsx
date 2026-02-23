import { Phone, MapPin, MessageSquare } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { INFO_CONTACTO } from "@/data";

export function ContactoSection() {
  const handleWhatsApp = () => {
    window.open(`https://wa.me/${INFO_CONTACTO.whatsapp}`, "_blank");
  };

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-border pt-32">
      {/* Header */}
      <div className="text-center space-y-4 mb-16">
        <h2 className="text-4xl font-bold text-[#004867] dark:text-[#4db8db]">
          Contactanos hoy mismo
        </h2>
        <p className="text-muted-foreground text-lg">
          Estamos para asesorarte en tu próxima inversión.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
        {/* Info de contacto */}
        <div className="space-y-10">
          <ContactoItem icon={Phone} iconBg="bg-[#004867]" title="Teléfonos">
            {INFO_CONTACTO.telefonos.map((tel, i) => (
              <p className="text-muted-foreground">{tel}</p>
            ))}
          </ContactoItem>

          <ContactoItem icon={MapPin} iconBg="bg-[#00adef]" title="Ubicación">
            <p className="text-muted-foreground">{INFO_CONTACTO.direccion}</p>
            <p className="text-muted-foreground">{INFO_CONTACTO.horario}</p>
          </ContactoItem>

          <div className="pt-6">
            <Button
              variant="secondary"
              size="lg"
              className="w-full py-6 flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700"
              onClick={handleWhatsApp}
            >
              <MessageSquare className="w-6 h-6" />
              Escribinos por WhatsApp
            </Button>
          </div>
        </div>

        {/* Formulario */}
        <ContactForm />
      </div>
    </section>
  );
}

interface ContactoItemProps {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  title: string;
  children: React.ReactNode;
}

function ContactoItem({
  icon: Icon,
  iconBg,
  title,
  children,
}: ContactoItemProps) {
  return (
    <div className="flex gap-6">
      <div
        className={`w-14 h-14 ${iconBg} text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h4 className="font-bold text-[#004867] dark:text-[#4db8db] text-lg">{title}</h4>
        {children}
      </div>
    </div>
  );
}

function ContactForm() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implementar envío del formulario
    console.log("Formulario enviado");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 bg-card p-8 rounded-2xl border border-border shadow-xl shadow-black/5"
    >
      <div className="space-y-2">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Nombre completo
        </label>
        <Input
          placeholder="Tu nombre"
          className="bg-muted border-none h-12"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Correo electrónico
        </label>
        <Input
          type="email"
          placeholder="email@ejemplo.com"
          className="bg-muted border-none h-12"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Mensaje
        </label>
        <textarea
          className="w-full p-4 bg-muted border-none rounded-md focus:ring-2 focus:ring-[#00adef] outline-none h-32 resize-none text-foreground"
          placeholder="¿En qué podemos ayudarte?"
          required
        />
      </div>

      <Button type="submit" className="w-full h-12">
        Enviar consulta
      </Button>
    </form>
  );
}
