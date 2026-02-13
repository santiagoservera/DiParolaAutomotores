import React from "react";
import logoAsset from "../assets/LogoPng.png";
import logo from "../assets/Logo.jpeg";

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
      <img
        src={src ? logo : logoAsset}
        alt="Di Parola Automotores"
        className="w-full h-full "
      />
    </div>
  );
};
