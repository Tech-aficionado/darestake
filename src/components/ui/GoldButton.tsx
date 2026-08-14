"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ReactNode, useState, useCallback } from "react";

interface GoldButtonProps {
  children: ReactNode;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  distance: number;
  size: number;
}

export function GoldButton({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  disabled,
  onClick,
  type = "button",
}: GoldButtonProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  const sizeClasses = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  const variantClasses = {
    primary:
      "bg-[#FF6B35] text-black font-bold shadow-lg shadow-[rgba(255,107,53,0.25)]",
    outline:
      "border border-[#FF6B35]/50 text-[#FF6B35] hover:border-[#FF6B35] hover:bg-[#FF6B35]/5",
    ghost: "text-[#FF6B35] hover:bg-[#FF6B35]/10",
  };

  const handleClick = useCallback(() => {
    if (disabled || loading) return;

    const newParticles: Particle[] = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      x: 0,
      y: 0,
      angle: (i * 30) + (Math.random() * 20 - 10),
      distance: 30 + Math.random() * 40,
      size: 3 + Math.random() * 4,
    }));

    setParticles(newParticles);
    setTimeout(() => setParticles([]), 600);

    onClick?.();
  }, [disabled, loading, onClick]);

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={
        disabled
          ? {}
          : {
              scale: 0.94,
              transition: {
                type: "spring",
                stiffness: 600,
                damping: 15,
              },
            }
      }
      type={type}
      onClick={handleClick}
      disabled={disabled || loading}
      className={`
        relative rounded-xl font-semibold transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed overflow-visible
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {/* Content */}
      <span className="relative z-10">
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"
            />
            Loading...
          </span>
        ) : (
          children
        )}
      </span>

      {/* Particle burst effect */}
      <AnimatePresence>
        {particles.map((p) => {
          const rad = (p.angle * Math.PI) / 180;
          const tx = Math.cos(rad) * p.distance;
          const ty = Math.sin(rad) * p.distance;

          return (
            <motion.span
              key={p.id}
              className="absolute top-1/2 left-1/2 rounded-full pointer-events-none"
              style={{
                width: p.size,
                height: p.size,
                background: `radial-gradient(circle, #FF9F6B, #FF6B35)`,
                boxShadow: "0 0 4px rgba(255,107,53,0.8)",
              }}
              initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
              animate={{
                x: tx,
                y: ty,
                scale: 0,
                opacity: 0,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          );
        })}
      </AnimatePresence>

      {/* Outline variant hover glow */}
      {variant === "outline" && !disabled && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          style={{
            boxShadow: "inset 0 0 20px rgba(255,107,53,0.1), 0 0 15px rgba(255,107,53,0.1)",
          }}
        />
      )}
    </motion.button>
  );
}
