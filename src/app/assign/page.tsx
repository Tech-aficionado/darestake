"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { getPartnerTodayTask, getTodayTask, createTask } from "@/lib/firestore";
import { sendLocalNotification } from "@/lib/notifications";
import { todayIST, nextMidnightIST, istTimeToInstant } from "@/lib/ist";
import { DailyTask } from "@/lib/firestore-schema";
import { dareCategories, DareCategory, DareTemplate } from "@/lib/dare-templates";
import { Timestamp } from "firebase/firestore";
import { GlassCard, GoldButton, BottomNav } from "@/components/ui";
import { Send, AlertCircle, CheckCircle2, Users, User, Sparkles, Clock } from "lucide-react";
import Link from "next/link";

// IST date math lives in @/lib/ist. The old inline helpers here both
// double-corrected for the browser timezone AND called the local setHours() on
// an epoch already shifted to represent IST, which is incoherent.
const getMidnightIST = nextMidnightIST;
const getTodayDateIST = todayIST;

function formatTimeLabel(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const hour = h % 12 || 12;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

type AssignTarget = "partner" | "myself";

export default function AssignPage() {
  const { user } = useAuth();
  const { userData, partnerData, loading } = useUserData();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignTarget, setAssignTarget] = useState<AssignTarget>("partner");
  const [partnerTask, setPartnerTask] = useState<DailyTask | null | undefined>(
    undefined
  );
  const [myTask, setMyTask] = useState<DailyTask | null | undefined>(undefined);
  const [checkingTasks, setCheckingTasks] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineTime, setDeadlineTime] = useState("18:00");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    async function checkTasks() {
      if (!userData?.pairId || !user) {
        setCheckingTasks(false);
        return;
      }
      try {
        if (userData.pairedWith) {
          const pTask = await getPartnerTodayTask(
            userData.pairId,
            userData.pairedWith
          );
          setPartnerTask(pTask);
        }
        const mTask = await getTodayTask(userData.pairId, user.uid);
        setMyTask(mTask);
      } catch (error) {
        console.error("Error checking tasks:", error);
        setPartnerTask(null);
        setMyTask(null);
      } finally {
        setCheckingTasks(false);
      }
    }
    if (userData && user) {
      checkTasks();
    }
  }, [userData, user]);

  const handleTemplateSelect = (template: DareTemplate) => {
    setTitle(`${template.emoji} ${template.title}`);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !userData?.pairId || !user) return;
    if (assignTarget === "partner" && !userData.pairedWith) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const taskDate = getTodayDateIST();
      const useCheckIn = hasDeadline && Boolean(deadlineTime);
      const CHECK_IN_GRACE_MIN = 30;

      // The real deadline is the check-in time + grace when one is set,
      // otherwise midnight IST. Previously `deadline` was always midnight, so
      // checkInBy was stored but never actually enforced.
      const deadlineDate = useCheckIn
        ? istTimeToInstant(taskDate, deadlineTime, CHECK_IN_GRACE_MIN)
        : getMidnightIST();

      // Refuse a deadline that has already elapsed. Without this, assigning a
      // 07:00 check-in at 10:00 creates a task whose deadline is already past,
      // and the next penalty sweep fines the assignee before they have even
      // seen the dare.
      if (deadlineDate.getTime() <= Date.now()) {
        setSubmitError(
          "That check-in time has already passed today. Pick a later time, or turn the check-in off to use midnight."
        );
        setSubmitting(false);
        return;
      }

      const taskData: Record<string, unknown> = {
        pairId: userData.pairId,
        assignedTo:
          assignTarget === "partner" ? userData.pairedWith : user.uid,
        assignedBy: user.uid,
        title: title.trim(),
        date: taskDate,
        isCompleted: false,
        deadline: Timestamp.fromDate(deadlineDate),
        penaltyApplied: false,
      };
      if (description.trim()) {
        taskData.description = description.trim();
      }
      if (useCheckIn) {
        taskData.checkInBy = deadlineTime;
        taskData.checkInGrace = CHECK_IN_GRACE_MIN;
      }
      await createTask(taskData as Parameters<typeof createTask>[0]);

      // Reflect the new task locally so the "already has a dare today" guard
      // fires if the user taps "Set Another" -- these were previously left at
      // their stale initial-fetch value of null, which let a second dare be
      // created for the same person on the same day.
      if (assignTarget === "partner") {
        setPartnerTask({ date: taskDate } as DailyTask);
      } else {
        setMyTask({ date: taskDate } as DailyTask);
      }

      setSuccess(true);
      setTitle("");
      setDescription("");
      setActiveCategory(null);

      const targetName = assignTarget === "partner"
        ? partnerData?.displayName?.split(" ")[0] || "Partner"
        : "yourself";
      const deadlineLabel = useCheckIn
        ? `${deadlineTime} IST (+${CHECK_IN_GRACE_MIN}m grace)`
        : "midnight IST";
      sendLocalNotification(
        "✅ Dare Sent!",
        `"${title.trim()}" assigned to ${targetName}. Deadline: ${deadlineLabel}.`
      );
    } catch (error) {
      // Previously only console.error'd: a denied write or offline device left
      // the form filled with no feedback, so the user assumed nothing happened
      // and tapped again -- which is how duplicates got created.
      console.error("Error creating task:", error);
      setSubmitError(
        (error as Error)?.message ??
          "Could not send that dare. Check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || checkingTasks) {
    return (
      <div className="min-h-dvh pb-24 px-4 pt-6 bg-[#0D0D0D]">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-[#F5F5F5]">Assign a Dare</h1>
          <p className="text-sm text-[#737373]">Challenge yourself or your partner</p>
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
          <h1 className="text-2xl font-bold text-[#F5F5F5]">Assign a Dare</h1>
          <p className="text-sm text-[#737373]">
            Challenge your partner for today
          </p>
        </motion.header>

        <GlassCard glow className="p-8 text-center">
          <Users className="w-14 h-14 text-[#FF6B35] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#F5F5F5] mb-2">
            No partner yet
          </h2>
          <p className="text-sm text-[#737373] mb-6">
            Pair up with a friend first to start assigning dares.
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

  // Check if the selected target already has a task
  const targetHasTask =
    assignTarget === "partner" ? !!partnerTask : !!myTask;
  const existingTask = assignTarget === "partner" ? partnerTask : myTask;

  // Success state
  if (success) {
    return (
      <div className="min-h-dvh pb-24 px-4 pt-6 bg-[#0D0D0D]">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-[#F5F5F5]">Assign a Dare</h1>
          <p className="text-sm text-[#737373]">
            Challenge yourself or your partner
          </p>
        </motion.header>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring" }}
        >
          <GlassCard glow className="p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
            >
              <CheckCircle2 className="w-16 h-16 text-[#22C55E] mx-auto mb-4" />
            </motion.div>
            <h2 className="text-xl font-bold text-[#F5F5F5] mb-2">
              {assignTarget === "partner" ? "Dare Sent!" : "Dare Set!"}
            </h2>
            <p className="text-sm text-[#737373] mb-6">
              {assignTarget === "partner"
                ? `${partnerData?.displayName || "Your partner"} better get to it before midnight IST 🔥`
                : "You've set yourself a challenge. Complete it before midnight IST 🔥"}
            </p>
            <GoldButton
              className="w-full"
              onClick={() => setSuccess(false)}
            >
              Set Another
            </GoldButton>
          </GlassCard>
        </motion.div>

        <BottomNav />
      </div>
    );
  }

  const selectedCategory = dareCategories.find((c) => c.id === activeCategory);

  // Main form
  return (
    <div className="min-h-dvh pb-24 px-4 pt-6 bg-[#0D0D0D]">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-[#F5F5F5]">Assign a Dare</h1>
        <p className="text-sm text-[#737373]">
          Challenge yourself or your partner for today
        </p>
      </motion.header>

      {/* Assign Target Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <label className="text-xs text-[#737373] uppercase tracking-wider block mb-2">
          Assign to
        </label>
        <div className="flex rounded-xl bg-[#141414] border border-[#2A2A2A] p-1">
          <button
            onClick={() => setAssignTarget("partner")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              assignTarget === "partner"
                ? "bg-[#FF6B35] text-black shadow-lg shadow-[#FF6B35]/25"
                : "text-[#737373] hover:text-[#A3A3A3]"
            }`}
          >
            <Users className="w-4 h-4" />
            Partner
          </button>
          <button
            onClick={() => setAssignTarget("myself")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              assignTarget === "myself"
                ? "bg-[#FF6B35] text-black shadow-lg shadow-[#FF6B35]/25"
                : "text-[#737373] hover:text-[#A3A3A3]"
            }`}
          >
            <User className="w-4 h-4" />
            Myself
          </button>
        </div>
      </motion.div>

      {/* Target already has task */}
      {targetHasTask && existingTask ? (
        <GlassCard className="p-6 text-center">
          <AlertCircle className="w-12 h-12 text-[#FF6B35] mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[#F5F5F5] mb-2">
            {assignTarget === "partner"
              ? "Partner already has a dare for today"
              : "You already have a dare for today"}
          </h2>
          <p className="text-sm text-[#737373] mb-2">
            <span className="text-[#F5F5F5] font-medium">
              &ldquo;{existingTask.title}&rdquo;
            </span>
          </p>
          <p className="text-xs text-[#737373]">
            {existingTask.isCompleted
              ? "✓ Already completed"
              : "Waiting to be completed"}
          </p>
        </GlassCard>
      ) : (
        <>
          {/* Quick Pick Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[#FF6B35]" />
              <span className="text-xs text-[#737373] uppercase tracking-wider font-medium">
                Quick Pick
              </span>
            </div>

            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
              {dareCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() =>
                    setActiveCategory(activeCategory === cat.id ? null : cat.id)
                  }
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all ${
                    activeCategory === cat.id
                      ? "bg-[#FF6B35]/20 border-2 border-[#FF6B35] text-[#FF6B35]"
                      : "bg-[#141414] border border-[#2A2A2A] text-[#A3A3A3] hover:border-[#3A3A3A]"
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Template Cards */}
            <AnimatePresence mode="wait">
              {selectedCategory && (
                <motion.div
                  key={selectedCategory.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3 overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-2">
                    {selectedCategory.templates.map((template, idx) => (
                      <motion.button
                        key={idx}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => handleTemplateSelect(template)}
                        className="text-left p-3 rounded-xl bg-[#141414] border border-[#2A2A2A] hover:border-[#FF6B35]/40 hover:bg-[#FF6B35]/5 transition-all"
                      >
                        <span className="text-base">{template.emoji}</span>
                        <p className="text-xs text-[#A3A3A3] mt-1 line-clamp-2">
                          {template.title}
                        </p>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[#2A2A2A]" />
            <span className="text-[10px] uppercase tracking-wider text-[#737373]">
              Or type your own
            </span>
            <div className="flex-1 h-px bg-[#2A2A2A]" />
          </div>

          {/* Form */}
          <GlassCard glow className="p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Send className="w-5 h-5 text-[#FF6B35]" />
              <h2 className="text-lg font-bold text-[#F5F5F5]">New Task</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#737373] uppercase tracking-wider block mb-2">
                  Task Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder={
                    assignTarget === "partner"
                      ? "e.g., Do 50 push-ups"
                      : "e.g., Read for 30 minutes"
                  }
                  className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 text-[#F5F5F5] placeholder:text-[#737373] focus:outline-none focus:border-[#FF6B35] transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-[#737373] uppercase tracking-wider block mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details about the task..."
                  rows={3}
                  className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 text-[#F5F5F5] placeholder:text-[#737373] focus:outline-none focus:border-[#FF6B35] transition-colors resize-none"
                />
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-[#FF6B35]/5 border border-[#FF6B35]/20">
                <AlertCircle className="w-4 h-4 text-[#FF6B35] mt-0.5 shrink-0" />
                <p className="text-xs text-[#FF6B35]/80">
                  Deadline is {hasDeadline ? `${formatTimeLabel(deadlineTime)} IST (+30m grace)` : "midnight IST today"}. If{" "}
                  {assignTarget === "partner"
                    ? partnerData?.displayName?.split(" ")[0] || "your partner"
                    : "you"}{" "}
                  miss{assignTarget === "myself" ? "" : "es"} it, ₹10-50 goes to
                  the Gold Jar automatically.
                </p>
              </div>

              {/* Deadline Time Picker */}
              <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#FF6B35]" />
                    <span className="text-xs text-[#A3A3A3] font-medium">Set deadline time</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHasDeadline(!hasDeadline)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      hasDeadline ? "bg-[#FF6B35]" : "bg-[#2A2A2A]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        hasDeadline ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                {hasDeadline && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3"
                  >
                    <input
                      type="time"
                      value={deadlineTime}
                      onChange={(e) => setDeadlineTime(e.target.value)}
                      className="w-full bg-[#0D0D0D] border border-[#FF6B35]/20 rounded-lg px-3 py-2.5 text-[#FF6B35] text-sm font-mono focus:outline-none focus:border-[#FF6B35] transition-colors [color-scheme:dark]"
                    />
                    <p className="text-[10px] text-[#737373] mt-1.5">
                      +30 min grace period applied automatically
                    </p>
                  </motion.div>
                )}
              </div>

              {submitError && (
                <p className="text-xs text-red-400 leading-relaxed mb-1">
                  {submitError}
                </p>
              )}

              <GoldButton
                className="w-full"
                disabled={!title.trim() || submitting}
                onClick={handleSubmit}
              >
                {submitting
                  ? "Sending..."
                  : assignTarget === "partner"
                    ? "Send Dare to Partner"
                    : "Set My Own Dare"}
              </GoldButton>
            </div>
          </GlassCard>
        </>
      )}

      <BottomNav />
    </div>
  );
}
