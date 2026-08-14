"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { DailyTask } from "@/lib/firestore-schema";
import { completeTask } from "@/lib/firestore";
import { subscribeToTodayTask } from "@/lib/firestore-realtime";
import { sendLocalNotification, scheduleDeadlineReminder } from "@/lib/notifications";
import {
  istTimeToInstant,
  todayIST,
  msUntilNextMidnightIST,
} from "@/lib/ist";
import {
  GlassCard,
  GoldButton,
  AnimatedCounter,
  StreakBadge,
  Countdown,
  BottomNav,
  Logo,
} from "@/components/ui";
import NotificationBanner from "@/components/NotificationBanner";
import PhotoProof from "@/components/PhotoProof";
import WitnessMode from "@/components/WitnessMode";
import { Coins, Target, Zap, Users, Clock } from "lucide-react";
import Link from "next/link";

function CheckInDeadline({ task }: { task: DailyTask }) {
  const [missed, setMissed] = useState(false);
  const [timeLabel, setTimeLabel] = useState("");

  useEffect(() => {
    if (!task.checkInBy) return;

    function check() {
      const checkInBy = task.checkInBy!;
      const [hours, minutes] = checkInBy.split(":").map(Number);
      const grace = task.checkInGrace ?? 30;

      // Compare real instants. The old code compared "minutes of day" derived
      // from a LOCAL getter on an IST-shifted epoch (5.5h off on an IST
      // browser), and its deadlineMins could exceed 1440 for late-evening
      // times, so the missed state never fired.
      const deadline = istTimeToInstant(task.date, checkInBy, grace);

      // Display the check-in time itself, without the grace period.
      const displayHour = hours % 12 || 12;
      const ampm = hours >= 12 ? "PM" : "AM";
      const displayMin = minutes.toString().padStart(2, "0");
      setTimeLabel(`Due by ${displayHour}:${displayMin} ${ampm}`);

      setMissed(!task.isCompleted && Date.now() > deadline.getTime());
    }

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [task.date, task.checkInBy, task.checkInGrace, task.isCompleted]);

  if (missed) {
    return (
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-lg font-bold text-red-400 flex items-center gap-2"
      >
        <Clock className="w-4 h-4" />
        Deadline missed!
      </motion.p>
    );
  }

  return (
    <p className="text-lg font-bold text-[#FF6B35] flex items-center gap-2">
      <Clock className="w-4 h-4" />
      {timeLabel}
    </p>
  );
}

export default function Home() {
  const { user, loading: authLoading, signIn } = useAuth();
  const { userData, loading: dataLoading, refresh } = useUserData();
  const [todayTask, setTodayTask] = useState<DailyTask | null>(null);
  const [partnerTask, setPartnerTask] = useState<DailyTask | null>(null);
  const [completing, setCompleting] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  // Track which subscription key has delivered data. When dependencies change,
  // this goes stale and isTaskLoading derives to true until the callback fires.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // The IST date the dashboard is currently showing. subscribeToTodayTask
  // resolves "today" once when it subscribes, so without this the listener
  // stays pinned to the day the app was opened: a phone left open overnight
  // keeps showing yesterday's dare (and yesterday's countdown) until the user
  // manually refreshes. Re-keying the subscription at midnight fixes that.
  const [dayKey, setDayKey] = useState(() => todayIST());

  // Refs, not state, for values read inside the onSnapshot callback: the
  // callback closes over the render in which the effect ran, so reading state
  // directly there gives stale values.
  const initialLoadRef = useRef(true);
  const todayTaskRef = useRef<DailyTask | null>(null);

  // Self-rescheduling so it keeps working across multiple nights.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleRollover = () => {
      // +1s of slack so todayIST() has definitely ticked over.
      timer = setTimeout(() => {
        setDayKey(todayIST());
        scheduleRollover();
      }, msUntilNextMidnightIST() + 1000);
    };
    scheduleRollover();
    return () => clearTimeout(timer);
  }, []);
  const router = useRouter();

  // Derive effective loading: when there's no pairId the subscription never
  // fires, so we're not actually loading task data — report false immediately
  // without calling setState inside the effect (satisfies react-hooks/set-state-in-effect).
  // Also true when subscription dependencies changed but callback hasn't fired yet.
  const subscriptionKey = userData?.pairId ? `${userData.pairId}:${dayKey}` : null;
  const isTaskLoading = !!userData?.pairId && loadedKey !== subscriptionKey;

  useEffect(() => {
    if (!userData?.pairId) {
      return;
    }
    // Reset refs for this new subscription cycle (no setState needed —
    // isTaskLoading derives from loadedKey !== subscriptionKey).
    initialLoadRef.current = true;
    todayTaskRef.current = null;

    let deadlineCleanup: (() => void) | null = null;

    const currentKey = `${userData.pairId}:${dayKey}`;
    const unsub = subscribeToTodayTask(
      userData.pairId,
      userData.uid,
      (task) => {
        // Read through refs so this is the CURRENT value, not the value
        // captured when the effect was set up.
        const isNewTask =
          !initialLoadRef.current && !!task && !todayTaskRef.current;

        todayTaskRef.current = task;
        setTodayTask(task);
        setLoadedKey(currentKey);

        // Notify when partner assigns a NEW task (not on initial page load)
        if (isNewTask && task.assignedBy !== userData.uid) {
          sendLocalNotification(
            "🎯 New Dare Assigned!",
            `"${task.title}" — complete it before midnight or pay up!`
          );
        }

        // Schedule deadline reminders for active tasks
        if (deadlineCleanup) deadlineCleanup();
        if (task && !task.isCompleted) {
          deadlineCleanup = scheduleDeadlineReminder(task.title);
        }

        initialLoadRef.current = false;
        setInitialLoad(false);
      }
    );

    // Subscribe to partner's task for Witness Mode
    let unsubPartner: (() => void) | undefined;
    if (userData.pairedWith) {
      unsubPartner = subscribeToTodayTask(
        userData.pairId,
        userData.pairedWith,
        (task) => {
          setPartnerTask(task);
        }
      );
    }

    return () => {
      unsub();
      if (unsubPartner) unsubPartner();
      if (deadlineCleanup) deadlineCleanup();
    };
    // dayKey re-keys this subscription at IST midnight so the query moves to
    // the new day's task instead of staying pinned to the day of mount.
  }, [userData?.pairId, userData?.uid, userData?.pairedWith, dayKey]);

  const handleComplete = async () => {
    if (!todayTask) return;
    setCompleting(true);
    try {
      await completeTask(todayTask.id);
      // No need to manually update state — onSnapshot listener handles it
    } catch (error) {
      console.error("Error completing task:", error);
    } finally {
      setCompleting(false);
    }
  };

  // Loading: keep the page shell (header + BottomNav) and show a small inline
  // spinner. A full-screen blocker here made every cold open flash a blank
  // page, and it's the pattern UserDataProvider was introduced to eliminate.
  if (authLoading || dataLoading) {
    return (
      <div className="min-h-dvh pb-24 px-4 pt-6 bg-[#0D0D0D]">
        <header className="mb-8">
          <Logo />
        </header>
        <div className="flex items-center gap-3 text-[#737373]">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-4 h-4 border-2 border-[#FF6B35] border-t-transparent rounded-full"
          />
          <span className="text-sm">Loading your dare…</span>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!user) {
    router.push("/");
    return null;
  }

  // Not paired - show CTA
  if (!userData?.pairedWith) {
    return (
      <div className="min-h-dvh pb-24 px-4 pt-6">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-white">
            Hey,{" "}
            <span className="text-[#FF6B35]">
              {user.displayName?.split(" ")[0]}
            </span>
          </h1>
          <p className="text-sm text-white/40">Welcome to DareStake</p>
        </motion.header>

        <GlassCard glow className="p-8 text-center">
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Users className="w-14 h-14 text-[#FF6B35] mx-auto mb-4" />
          </motion.div>
          <h2 className="text-xl font-bold text-white mb-2">
            Find your partner
          </h2>
          <p className="text-sm text-white/40 mb-6">
            Pair up with a friend to start assigning dares and staking gold.
          </p>
          <Link href="/pair">
            <GoldButton size="lg" className="w-full">
              Pair Up Now
            </GoldButton>
          </Link>
        </GlassCard>

        <BottomNav />
      </div>
    );
  }

  // Paired - show dashboard
  return (
    <div className="min-h-dvh pb-24 px-4 pt-6">
      {/* Notification Permission Banner */}
      <NotificationBanner />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">
            Hey,{" "}
            <span className="text-[#FF6B35]">
              {user.displayName?.split(" ")[0]}
            </span>
          </h1>
          <p className="text-sm text-white/40">Let&apos;s crush today&apos;s dare</p>
        </div>
        <StreakBadge streak={userData.streak} />
      </motion.header>

      {/* Countdown / Deadline */}
      <GlassCard className="p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">
              {todayTask?.checkInBy ? "Deadline" : "Time remaining"}
            </p>
            {todayTask?.checkInBy ? (
              <CheckInDeadline task={todayTask} />
            ) : (
              <Countdown />
            )}
          </div>
        </div>
      </GlassCard>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#FF6B35]/10">
              <Coins className="w-5 h-5 text-[#FF6B35]" />
            </div>
            <div>
              <p className="text-[11px] text-white/40 uppercase">Gold Jar</p>
              <AnimatedCounter
                value={userData.totalPenalties}
                prefix="₹"
                className="text-xl font-bold text-[#FF6B35]"
              />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-green-500/10">
              <Target className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-[11px] text-white/40 uppercase">Streak</p>
              <AnimatedCounter
                value={userData.streak}
                suffix=" days"
                className="text-xl font-bold text-white"
              />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Today's Task */}
      {isTaskLoading ? (
        <GlassCard className="p-6 mb-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-white/10 rounded w-1/3" />
            <div className="h-6 bg-white/10 rounded w-2/3" />
            <div className="h-10 bg-white/10 rounded w-full mt-4" />
          </div>
        </GlassCard>
      ) : todayTask ? (
        <GlassCard glow className="p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-[#FF6B35]/80 uppercase tracking-wider font-medium mb-1">
                Today&apos;s Dare
              </p>
              <h3 className="text-lg font-bold text-white">
                {todayTask.title}
              </h3>
              {todayTask.description && (
                <p className="text-sm text-white/40 mt-1">
                  {todayTask.description}
                </p>
              )}
            </div>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 1 }}
            >
              <Zap className="w-6 h-6 text-[#FF6B35]" />
            </motion.div>
          </div>
          <p className="text-sm text-white/40 mb-5">
            Assigned by your partner. Penalty: ₹10-50 to the Gold Jar.
          </p>
          {todayTask.isCompleted ? (
            <div>
              <div className="w-full py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-center">
                <span className="text-green-500 font-semibold">
                  ✓ Completed!
                </span>
                {todayTask.proofPhotoUrl && (
                  <p className="text-xs text-white/40 mt-1">📸 Proof uploaded</p>
                )}
              </div>
              {/* Witness: completer sees dispute prompt */}
              <WitnessMode task={todayTask} currentUserId={user.uid} onUpdate={refresh} />
            </div>
          ) : (
            <div className="space-y-3">
              <GoldButton
                className="w-full"
                onClick={handleComplete}
                disabled={completing}
              >
                {completing ? "Marking..." : "Mark as Done ✓"}
              </GoldButton>
              <PhotoProof
                taskId={todayTask.id}
                taskTitle={todayTask.title}
                onProofUploaded={(fileId, fileUrl) => {
                  console.log("Proof uploaded:", fileId, fileUrl);
                  refresh();
                }}
              />
            </div>
          )}
        </GlassCard>
      ) : (
        <GlassCard className="p-6 mb-6">
          <div className="text-center py-4">
            <Zap className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/50 font-medium">
              No dare assigned yet
            </p>
            <p className="text-xs text-white/30 mt-1">
              Your partner hasn&apos;t set a dare for today
            </p>
          </div>
        </GlassCard>
      )}

      {/* Partner's Task (Witness Mode) */}
      {partnerTask && partnerTask.isCompleted && !partnerTask.disputeResolved && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GlassCard className="p-5 mb-6">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">
              Partner&apos;s Dare
            </p>
            <p className="text-sm font-medium text-white mb-1">
              {partnerTask.title}
            </p>
            <p className="text-xs text-green-500 mb-2">✓ They marked it done</p>
            <WitnessMode task={partnerTask} currentUserId={user.uid} onUpdate={refresh} />
          </GlassCard>
        </motion.div>
      )}

      <BottomNav />
    </div>
  );
}
