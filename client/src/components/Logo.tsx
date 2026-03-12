import React from "react";
import logoAzul from "../assets/LogoAzul.png";
import logoBlanco from "../assets/LogoBlanco.png";

interface LogoProps {
  className?: string;
  src?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = "h-16 w-16",
  src = false,
}) => {
  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center ${className}`}
    >
      {/* Logo azul para light mode */}
      <img
        src={src ? logoAzul : logoAzul}
        alt="Di Parola Automotores"
        className="w-full h-full block dark:hidden"
      />
      {/* Logo blanco para dark mode */}
      <img
        src={logoBlanco}
        alt="Di Parola Automotores"
        className="w-full h-full hidden dark:block"
      />
    </div>
  );
};
