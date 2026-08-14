"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useUserData } from "@/hooks/useUserData";
import { getTasksByPair } from "@/lib/firestore";
import { DailyTask, getTaskStatus } from "@/lib/firestore-schema";
import { daysAgoIST } from "@/lib/ist";
import { GlassCard, BottomNav } from "@/components/ui";
import {
  BarChart3,
  Trophy,
  Flame,
  TrendingDown,
  TrendingUp,
  Crown,
} from "lucide-react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Map JS getDay() (0=Sun) to Mon-first index
function dayToIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

interface DayStats {
  total: number;
  failed: number;
  rate: number; // failure rate 0-1
}

export default function InsightsPage() {
  const { userData, partnerData, loading } = useUserData();
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  useEffect(() => {
    if (!userData?.pairId) {
      setTasksLoading(false);
      return;
    }
    getTasksByPair(userData.pairId, 50).then((t) => {
      setTasks(t);
      setTasksLoading(false);
    });
  }, [userData?.pairId]);

  // Compute stats
  const stats = useMemo(() => {
    if (!userData) return null;

    const myTasks = tasks.filter((t) => t.assignedTo === userData.uid);
    const partnerTasks = tasks.filter((t) => t.assignedTo !== userData.uid);

    const computeUserStats = (userTasks: DailyTask[]) => {
      const completed = userTasks.filter((t) => getTaskStatus(t) === "completed").length;
      const failed = userTasks.filter((t) => getTaskStatus(t) === "failed").length;
      return { total: userTasks.length, completed, failed };
    };

    const myStats = computeUserStats(myTasks);
    const partnerStats = computeUserStats(partnerTasks);

    // Day-of-week analysis (last 7 days focus but use all data)
    const dayStats: DayStats[] = Array.from({ length: 7 }, () => ({
      total: 0,
      failed: 0,
      rate: 0,
    }));

    for (const task of myTasks) {
      const jsDay = new Date(task.date + "T00:00:00").getDay();
      const idx = dayToIndex(jsDay);
      dayStats[idx].total++;
      if (getTaskStatus(task) === "failed") {
        dayStats[idx].failed++;
      }
    }

    dayStats.forEach((d) => {
      d.rate = d.total > 0 ? d.failed / d.total : 0;
    });

    // Only consider days that actually have data. The old reducers seeded at
    // index 0 and used strict > / <, so a day with no tasks (rate 0) could never
    // be replaced -- the UI confidently claimed "you fail on Mondays" with zero
    // Monday data. null means "not enough data to say".
    const daysWithData = dayStats
      .map((d, i) => ({ ...d, i }))
      .filter((d) => d.total > 0);

    const worstDayIdx: number | null = daysWithData.length
      ? daysWithData.reduce((w, d) => (d.rate > w.rate ? d : w)).i
      : null;
    const bestDayIdx: number | null = daysWithData.length
      ? daysWithData.reduce((b, d) => (d.rate < b.rate ? d : b)).i
      : null;

    // Streak history - last 7 IST dates. Task.date is an IST date string, but
    // this loop used raw toISOString() (a UTC date), so between 00:00 and 05:30
    // IST the whole window was shifted a day and the newest column never matched.
    const last7Days: { date: string; status: "completed" | "failed" | "none" }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = daysAgoIST(i);
      const dayTask = myTasks.find((t) => t.date === dateStr);
      last7Days.push({
        date: dateStr,
        status: dayTask
          ? getTaskStatus(dayTask) === "completed"
            ? "completed"
            : getTaskStatus(dayTask) === "failed"
            ? "failed"
            : "none"
          : "none",
      });
    }

    return {
      my: myStats,
      partner: partnerStats,
      dayStats,
      worstDayIdx,
      bestDayIdx,
      last7Days,
    };
  }, [tasks, userData]);

  // Skeleton
  if (loading || tasksLoading) {
    return (
      <div className="min-h-dvh pb-24 px-4 pt-6 bg-[#0D0D0D]">
        <header className="mb-6">
          <div className="h-7 w-32 bg-[#1A1A1A] rounded animate-pulse" />
        </header>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-[#1A1A1A] rounded-2xl animate-pulse" />
          ))}
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!userData?.pairId || !stats) {
    return (
      <div className="min-h-dvh pb-24 px-4 pt-6 bg-[#0D0D0D] flex items-center justify-center">
        <GlassCard className="text-center p-8">
          <BarChart3 className="w-12 h-12 text-[#FF6B35]/50 mx-auto mb-3" />
          <p className="text-[#A3A3A3] text-sm">Pair up with someone to see insights</p>
        </GlassCard>
        <BottomNav />
      </div>
    );
  }

  const myWinning = stats.my.completed > stats.partner.completed;
  const tied = stats.my.completed === stats.partner.completed;

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1 } },
  };
  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-dvh pb-24 px-4 pt-6 bg-[#0D0D0D]">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-xl font-bold text-[#F5F5F5] flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#FF6B35]" />
          Insights
        </h1>
        <p className="text-[#737373] text-xs mt-0.5">
          Performance across {tasks.length} tasks
        </p>
      </motion.header>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        {/* ─── Partner Comparison ─────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-[#FF6B35]" />
              <h2 className="text-sm font-semibold text-[#F5F5F5]">
                Partner Comparison
              </h2>
              {!tied && (
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[#FF6B35]/10 text-[#FF6B35] font-medium">
                  {myWinning ? "You lead" : "Partner leads"}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* You */}
              <div
                className={`rounded-xl p-3 border ${
                  myWinning
                    ? "border-[#FF6B35]/30 bg-[#FF6B35]/5"
                    : "border-[#2A2A2A] bg-[#141414]"
                }`}
              >
                {myWinning && (
                  <Crown className="w-3 h-3 text-[#FF6B35] mb-1" />
                )}
                <p className="text-[10px] text-[#737373] uppercase tracking-wider mb-2">
                  You
                </p>
                <div className="space-y-1.5">
                  <StatRow label="Done" value={stats.my.completed} color="text-[#22C55E]" />
                  <StatRow label="Failed" value={stats.my.failed} color="text-red-400" />
                  <StatRow
                    label="Streak"
                    value={userData.streak}
                    color="text-[#FF6B35]"
                  />
                  <StatRow
                    label="Penalties"
                    value={`₹${userData.totalPenalties}`}
                    color="text-red-400"
                  />
                </div>
              </div>

              {/* Partner */}
              <div
                className={`rounded-xl p-3 border ${
                  !myWinning && !tied
                    ? "border-[#FF6B35]/30 bg-[#FF6B35]/5"
                    : "border-[#2A2A2A] bg-[#141414]"
                }`}
              >
                {!myWinning && !tied && (
                  <Crown className="w-3 h-3 text-[#FF6B35] mb-1" />
                )}
                <p className="text-[10px] text-[#737373] uppercase tracking-wider mb-2">
                  {partnerData?.displayName?.split(" ")[0] || "Partner"}
                </p>
                <div className="space-y-1.5">
                  <StatRow
                    label="Done"
                    value={stats.partner.completed}
                    color="text-[#22C55E]"
                  />
                  <StatRow
                    label="Failed"
                    value={stats.partner.failed}
                    color="text-red-400"
                  />
                  <StatRow
                    label="Streak"
                    value={partnerData?.streak || 0}
                    color="text-[#FF6B35]"
                  />
                  <StatRow
                    label="Penalties"
                    value={`₹${partnerData?.totalPenalties || 0}`}
                    color="text-red-400"
                  />
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* ─── Best / Worst Days ──────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-4 h-4 text-[#FF6B35]" />
              <h2 className="text-sm font-semibold text-[#F5F5F5]">
                Best & Worst Days
              </h2>
            </div>

            {/* 7-day grid */}
            <div className="grid grid-cols-7 gap-1.5 mb-3">
              {DAY_LABELS.map((label, i) => {
                const d = stats.dayStats[i];
                const intensity = d.rate;
                const bg =
                  d.total === 0
                    ? "bg-[#141414]"
                    : intensity === 0
                    ? "bg-[#22C55E]/20 border-[#22C55E]/30"
                    : intensity <= 0.3
                    ? "bg-[#22C55E]/10 border-[#22C55E]/20"
                    : intensity <= 0.6
                    ? "bg-[#FF6B35]/15 border-[#FF6B35]/30"
                    : "bg-red-500/20 border-red-500/40";

                return (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <span className="text-[9px] text-[#737373]">{label}</span>
                    <div
                      className={`w-8 h-8 rounded-lg border border-[#2A2A2A] ${bg} flex items-center justify-center`}
                    >
                      {d.total > 0 && (
                        <span className="text-[10px] font-medium text-[#A3A3A3]">
                          {d.failed}/{d.total}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Insight text -- only claim a pattern when a day actually has
                failures behind it. worstDayIdx is null when there's no data. */}
            {stats.worstDayIdx !== null &&
              stats.dayStats[stats.worstDayIdx].failed > 0 && (
              <p className="text-xs text-[#A3A3A3]">
                <span className="text-red-400">⚠</span> You tend to fail on{" "}
                <span className="text-red-400 font-medium">
                  {DAY_LABELS[stats.worstDayIdx]}s
                </span>
                {stats.bestDayIdx !== null &&
                  stats.dayStats[stats.bestDayIdx].total > 0 &&
                  stats.dayStats[stats.bestDayIdx].rate === 0 && (
                    <>
                      {" "}• Best on{" "}
                      <span className="text-[#22C55E] font-medium">
                        {DAY_LABELS[stats.bestDayIdx]}s
                      </span>
                    </>
                  )}
              </p>
            )}
          </GlassCard>
        </motion.div>

        {/* ─── Streak History ─────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-[#FF6B35]" />
              <h2 className="text-sm font-semibold text-[#F5F5F5]">
                Streak History
              </h2>
              <span className="ml-auto text-xs text-[#FF6B35] font-bold">
                🔥 {userData.streak}
              </span>
            </div>

            {/* Current / Longest */}
            <div className="flex gap-4 mb-3">
              <div>
                <p className="text-[10px] text-[#737373] uppercase">Current</p>
                <p className="text-lg font-bold text-[#FF6B35]">
                  {userData.streak}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#737373] uppercase">Longest</p>
                <p className="text-lg font-bold text-[#F5F5F5]">
                  {Math.max(userData.streak, stats.my.completed)}
                </p>
              </div>
            </div>

            {/* Last 7 days dot grid */}
            <div className="flex items-center gap-2">
              {stats.last7Days.map((day, i) => {
                const dotColor =
                  day.status === "completed"
                    ? "bg-[#22C55E] shadow-[#22C55E]/40"
                    : day.status === "failed"
                    ? "bg-red-500 shadow-red-500/40"
                    : "bg-[#2A2A2A]";
                const dayLabel = new Date(day.date + "T00:00:00").toLocaleDateString(
                  "en",
                  { weekday: "narrow" }
                );

                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className={`w-5 h-5 rounded-full ${dotColor} shadow-sm`}
                    />
                    <span className="text-[8px] text-[#737373]">{dayLabel}</span>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>

      <BottomNav />
    </div>
  );
}

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] text-[#737373]">{label}</span>
      <span className={`text-xs font-semibold ${color}`}>{value}</span>
    </div>
  );
}
