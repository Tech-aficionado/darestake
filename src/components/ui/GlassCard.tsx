"use client";

import { memo } from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

export const GlassCard = memo(function GlassCard({
  children,
  className = "",
  glow = false,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.985 }}
      className={`
        relative rounded-2xl overflow-hidden
        bg-[#1A1A1A] border-l-[3px] border-l-[#FF6B35] border border-[#2A2A2A]
        ${className}
      `}
      {...props}
    >
      {/* Glow effect */}
      {glow && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{
            boxShadow: [
              "0 0 8px rgba(255,107,53,0.1), inset 0 0 8px rgba(255,107,53,0.03)",
              "0 0 18px rgba(255,107,53,0.18), inset 0 0 14px rgba(255,107,53,0.05)",
              "0 0 8px rgba(255,107,53,0.1), inset 0 0 8px rgba(255,107,53,0.03)",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
});
