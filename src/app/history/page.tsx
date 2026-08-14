"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useUserData } from "@/hooks/useUserData";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeToRecentTasks } from "@/lib/firestore-realtime";
import { addReaction, removeReaction } from "@/lib/firestore";
import { DailyTask, getTaskStatus } from "@/lib/firestore-schema";
import { GlassCard, BottomNav } from "@/components/ui";
import { CheckCircle2, XCircle, Clock, Users } from "lucide-react";
import Link from "next/link";
import { GoldButton } from "@/components/ui";
import TaskReactions from "@/components/TaskReactions";

const statusConfig = {
  completed: {
    icon: CheckCircle2,
    color: "text-[#22C55E]",
    bg: "bg-[#22C55E]/10",
  },
  failed: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
  pending: { icon: Clock, color: "text-[#FF6B35]", bg: "bg-[#FF6B35]/10" },
};

function formatDate(dateStr: string): string {
  // dateStr is already an IST calendar date. Pin the parse to +05:30 and read
  // it back in IST so the label doesn't shift a day if the device is in another
  // timezone (bare "T00:00:00" parses as LOCAL midnight).
  const date = new Date(dateStr + "T00:00:00+05:30");
  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export default function HistoryPage() {
  const { user } = useAuth();
  const { userData, loading } = useUserData();
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  // Derive effective loading — when there's no pairId we're not loading.
  const isTasksLoading = tasksLoading && !!userData?.pairId;

  useEffect(() => {
    if (!userData?.pairId) {
      return;
    }
    const unsub = subscribeToRecentTasks(userData.pairId, 20, (history) => {
      setTasks(history);
      setTasksLoading(false);
    });
    return () => unsub();
  }, [userData?.pairId]);

  const handleReact = async (taskId: string, emoji: string) => {
    if (!user) return;
    try {
      await addReaction(taskId, emoji, user.uid);
    } catch (e) {
      console.error("Failed to add reaction:", e);
    }
  };

  const handleRemoveReact = async (taskId: string, emoji: string) => {
    try {
      await removeReaction(taskId, emoji);
    } catch (e) {
      console.error("Failed to remove reaction:", e);
    }
  };

  if (loading || isTasksLoading) {
    return (
      <div className="min-h-dvh pb-24 px-4 pt-6 bg-[#0D0D0D]">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-[#F5F5F5]">History</h1>
          <p className="text-sm text-[#737373]">Your track record</p>
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

  // Not paired -- keyed on pairId to match the subscription guard above, so the
  // two can't disagree about whether this user has a pair.
  if (!userData?.pairId) {
    return (
      <div className="min-h-dvh pb-24 px-4 pt-6 bg-[#0D0D0D]">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-[#F5F5F5]">History</h1>
          <p className="text-sm text-[#737373]">Your track record</p>
        </motion.header>

        <GlassCard glow className="p-8 text-center">
          <Users className="w-14 h-14 text-[#FF6B35] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#F5F5F5] mb-2">No history yet</h2>
          <p className="text-sm text-[#737373] mb-6">
            Pair up with a friend to start tracking dares.
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

  // Scope the counters to MY dares. The heading says "Your track record", but
  // these previously counted the whole pair's tasks while the fines column used
  // only my own totalPenalties -- so "Total 20 / Done 14 / Fined Rs120" mixed
  // two different subjects in one row and you couldn't read your own rate.
  const myTasks = tasks.filter((t) => t.assignedTo === user?.uid);
  const completedCount = myTasks.filter(
    (t) => getTaskStatus(t) === "completed"
  ).length;
  const totalPenalty = userData.totalPenalties;

  return (
    <div className="min-h-dvh pb-24 px-4 pt-6 bg-[#0D0D0D]">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold text-[#F5F5F5]">History</h1>
        <p className="text-sm text-[#737373]">Your track record</p>
      </motion.header>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <GlassCard className="p-3 text-center">
          <p className="text-[10px] text-[#737373] uppercase">Total</p>
          <p className="text-lg font-bold text-[#F5F5F5]">{myTasks.length}</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <p className="text-[10px] text-[#737373] uppercase">Done</p>
          <p className="text-lg font-bold text-[#22C55E]">{completedCount}</p>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <p className="text-[10px] text-[#737373] uppercase">Fined</p>
          <p className="text-lg font-bold text-[#FF6B35]">₹{totalPenalty}</p>
        </GlassCard>
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <GlassCard className="p-6 text-center">
          <Clock className="w-10 h-10 text-[#737373] mx-auto mb-3" />
          <p className="text-[#A3A3A3]">No tasks yet</p>
          <p className="text-xs text-[#737373] mt-1">
            Tasks will appear here once assigned
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {tasks.map((task, i) => {
            const status = getTaskStatus(task);
            const config = statusConfig[status];
            const Icon = config.icon;

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${config.bg}`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#F5F5F5] truncate">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-[#737373]">
                          {formatDate(task.date)}
                        </p>
                        {task.disputed && !task.disputeResolved && (
                          <span className="text-[10px] font-medium text-[#FF6B35] bg-[#FF6B35]/10 px-1.5 py-0.5 rounded">
                            👀 Disputed
                          </span>
                        )}
                        {task.disputed && task.disputeResolved && (
                          <span className="text-[10px] font-medium text-[#22C55E] bg-[#22C55E]/10 px-1.5 py-0.5 rounded">
                            ✓ Verified
                          </span>
                        )}
                      </div>
                    </div>
                    {status === "failed" && (
                      <span className="text-sm font-bold text-red-400">
                        Failed
                      </span>
                    )}
                  </div>
                  {/* Reactions for completed tasks */}
                  {status === "completed" && (
                    <TaskReactions
                      taskId={task.id}
                      reactions={task.reactions}
                      completedByUid={task.assignedTo}
                      onReact={handleReact}
                      onRemoveReact={handleRemoveReact}
                    />
                  )}
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
