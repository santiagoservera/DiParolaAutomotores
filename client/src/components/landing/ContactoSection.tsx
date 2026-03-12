import { useState } from "react";
import {
  Phone,
  MapPin,
  MessageSquare,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import { INFO_CONTACTO } from "@/data";

const FORMSPREE_ID = "meerjkry";

export function ContactoSection() {
  const handleWhatsApp = () => {
    window.open(`https://wa.me/${INFO_CONTACTO.whatsapp}`, "_blank");
  };
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-border pt-32">
      <div className="text-center space-y-4 mb-16">
        <h2 className="text-4xl font-bold text-[var(--brand)]">
          Contactanos hoy mismo
        </h2>
        <p className="text-muted-foreground text-lg">
          Estamos para asesorarte en tu próxima inversión.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
        <div className="space-y-10">
          <ContactoItem
            icon={Phone}
            iconBg="bg-[var(--brand)]"
            title="Teléfonos"
          >
            {INFO_CONTACTO.telefonos.map((tel) => (
              <p className="text-muted-foreground">{tel}</p>
            ))}
          </ContactoItem>
          <ContactoItem
            icon={MapPin}
            iconBg="bg-[var(--brand-light)]"
            title="Ubicación"
          >
            <p className="text-muted-foreground">{INFO_CONTACTO.direccion}</p>
            <p className="text-muted-foreground">{INFO_CONTACTO.horario}</p>
          </ContactoItem>

          <div className="rounded-lg overflow-hidden border">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3400.9194469376134!2d-68.5230674206543!3d-31.526372299999995!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x96816a809e389411%3A0xc826a5d8bce4e1e1!2sChile%20Este%20445%2C%20J5400AXI%20San%20Juan!5e0!3m2!1ses!2sar!4v1772800643143!5m2!1ses!2sar"
              width="600"
              height="250"
              loading="lazy"
            ></iframe>
          </div>
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
        <h4 className="font-bold text-[var(--brand)] text-lg">{title}</h4>
        {children}
      </div>
    </div>
  );
}

type FormStatus = "idle" | "sending" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<FormStatus>("idle");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("sending");

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const response = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: "POST",
        body: data,
        headers: {
          Accept: "application/json",
        },
      });

      if (response.ok) {
        setStatus("success");
        form.reset();
        setTimeout(() => setStatus("idle"), 5000);
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 5000);
      }
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 5000);
    }
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
          name="nombre"
          placeholder="Tu nombre"
          className="bg-muted border-none h-12"
          required
          disabled={status === "sending"}
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Correo electrónico
        </label>
        <Input
          type="email"
          name="email"
          placeholder="email@ejemplo.com"
          className="bg-muted border-none h-12"
          required
          disabled={status === "sending"}
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Mensaje
        </label>
        <textarea
          name="mensaje"
          className="w-full p-4 bg-muted border-none rounded-md focus:ring-2 focus:ring-[var(--brand-light)] outline-none h-32 resize-none text-foreground"
          placeholder="¿En qué podemos ayudarte?"
          required
          disabled={status === "sending"}
        />
      </div>

      {status === "success" && (
        <div className="flex items-center gap-3 text-green-600 bg-green-50 dark:bg-green-950/30 rounded-xl p-4">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">
            ¡Mensaje enviado! Te responderemos a la brevedad.
          </span>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-3 text-red-600 bg-red-50 dark:bg-red-950/30 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">
            Hubo un error al enviar. Por favor intentá de nuevo.
          </span>
        </div>
      )}

      <Button
        type="submit"
        className="w-full h-12"
        disabled={status === "sending"}
      >
        {status === "sending" ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Enviando...
          </span>
        ) : (
          "Enviar consulta"
        )}
      </Button>
    </form>
  );
}
