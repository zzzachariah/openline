"use client";

import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

const variantClass: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className = "", children, ...rest },
  ref
) {
  return (
    <button ref={ref} className={`${variantClass[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
});

export default Button;
