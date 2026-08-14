"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Copy, Check, UserPlus, Link2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { GlassCard, GoldButton } from "@/components/ui";
import { createPairInvite, acceptPairInvite } from "@/lib/firestore";
import { sendLocalNotification } from "@/lib/notifications";

export default function PairPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [partnerCode, setPartnerCode] = useState("");
  const [generating, setGenerating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FF6B35] animate-spin" />
      </div>
    );
  }

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    setFeedback(null);
    try {
      const code = await createPairInvite(user.uid);
      setInviteCode(code);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to generate code";
      setFeedback({ type: "error", message });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = async () => {
    if (!user || !partnerCode.trim()) return;
    setJoining(true);
    setFeedback(null);
    try {
      await acceptPairInvite(partnerCode.trim().toUpperCase(), user.uid);
      setFeedback({ type: "success", message: "Paired successfully! 🎉" });

      // Welcome notification
      sendLocalNotification(
        "🤝 Partner Found!",
        "You're paired up! Start assigning dares and hold each other accountable."
      );

      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid or expired code";
      setFeedback({ type: "error", message });
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] px-4 py-8 pb-32">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md mx-auto"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#FF6B35]/10 border border-[#FF6B35]/30 flex items-center justify-center"
          >
            <UserPlus className="w-8 h-8 text-[#FF6B35]" />
          </motion.div>
          <h1 className="text-2xl font-bold text-[#F5F5F5] mb-2">
            Find Your Partner
          </h1>
          <p className="text-[#A3A3A3] text-sm">
            Pair up with someone to start daring each other
          </p>
        </div>

        {/* Feedback Toast */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`mb-6 p-4 rounded-xl border text-sm font-medium text-center ${
                feedback.type === "success"
                  ? "bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]"
                  : "bg-[#DC2626]/10 border-[#DC2626]/30 text-[#DC2626]"
              }`}
            >
              {feedback.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Option A: Generate Code */}
        <GlassCard className="p-6 mb-4" glow={!!inviteCode}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#FF6B35]/20 flex items-center justify-center">
              <Link2 className="w-4 h-4 text-[#FF6B35]" />
            </div>
            <h2 className="text-lg font-semibold text-[#F5F5F5]">
              Generate Invite Code
            </h2>
          </div>

          {inviteCode ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <p className="text-[#A3A3A3] text-sm mb-3">
                Share this code with your partner
              </p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-mono font-bold text-[#FF6B35] tracking-[0.3em]">
                  {inviteCode}
                </span>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleCopy}
                  className="p-2 rounded-lg bg-[#141414] border border-[#2A2A2A] hover:bg-[#1A1A1A] transition-colors"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-[#22C55E]" />
                  ) : (
                    <Copy className="w-5 h-5 text-[#A3A3A3]" />
                  )}
                </motion.button>
              </div>
              <p className="text-[#737373] text-xs mt-3">
                Code expires in 24 hours
              </p>
            </motion.div>
          ) : (
            <GoldButton
              onClick={handleGenerate}
              loading={generating}
              className="w-full"
            >
              Generate Code
            </GoldButton>
          )}
        </GlassCard>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-[#2A2A2A]" />
          <span className="text-[#737373] text-sm font-medium">or</span>
          <div className="flex-1 h-px bg-[#2A2A2A]" />
        </div>

        {/* Option B: Enter Code */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#FF6B35]/20 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-[#FF6B35]" />
            </div>
            <h2 className="text-lg font-semibold text-[#F5F5F5]">
              Enter Partner&apos;s Code
            </h2>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={partnerCode}
              onChange={(e) =>
                setPartnerCode(e.target.value.toUpperCase().slice(0, 6))
              }
              placeholder="XXXXXX"
              maxLength={6}
              className="w-full px-4 py-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-[#F5F5F5] text-center text-xl font-mono tracking-[0.3em] placeholder:text-[#737373] focus:outline-none focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35]/30 transition-all"
            />
            <GoldButton
              onClick={handleJoin}
              loading={joining}
              disabled={partnerCode.length < 6}
              className="w-full"
            >
              Join Partner
            </GoldButton>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
