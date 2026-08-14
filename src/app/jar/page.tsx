"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { getOrCreateJar } from "@/lib/firestore";
import { subscribeToJar, subscribeToJarEntries } from "@/lib/firestore-realtime";
import { GoldJar, GoldJarEntry } from "@/lib/firestore-schema";
import { GlassCard, AnimatedCounter, BottomNav, GoldButton } from "@/components/ui";
import { Coins, TrendingUp, Trophy, Users } from "lucide-react";
import Link from "next/link";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export default function JarPage() {
  const { user } = useAuth();
  const { userData, partnerData, loading } = useUserData();
  const [jar, setJar] = useState<GoldJar | null>(null);
  const [entries, setEntries] = useState<GoldJarEntry[]>([]);
  const [jarLoading, setJarLoading] = useState(true);

  // Derive effective loading — when there's no pairId we're not loading.
  const isJarLoading = jarLoading && !!userData?.pairId;

  useEffect(() => {
    if (!userData?.pairId) {
      return;
    }

    // Ensure jar document exists
    getOrCreateJar(userData.pairId).catch(console.error);

    const unsubJar = subscribeToJar(userData.pairId, (jarData) => {
      setJar(jarData);
      setJarLoading(false);
    });

    const unsubEntries = subscribeToJarEntries(userData.pairId, 10, (jarEntries) => {
      setEntries(jarEntries);
    });

    return () => {
      unsubJar();
      unsubEntries();
    };
  }, [userData?.pairId]);

  if (loading || isJarLoading) {
    return (
      <div className="min-h-dvh pb-24 px-4 pt-6 bg-[#0D0D0D]">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-[#F5F5F5]">Gold Jar</h1>
          <p className="text-sm text-[#737373]">Penalties fuel the prize</p>
        </motion.header>
        <div className="flex justify-center py-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-2 border-[#FF6B35] border-t-transparent rounded-full"
          />
        </div>
        <BottomNav />
      </div>
    );
  }

  // Not paired
  if (!userData?.pairedWith) {
    return (
      <div className="min-h-dvh pb-24 px-4 pt-6 bg-[#0D0D0D]">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-[#F5F5F5]">Gold Jar</h1>
          <p className="text-sm text-[#737373]">Penalties fuel the prize</p>
        </motion.header>

        <GlassCard glow className="p-8 text-center">
          <Users className="w-14 h-14 text-[#FF6B35] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#F5F5F5] mb-2">No jar yet</h2>
          <p className="text-sm text-[#737373] mb-6">
            Pair up with a friend to start filling the Gold Jar.
          </p>
          <Link href="/pair">
            <GoldButton size="lg" className="w-full">
              Find a Partner
            </GoldButton>
          </Link>
        </GlassCard>

        <BottomNav />
      </div>
    );
  }

  // All-time split. This previously summed only the 10 most recent entries
  // while the headline figure used the jar's all-time totalAmount, so past 10
  // penalties "Your fines + Partner's fines" visibly failed to add up to
  // "Total Collected". users.totalPenalties is maintained by addPenalty in the
  // same write path as the jar total, so these reconcile by construction.
  const userFines = userData?.totalPenalties ?? 0;
  const partnerFines = partnerData?.totalPenalties ?? 0;

  return (
    <div className="min-h-dvh pb-24 px-4 pt-6 bg-[#0D0D0D]">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold text-[#F5F5F5]">Gold Jar</h1>
        <p className="text-sm text-[#737373]">Penalties fuel the prize</p>
      </motion.header>

      {/* Jar Total */}
      <GlassCard glow className="p-8 mb-6 text-center">
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Coins className="w-16 h-16 text-[#FF6B35] mx-auto mb-4" />
        </motion.div>
        <p className="text-xs text-[#737373] uppercase tracking-wider mb-2">
          Total Collected
        </p>
        <AnimatedCounter
          value={jar?.totalAmount ?? 0}
          prefix="₹"
          className="text-5xl font-black text-[#FF6B35]"
        />
        <div className="flex items-center justify-center gap-4 mt-4">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#22C55E]" />
            <span className="text-xs text-[#22C55E]">
              {entries.length > 0
                ? `+₹${entries[0]?.amount ?? 0} latest`
                : "No penalties yet"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-[#FF6B35]" />
            <span className="text-xs text-[#A3A3A3]">
              {jar?.entryCount ?? 0} entries
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Split */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <GlassCard className="p-4 text-center">
          <p className="text-[11px] text-[#737373] uppercase mb-1">Your fines</p>
          <AnimatedCounter
            value={userFines}
            prefix="₹"
            className="text-xl font-bold text-red-400"
          />
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-[11px] text-[#737373] uppercase mb-1">
            {partnerData?.displayName?.split(" ")[0] || "Partner"}&apos;s fines
          </p>
          <AnimatedCounter
            value={partnerFines}
            prefix="₹"
            className="text-xl font-bold text-blue-400"
          />
        </GlassCard>
      </div>

      {/* Recent Entries */}
      <h2 className="text-sm font-semibold text-[#A3A3A3] uppercase tracking-wider mb-3">
        Recent Penalties
      </h2>
      {entries.length === 0 ? (
        <GlassCard className="p-6 text-center">
          <Coins className="w-10 h-10 text-[#737373] mx-auto mb-3" />
          <p className="text-[#A3A3A3]">No penalties yet</p>
          <p className="text-xs text-[#737373] mt-1">
            Missed deadlines will add entries here
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <GlassCard className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#F5F5F5]">
                      {entry.reason}
                    </p>
                    <p className="text-xs text-[#737373] mt-0.5">
                      {entry.userId === user?.uid
                        ? "You"
                        : partnerData?.displayName?.split(" ")[0] || "Partner"}{" "}
                      · {formatDate(entry.date)}
                    </p>
                  </div>
                  <span className="text-[#FF6B35] font-bold">
                    ₹{entry.amount}
                  </span>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
