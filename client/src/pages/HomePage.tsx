import {
  HeroSection,
  VehiculosDestacados,
  AboutSection,
  TestimoniosSection,
  ContactoSection,
} from '@/components/landing';
import type { NavigationProps } from '@/types';

export function HomePage({ onNavigate }: NavigationProps) {
  return (
    <div className="space-y-32 pb-24">
      <HeroSection onNavigate={onNavigate} />
      <VehiculosDestacados onNavigate={onNavigate} />
      <AboutSection onNavigate={onNavigate} />
      <TestimoniosSection />
      <ContactoSection />
    </div>
  );
}
