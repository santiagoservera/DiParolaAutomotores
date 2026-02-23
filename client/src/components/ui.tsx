import React from "react";
import type { LucideIcon } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: LucideIcon;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  className = "",
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:pointer-events-none";

  const variants = {
    primary: "bg-[#004867] dark:bg-[#00adef] text-white hover:bg-[#003850] dark:hover:bg-[#009cd6] focus:ring-[#004867]",
    secondary:
      "bg-[#00adef] text-white hover:bg-[#009cd6] focus:ring-[#00adef]",
    outline:
      "border border-border bg-transparent hover:bg-muted text-foreground",
    ghost: "bg-transparent hover:bg-muted text-foreground",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon className={`w-4 h-4 ${children ? "mr-2" : ""}`} />}
      {children}
    </button>
  );
};

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => (
  <div
    className={`bg-card border border-border rounded-lg overflow-hidden shadow-sm ${className}`}
  >
    {children}
  </div>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (
  props,
) => (
  <input
    {...props}
    className={`w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#00a8e8] focus:border-transparent ${props.className || ""}`}
  />
);
