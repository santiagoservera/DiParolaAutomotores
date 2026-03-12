import {
  HeroSection,
  AboutSection,
  TestimoniosSection,
  ContactoSection,
} from "@/components/landing";
import { ContactModal } from "@/components/landing/ContactModal";
import type { NavigationProps } from "@/types";

export function HomePage({ onNavigate }: NavigationProps) {
  return (
    <div className="space-y-32 pb-24">
      <ContactModal />
      <HeroSection onNavigate={onNavigate} />
      <TestimoniosSection />
      {/* <VehiculosDestacados onNavigate={onNavigate} /> */}
      <AboutSection onNavigate={onNavigate} />
      <ContactoSection />
    </div>
  );
}
