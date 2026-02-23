import { MessageSquare } from 'lucide-react';
import { INFO_CONTACTO } from '@/data';

export function WhatsAppButton() {
  return (
    <a
      href={`https://wa.me/${INFO_CONTACTO.whatsapp}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-8 right-8 w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-green-600 transition-all hover:scale-110 z-[100] group"
      aria-label="Contactar por WhatsApp"
    >
      <MessageSquare className="w-8 h-8" />
      <span className="absolute right-full mr-4 bg-card text-foreground px-4 py-2 rounded-lg text-sm font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        ¿En qué podemos ayudarte?
      </span>
    </a>
  );
}
