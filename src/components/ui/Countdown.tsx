"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock } from "lucide-react";
import { istNow, nextMidnightIST } from "@/lib/ist";

interface CountdownProps {
  className?: string;
}

// IST date math lives in @/lib/ist. The old inline helper double-corrected for
// the browser timezone and mixed local setHours() with an IST-shifted epoch.
const getMidnightIST = nextMidnightIST;

function getTimeRemaining() {
  const midnight = getMidnightIST();
  const now = new Date();
  const diff = midnight.getTime() - now.getTime();

  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, total: 0 };

  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    total: diff,
  };
}

function getDayElapsedPercent(): number {
  // Read UTC fields off the IST-shifted epoch (local getters would re-apply the
  // browser's own offset and skew the ring).
  const ist = istNow();
  const hours = ist.getUTCHours();
  const minutes = ist.getUTCMinutes();
  const seconds = ist.getUTCSeconds();
  const totalSecondsInDay = 24 * 60 * 60;
  const elapsedSeconds = hours * 3600 + minutes * 60 + seconds;
  return elapsedSeconds / totalSecondsInDay;
}

function CircularProgress({ percent }: { percent: number }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percent);

  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 44 44"
      className="absolute -inset-[6px]"
    >
      {/* Track */}
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke="rgba(42,42,42,0.8)"
        strokeWidth="2.5"
      />
      {/* Progress */}
      <motion.circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke="url(#forgeProgressGradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        transform="rotate(-90 22 22)"
        initial={false}
        animate={{ strokeDashoffset }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
      <defs>
        <linearGradient id="forgeProgressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FF6B35" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function TimeUnit({
  value,
  label,
  urgencyLevel,
}: {
  value: number;
  label: string;
  urgencyLevel: 0 | 1 | 2;
}) {
  const colorClass =
    urgencyLevel === 2
      ? "text-[#DC2626]"
      : urgencyLevel === 1
      ? "text-[#FF6B35]"
      : "text-[#FF6B35]";

  return (
    <div className="flex flex-col items-center">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: -12, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 12, opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`text-2xl font-mono font-bold tabular-nums ${colorClass}`}
        >
          {String(value).padStart(2, "0")}
        </motion.span>
      </AnimatePresence>
      <span className="text-[10px] uppercase tracking-wider text-[#737373] mt-0.5">
        {label}
      </span>
    </div>
  );
}

export function Countdown({ className = "" }: CountdownProps) {
  const [time, setTime] = useState(getTimeRemaining());
  const [dayElapsed, setDayElapsed] = useState(getDayElapsedPercent());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTimeRemaining());
      setDayElapsed(getDayElapsedPercent());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Urgency levels: 0 = normal, 1 = < 1 hour, 2 = < 10 minutes
  const urgencyLevel: 0 | 1 | 2 =
    time.hours === 0 && time.minutes < 10 ? 2 : time.hours === 0 ? 1 : 0;

  const pulseSpeed = urgencyLevel === 2 ? 0.4 : urgencyLevel === 1 ? 0.8 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center gap-3 ${className}`}
    >
      {/* Clock icon with circular progress ring */}
      <div className="relative flex items-center justify-center w-8 h-8">
        <CircularProgress percent={dayElapsed} />
        <motion.div
          animate={
            urgencyLevel === 2
              ? {
                  x: [0, -1.5, 1.5, -1.5, 1.5, 0],
                  rotate: [0, -2, 2, -2, 2, 0],
                }
              : urgencyLevel === 1
              ? { scale: [1, 1.15, 1] }
              : {}
          }
          transition={{
            duration: urgencyLevel === 2 ? 0.4 : 0.8,
            repeat: Infinity,
            repeatDelay: urgencyLevel === 2 ? 0.3 : 0.5,
          }}
        >
          <Clock
            className={`w-5 h-5 transition-colors duration-300 ${
              urgencyLevel === 2
                ? "text-[#DC2626]"
                : urgencyLevel === 1
                ? "text-[#FF6B35]"
                : "text-[#FF6B35]/60"
            }`}
          />
        </motion.div>
      </div>

      {/* Time display */}
      <motion.div
        className="flex items-center gap-2"
        animate={
          urgencyLevel === 2
            ? {
                x: [0, -1, 1, -1, 0],
              }
            : {}
        }
        transition={{
          duration: 0.5,
          repeat: Infinity,
          repeatDelay: 1,
        }}
      >
        <TimeUnit value={time.hours} label="hrs" urgencyLevel={urgencyLevel} />
        <motion.span
          className={`text-lg font-light ${
            urgencyLevel === 2
              ? "text-[#DC2626]/60"
              : urgencyLevel === 1
              ? "text-[#FF6B35]/60"
              : "text-[#FF6B35]/40"
          }`}
          animate={pulseSpeed > 0 ? { opacity: [1, 0.3, 1] } : {}}
          transition={{ duration: pulseSpeed, repeat: Infinity }}
        >
          :
        </motion.span>
        <TimeUnit value={time.minutes} label="min" urgencyLevel={urgencyLevel} />
        <motion.span
          className={`text-lg font-light ${
            urgencyLevel === 2
              ? "text-[#DC2626]/60"
              : urgencyLevel === 1
              ? "text-[#FF6B35]/60"
              : "text-[#FF6B35]/40"
          }`}
          animate={pulseSpeed > 0 ? { opacity: [1, 0.3, 1] } : {}}
          transition={{ duration: pulseSpeed, repeat: Infinity }}
        >
          :
        </motion.span>
        <TimeUnit value={time.seconds} label="sec" urgencyLevel={urgencyLevel} />
      </motion.div>

      {/* Urgency indicator dot */}
      {urgencyLevel > 0 && (
        <motion.div
          className={`w-2 h-2 rounded-full ${
            urgencyLevel === 2 ? "bg-[#DC2626]" : "bg-[#FF6B35]"
          }`}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [1, 0.5, 1],
          }}
          transition={{
            duration: urgencyLevel === 2 ? 0.5 : 1,
            repeat: Infinity,
          }}
        />
      )}
    </motion.div>
  );
}
