"use client";

import { motion } from "framer-motion";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { icon: 24, text: "text-lg" },
  md: { icon: 32, text: "text-xl" },
  lg: { icon: 40, text: "text-2xl" },
  xl: { icon: 56, text: "text-4xl" },
};

export function Logo({ size = "md", showText = true, className = "" }: LogoProps) {
  const { icon, text } = sizes[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <motion.div
        whileHover={{ rotate: 12, scale: 1.05 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <svg
          width={icon}
          height={icon}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer circle - forge dark */}
          <circle
            cx="24"
            cy="24"
            r="22"
            fill="#1A1A1A"
            stroke="#FF6B35"
            strokeWidth="2.5"
          />
          {/* Inner ring */}
          <circle
            cx="24"
            cy="24"
            r="17"
            fill="none"
            stroke="#2A2A2A"
            strokeWidth="1.5"
          />
          {/* D letter - bold, modern */}
          <path
            d="M18 14h6c5.5 0 10 4.5 10 10s-4.5 10-10 10h-6V14zm4 4v12h2c3.3 0 6-2.7 6-6s-2.7-6-6-6h-2z"
            fill="#FF6B35"
          />
          {/* Spark */}
          <path
            d="M35 10l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"
            fill="#FF9F6B"
            opacity="0.9"
          />
          </svg>
      </motion.div>
      {showText && (
        <span className={`font-black tracking-tight ${text} accent-shimmer`}>
          DareStake
        </span>
      )}
    </div>
  );
}
