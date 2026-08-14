"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface StreakBadgeProps {
  streak: number;
  className?: string;
}

interface FireParticle {
  id: number;
  x: number;
  delay: number;
  size: number;
  duration: number;
}

function FireParticles({ intensity }: { intensity: number }) {
  const [particles, setParticles] = useState<FireParticle[]>([]);

  useEffect(() => {
    const count = Math.min(intensity, 8);
    const newParticles: FireParticle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 24,
      delay: Math.random() * 1.5,
      size: 2 + Math.random() * 3,
      duration: 1 + Math.random() * 0.8,
    }));
    setParticles(newParticles);
  }, [intensity]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute bottom-1/2 left-1/2 rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle, #FF9F6B, #FF6B35)`,
            boxShadow: "0 0 3px rgba(255,107,53,0.6)",
            x: p.x,
          }}
          animate={{
            y: [-4, -20 - Math.random() * 12],
            opacity: [0, 0.9, 0],
            scale: [0.5, 1, 0.3],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

export function StreakBadge({ streak, className = "" }: StreakBadgeProps) {
  const prevStreak = useRef(streak);
  const [justIncreased, setJustIncreased] = useState(false);

  useEffect(() => {
    if (streak > prevStreak.current) {
      setJustIncreased(true);
      const timer = setTimeout(() => setJustIncreased(false), 1000);
      return () => clearTimeout(timer);
    }
    prevStreak.current = streak;
  }, [streak]);

  const getStreakTier = (s: number) => {
    if (s >= 30)
      return {
        label: "Legendary",
        color: "from-[#DC2626] to-[#991B1B]",
        glowColor: "rgba(220,38,38,0.5)",
        glowIntensity: 1,
      };
    if (s >= 14)
      return {
        label: "On Fire",
        color: "from-[#FF6B35] to-[#DC2626]",
        glowColor: "rgba(255,107,53,0.4)",
        glowIntensity: 0.8,
      };
    if (s >= 7)
      return {
        label: "Hot",
        color: "from-[#FF6B35] to-[#FF9F6B]",
        glowColor: "rgba(255,107,53,0.35)",
        glowIntensity: 0.6,
      };
    if (s >= 3)
      return {
        label: "Warming Up",
        color: "from-[#FF9F6B] to-[#FF6B35]",
        glowColor: "rgba(255,107,53,0.25)",
        glowIntensity: 0.3,
      };
    return {
      label: "Starting",
      color: "from-[#737373] to-[#525252]",
      glowColor: "rgba(115,115,115,0.15)",
      glowIntensity: 0,
    };
  };

  const tier = getStreakTier(streak);
  const showFireParticles = streak >= 7;

  return (
    <motion.div
      initial={{ scale: 0, rotate: -10 }}
      animate={
        justIncreased
          ? {
              scale: [1, 1.3, 0.9, 1.15, 0.95, 1.05, 1],
              rotate: [0, -5, 3, -2, 1, 0],
            }
          : { scale: 1, rotate: 0 }
      }
      transition={
        justIncreased
          ? { duration: 0.8, ease: "easeOut" }
          : { type: "spring", stiffness: 300, damping: 20 }
      }
      className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r ${tier.color} ${className}`}
    >
      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        animate={{
          boxShadow: [
            `0 0 ${8 * tier.glowIntensity}px ${tier.glowColor}, 0 0 ${16 * tier.glowIntensity}px ${tier.glowColor}`,
            `0 0 ${14 * tier.glowIntensity}px ${tier.glowColor}, 0 0 ${28 * tier.glowIntensity}px ${tier.glowColor}`,
            `0 0 ${8 * tier.glowIntensity}px ${tier.glowColor}, 0 0 ${16 * tier.glowIntensity}px ${tier.glowColor}`,
          ],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Fire particles for streaks > 7 */}
      {showFireParticles && (
        <FireParticles intensity={Math.floor(streak / 3)} />
      )}

      {/* Flame icon */}
      <motion.div
        animate={{
          scale: [1, 1.25, 1],
          rotate: [0, -5, 5, 0],
        }}
        transition={{
          duration: streak >= 14 ? 1 : 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Flame
          className="w-4 h-4 text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]"
          strokeWidth={2.5}
        />
      </motion.div>

      {/* Streak count */}
      <AnimatePresence mode="popLayout">
        <motion.span
          key={streak}
          initial={{ y: -8, opacity: 0, scale: 0.5 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 8, opacity: 0, scale: 0.5 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="text-xs font-bold text-white"
        >
          {streak}
        </motion.span>
      </AnimatePresence>

      <span className="text-[10px] font-medium text-white/80">{tier.label}</span>

      {/* Celebration burst on increase */}
      <AnimatePresence>
        {justIncreased && (
          <>
            {Array.from({ length: 6 }, (_, i) => {
              const angle = (i * 60) * (Math.PI / 180);
              return (
                <motion.div
                  key={`burst-${i}`}
                  className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-white"
                  initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                  animate={{
                    x: Math.cos(angle) * 25,
                    y: Math.sin(angle) * 25,
                    scale: 0,
                    opacity: 0,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              );
            })}
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
