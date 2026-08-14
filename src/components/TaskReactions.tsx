"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const REACTION_EMOJIS = ["🔥", "💪", "👏", "😤"];

interface TaskReactionsProps {
  taskId: string;
  reactions: { [emoji: string]: string } | undefined;
  completedByUid: string;
  onReact: (taskId: string, emoji: string) => void;
  onRemoveReact: (taskId: string, emoji: string) => void;
}

export default function TaskReactions({
  taskId,
  reactions = {},
  completedByUid,
  onReact,
  onRemoveReact,
}: TaskReactionsProps) {
  const { user } = useAuth();
  const [animatingEmoji, setAnimatingEmoji] = useState<string | null>(null);

  // Only partner can react (not the completer)
  if (!user || user.uid === completedByUid) return null;

  const handleReact = (emoji: string) => {
    const existing = reactions[emoji];
    if (existing === user.uid) {
      onRemoveReact(taskId, emoji);
    } else {
      setAnimatingEmoji(emoji);
      onReact(taskId, emoji);
      setTimeout(() => setAnimatingEmoji(null), 600);
    }
  };

  return (
    <div className="flex items-center gap-1.5 mt-2">
      {REACTION_EMOJIS.map((emoji) => {
        const isReacted = reactions[emoji] === user?.uid;
        return (
          <motion.button
            key={emoji}
            onClick={() => handleReact(emoji)}
            whileTap={{ scale: 0.8 }}
            className={`relative px-2 py-1 rounded-lg text-sm transition-all ${
              isReacted
                ? "bg-[#FF6B35]/20 border border-[#FF6B35]/50"
                : "bg-white/5 border border-white/10 hover:border-white/20"
            }`}
          >
            <AnimatePresence>
              {animatingEmoji === emoji && (
                <motion.span
                  initial={{ scale: 1, opacity: 1, y: 0 }}
                  animate={{ scale: 2, opacity: 0, y: -20 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  {emoji}
                </motion.span>
              )}
            </AnimatePresence>
            <span>{emoji}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

