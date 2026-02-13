import React from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from './ui';
import { Logo } from './Logo';

interface NavbarProps {
  onNavigate: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-24">
          <div className="flex items-center">
            <button 
              onClick={() => onNavigate('home')}
              className="flex items-center py-2"
            >
              <Logo className="h-20 w-20" />
            </button>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <button onClick={() => onNavigate('home')} className="text-gray-600 hover:text-[#004867] text-sm font-medium">Inicio</button>
            <button onClick={() => onNavigate('stock')} className="text-gray-600 hover:text-[#004867] text-sm font-medium">Vehículos</button>
            <button onClick={() => onNavigate('about')} className="text-gray-600 hover:text-[#004867] text-sm font-medium">Sobre Nosotros</button>
            <button onClick={() => onNavigate('contact')} className="text-gray-600 hover:text-[#004867] text-sm font-medium">Contacto</button>
            <Button variant="secondary" onClick={() => onNavigate('stock')}>Ver vehículos</Button>
          </div>

          <div className="md:hidden flex items-center">
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-600">
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-4">
          <button onClick={() => { onNavigate('home'); setIsOpen(false); }} className="block w-full text-left text-gray-600 py-2">Inicio</button>
          <button onClick={() => { onNavigate('stock'); setIsOpen(false); }} className="block w-full text-left text-gray-600 py-2">Vehículos</button>
          <button onClick={() => { onNavigate('about'); setIsOpen(false); }} className="block w-full text-left text-gray-600 py-2">Sobre Nosotros</button>
          <button onClick={() => { onNavigate('contact'); setIsOpen(false); }} className="block w-full text-left text-gray-600 py-2">Contacto</button>
          <Button variant="secondary" className="w-full" onClick={() => { onNavigate('stock'); setIsOpen(false); }}>Ver vehículos</Button>
        </div>
      )}
    </nav>
  );
};
