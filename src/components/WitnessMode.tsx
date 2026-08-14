"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DailyTask } from "@/lib/firestore-schema";
import { disputeTask, resolveDispute, completeTask } from "@/lib/firestore";
import PhotoProof from "@/components/PhotoProof";
import { Eye, ShieldCheck, AlertTriangle } from "lucide-react";

interface WitnessModeProps {
  task: DailyTask;
  currentUserId: string;
  onUpdate?: () => void;
}

export default function WitnessMode({ task, currentUserId, onUpdate }: WitnessModeProps) {
  const [disputing, setDisputing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPartner = currentUserId !== task.assignedTo;
  const isCompleter = currentUserId === task.assignedTo;

  // Partner sees "Prove it" button on completed tasks (not their own)
  if (isPartner && task.isCompleted && !task.disputed && !task.disputeResolved) {
    return (
      <div className="mt-3">
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={async () => {
          setDisputing(true);
          setError(null);
          try {
            await disputeTask(task.id, currentUserId);
            onUpdate?.();
          } catch (e) {
            setError((e as Error)?.message ?? "Could not dispute this dare.");
          } finally {
            setDisputing(false);
          }
        }}
        disabled={disputing}
        className="w-full py-2.5 px-4 rounded-xl border border-[#FF6B35]/30 bg-transparent text-[#FF6B35] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#FF6B35]/5 transition-colors disabled:opacity-50"
      >
        <Eye className="w-4 h-4" />
        {disputing ? "Disputing..." : "👀 Prove it"}
      </motion.button>
      {error && (
        <p className="text-[11px] text-red-400 mt-2 leading-relaxed">{error}</p>
      )}
      </div>
    );
  }

  // Completer sees "Partner wants proof!" when disputed
  if (isCompleter && task.disputed && !task.disputeResolved) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 p-4 rounded-xl border border-[#FF6B35]/30 bg-[#FF6B35]/5"
      >
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-[#FF6B35]" />
          <p className="text-sm font-semibold text-[#FF6B35]">
            Partner wants proof!
          </p>
        </div>
        <p className="text-xs text-white/50 mb-3">
          Upload photo proof to verify your completion.
        </p>
        <PhotoProof
          taskId={task.id}
          taskTitle={task.title}
          onProofUploaded={async () => {
            setResolving(true);
            try {
              await resolveDispute(task.id);
              onUpdate?.();
            } catch (e) {
              setError(
                (e as Error)?.message ?? "Could not resolve the dispute."
              );
            } finally {
              setResolving(false);
            }
          }}
        />
      </motion.div>
    );
  }

  // Partner sees the dispute status
  if (isPartner && task.disputed && !task.disputeResolved) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-3 py-2 px-3 rounded-lg bg-[#FF6B35]/10 border border-[#FF6B35]/20 flex items-center gap-2"
      >
        <Eye className="w-3.5 h-3.5 text-[#FF6B35]" />
        <span className="text-xs text-[#FF6B35] font-medium">
          👀 Disputed — waiting for proof
        </span>
      </motion.div>
    );
  }

  // Resolved dispute badge
  if (task.disputed && task.disputeResolved) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-2 py-1.5 px-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2 w-fit"
      >
        <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
        <span className="text-xs text-green-500 font-medium">✓ Verified</span>
      </motion.div>
    );
  }

  return null;
}

