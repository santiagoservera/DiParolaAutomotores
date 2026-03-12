import { useState, useEffect } from "react";
import { X, Phone, MapPin, MessageSquare, ArrowRight } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

import { INFO_CONTACTO } from "@/data";
import { ContactForm } from "./ContactoSection";

export function ContactModal() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem("contact-modal-shown");
    if (!alreadyShown) {
      const timer = setTimeout(() => {
        setOpen(true);
        sessionStorage.setItem("contact-modal-shown", "true");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setMounted(true), 20);
      return () => clearTimeout(t);
    } else {
      setMounted(false);
    }
  }, [open]);

  const handleWhatsApp = () => {
    window.open(`https://wa.me/${INFO_CONTACTO.whatsapp}`, "_blank");
  };

  const stagger = (delay: number) => ({
    transform: mounted ? "translateY(0)" : "translateY(6px)",
    opacity: mounted ? 1 : 0,
    transition: `transform 300ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, opacity 250ms ease ${delay}ms`,
  });

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{
            backgroundColor: "rgba(26, 50, 120, 0.6)",
            transition: "opacity 250ms ease",
            opacity: mounted ? 1 : 0,
          }}
        />

        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[94vw] max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-background border border-border/50 shadow-2xl outline-none"
          style={{
            transform: mounted
              ? "translate(-50%, -50%) scale(1)"
              : "translate(-50%, -48%) scale(0.98)",
            opacity: mounted ? 1 : 0,
            transition:
              "transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 250ms ease",
          }}
        >
          <div className="h-1 w-full rounded-t-3xl bg-gradient-to-r from-[var(--brand-dark)] via-[var(--brand-light)] to-[var(--brand-dark)]" />

          <div className="p-6 sm:p-8">
            <Dialog.Close asChild>
              <button className="absolute top-5 right-5 p-2 rounded-full hover:bg-muted/80 transition-all duration-200 text-muted-foreground hover:text-foreground hover:rotate-90 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>

            <div className="text-center mb-8" style={stagger(40)}>
              <span className="inline-block text-[var(--brand-light)] text-xs font-bold tracking-[0.2em] uppercase mb-3">
                Di Parola Automotores
              </span>
              <Dialog.Title className="text-2xl sm:text-3xl font-bold text-[var(--brand)] leading-tight">
                ¿Buscás tu próximo vehículo?
              </Dialog.Title>
              <Dialog.Description className="text-muted-foreground mt-2">
                Dejanos tus datos y te asesoramos sin compromiso.
              </Dialog.Description>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6" style={stagger(80)}>
              <div className="group p-4 rounded-2xl bg-muted/50 hover:bg-muted transition-colors duration-200 cursor-default">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand)] text-white flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200">
                  <Phone className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-[var(--brand)] mb-1">
                  Teléfonos
                </p>
                {INFO_CONTACTO.telefonos.map((tel, i) => (
                  <p
                    key={i}
                    className="text-xs text-muted-foreground leading-relaxed"
                  >
                    {tel}
                  </p>
                ))}
              </div>

              <div className="group p-4 rounded-2xl bg-muted/50 hover:bg-muted transition-colors duration-200 cursor-default">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand-light)] text-white flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200">
                  <MapPin className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-[var(--brand)] mb-1">
                  Ubicación
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {INFO_CONTACTO.direccion}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {INFO_CONTACTO.horario}
                </p>
              </div>
            </div>

            <div style={stagger(120)}>
              <button
                onClick={handleWhatsApp}
                className="group w-full mb-6 p-4 rounded-2xl bg-green-600 hover:bg-green-500 text-white flex items-center justify-between transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5" />
                  <span className="font-semibold text-sm">
                    Escribinos por WhatsApp
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
              </button>
            </div>

            <div
              className="flex items-center gap-4 mb-6"
              style={{
                opacity: mounted ? 1 : 0,
                transition: "opacity 250ms ease 140ms",
              }}
            >
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium">
                o dejanos tu consulta
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div style={stagger(160)}>
              <ContactForm />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
