"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  LogOut,
  Unlink,
  Flame,
  DollarSign,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Bell,
  BellOff,
  Shield,
  UserPlus,
  Coins,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  GlassCard,
  GoldButton,
  AnimatedCounter,
  StreakBadge,
  BottomNav,
} from "@/components/ui";
import { getUser, unpair, getPair, updateMaxFine } from "@/lib/firestore";
import {
  fineRange,
  DEFAULT_MAX_FINE,
  FINE_LIMIT_MIN,
  FINE_LIMIT_MAX,
} from "@/lib/firestore-schema";
import {
  requestNotificationPermission,
  getNotificationPermission,
  disableNotifications,
  tryNotify,
} from "@/lib/notifications";

interface UserProfile {
  displayName: string;
  photoURL: string;
  email: string;
  streak: number;
  totalPenalties: number;
  tasksCompleted: number;
  pairedWith: string | null;
  pairId: string | null;
  notificationsEnabled: boolean;
  partner?: {
    displayName: string;
    photoURL: string | null;
  } | null;
}

export default function ProfilePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [unpairing, setUnpairing] = useState(false);
  const [showConfirmUnpair, setShowConfirmUnpair] = useState(false);
  const [notifPermission, setNotifPermission] = useState<
    NotificationPermission | "unsupported"
  >(() => {
    if (typeof window === "undefined") return "default";
    return getNotificationPermission();
  });
  const [enablingNotif, setEnablingNotif] = useState(false);
  const [testingNotif, setTestingNotif] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: boolean; message: string } | null
  >(null);

  // Pair-level max fine. Kept as a string so the field can be cleared while
  // typing without snapping back to a number.
  const [maxFine, setMaxFine] = useState<number>(DEFAULT_MAX_FINE);
  const [maxFineInput, setMaxFineInput] = useState<string>(
    String(DEFAULT_MAX_FINE)
  );
  const [savingFine, setSavingFine] = useState(false);
  const [fineMsg, setFineMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const currentRange = fineRange(maxFine);

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const userData = await getUser(user.uid);
        let partner = null;
        if (userData?.pairedWith) {
          const partnerData = await getUser(userData.pairedWith);
          partner = partnerData
            ? {
                displayName: partnerData.displayName,
                photoURL: partnerData.photoURL,
              }
            : null;
        }

        // Load the shared stake. Falls back to the default for pairs created
        // before this setting existed.
        if (userData?.pairId) {
          try {
            const pair = await getPair(userData.pairId);
            const resolved = pair?.maxFine ?? DEFAULT_MAX_FINE;
            setMaxFine(resolved);
            setMaxFineInput(String(resolved));
          } catch (err) {
            console.error("Could not load pair stakes:", err);
          }
        }
        setProfile({
          displayName: user.displayName || "User",
          photoURL: user.photoURL || "",
          email: user.email || "",
          streak: userData?.streak || 0,
          totalPenalties: userData?.totalPenalties || 0,
          tasksCompleted: userData?.tasksCompleted || 0,
          pairedWith: userData?.pairedWith || null,
          pairId: userData?.pairId || null,
          notificationsEnabled: userData?.notificationsEnabled || false,
          partner,
        });
      } catch {
        setProfile({
          displayName: user.displayName || "User",
          photoURL: user.photoURL || "",
          email: user.email || "",
          streak: 0,
          totalPenalties: 0,
          tasksCompleted: 0,
          pairedWith: null,
          pairId: null,
          notificationsEnabled: false,
          partner: null,
        });
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleUnpair = async () => {
    if (!user || !profile?.pairId) return;
    setUnpairing(true);
    try {
      await unpair(profile.pairId, user.uid);
      setProfile((prev) =>
        prev ? { ...prev, pairedWith: null, pairId: null, partner: null } : prev
      );
      setShowConfirmUnpair(false);
    } catch (err) {
      console.error("Unpair failed:", err);
    } finally {
      setUnpairing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleEnableNotifications = async () => {
    if (!user) return;
    setEnablingNotif(true);
    try {
      const success = await requestNotificationPermission(user.uid);
      if (success) {
        setNotifPermission("granted");
        setProfile((prev) =>
          prev ? { ...prev, notificationsEnabled: true } : prev
        );
      } else {
        setNotifPermission(getNotificationPermission());
      }
    } catch (err) {
      console.error("Notification enable failed:", err);
    } finally {
      setEnablingNotif(false);
    }
  };

  const handleDisableNotifications = async () => {
    if (!user) return;
    try {
      await disableNotifications(user.uid);
      setProfile((prev) =>
        prev ? { ...prev, notificationsEnabled: false } : prev
      );
    } catch (err) {
      console.error("Notification disable failed:", err);
    }
  };

  const handleSaveMaxFine = async () => {
    if (!user || !profile?.pairId) return;
    setSavingFine(true);
    setFineMsg(null);
    try {
      const parsed = Number(maxFineInput);
      await updateMaxFine(profile.pairId, user.uid, parsed);
      const applied = Math.floor(parsed);
      setMaxFine(applied);
      setMaxFineInput(String(applied));
      const r = fineRange(applied);
      setFineMsg({
        ok: true,
        text: `Saved. Missed dares now cost ₹${r.min}–${r.max}.`,
      });
    } catch (e) {
      setFineMsg({
        ok: false,
        text: (e as Error)?.message ?? "Could not save that.",
      });
    } finally {
      setSavingFine(false);
    }
  };

  const handleTestNotification = async () => {
    setTestingNotif(true);
    setTestResult(null);
    const result = await tryNotify(
      "🔔 Test notification",
      "If you can see this, notifications are working."
    );
    setTestResult(
      result.ok
        ? { ok: true, message: "Sent! Check your notification tray." }
        : { ok: false, message: result.reason }
    );
    setTestingNotif(false);
  };

  if (authLoading || loadingProfile) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FF6B35] animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    router.push("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] px-4 py-8 pb-32">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md mx-auto space-y-4"
      >
        {/* Profile Header Card */}
        <GlassCard glow className="p-6">
          <div className="flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="mb-4"
            >
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={profile.displayName}
                  className="w-24 h-24 rounded-full border-3 border-[#FF6B35]/60 shadow-lg shadow-[#FF6B35]/20"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#FF6B35]/20 border-3 border-[#FF6B35]/60 flex items-center justify-center">
                  <span className="text-3xl font-bold text-[#FF6B35]">
                    {profile.displayName.charAt(0)}
                  </span>
                </div>
              )}
            </motion.div>
            <h1 className="text-xl font-bold text-[#F5F5F5] mb-1">
              {profile.displayName}
            </h1>
            <p className="text-[#737373] text-sm">{profile.email}</p>
            {profile.streak > 0 && (
              <div className="mt-3">
                <StreakBadge streak={profile.streak} />
              </div>
            )}
          </div>
        </GlassCard>

        {/* Stats Section */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              icon: Flame,
              label: "Streak",
              value: profile.streak,
              color: "text-[#FF6B35]",
              bgColor: "bg-[#FF6B35]/10",
            },
            {
              icon: DollarSign,
              label: "Penalties",
              value: profile.totalPenalties,
              color: "text-red-400",
              bgColor: "bg-red-400/10",
              prefix: "₹",
            },
            {
              icon: CheckCircle2,
              label: "Done",
              value: profile.tasksCompleted,
              color: "text-[#22C55E]",
              bgColor: "bg-[#22C55E]/10",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 * (i + 1) }}
            >
              <GlassCard className="p-4 text-center">
                <div
                  className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center mx-auto mb-2`}
                >
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <p className="text-xl font-bold text-[#F5F5F5]">
                  {stat.prefix || ""}
                  <AnimatedCounter value={stat.value} />
                </p>
                <p className="text-[11px] text-[#737373] mt-0.5">{stat.label}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Partner Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <GlassCard className="p-5" glow={!!profile.partner}>
            <h2 className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-4">
              Partner
            </h2>

            {profile.partner ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    {profile.partner.photoURL ? (
                      <img
                        src={profile.partner.photoURL}
                        alt={profile.partner.displayName}
                        className="w-12 h-12 rounded-full border border-[#FF6B35]/30"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#FF6B35]/10 border border-[#FF6B35]/30 flex items-center justify-center">
                        <span className="text-lg font-bold text-[#FF6B35]">
                          {profile.partner.displayName.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#22C55E] rounded-full border-2 border-[#0D0D0D]" />
                  </div>
                  <div>
                    <p className="text-[#F5F5F5] font-medium">
                      {profile.partner.displayName}
                    </p>
                    <p className="text-[#737373] text-xs">
                      Accountability Partner ✓
                    </p>
                  </div>
                </div>

                <AnimatePresence>
                  {showConfirmUnpair ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/20">
                        <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
                        <p className="text-xs text-red-300">
                          This will end your partnership. Active dares will be
                          cancelled.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <GoldButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowConfirmUnpair(false)}
                          className="flex-1"
                        >
                          Cancel
                        </GoldButton>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={handleUnpair}
                          disabled={unpairing}
                          className="flex-1 px-4 py-2 rounded-xl bg-[#DC2626]/20 border border-[#DC2626]/40 text-[#DC2626] text-sm font-medium disabled:opacity-50"
                        >
                          {unpairing ? "Unpairing..." : "Confirm Unpair"}
                        </motion.button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : (
              <div className="text-center py-3">
                <UserPlus className="w-10 h-10 text-[#737373] mx-auto mb-3" />
                <p className="text-[#737373] text-sm mb-3">No partner yet</p>
                <GoldButton
                  size="sm"
                  onClick={() => router.push("/pair")}
                  className="w-full"
                >
                  Find a Partner
                </GoldButton>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Notification Settings */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <GlassCard className="p-5">
            <h2 className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-4">
              Notifications
            </h2>

            <div className="space-y-3">
              {/* Deadline Reminders Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#FF6B35]/10 flex items-center justify-center">
                    <Bell className="w-4 h-4 text-[#FF6B35]" />
                  </div>
                  <div>
                    <p className="text-sm text-[#F5F5F5] font-medium">
                      Deadline Reminders
                    </p>
                    <p className="text-[11px] text-[#737373]">
                      1hr, 30min, 10min before midnight
                    </p>
                  </div>
                </div>

                {notifPermission === "granted" &&
                profile.notificationsEnabled ? (
                  <button
                    onClick={handleDisableNotifications}
                    className="w-11 h-6 rounded-full bg-[#FF6B35] relative transition-colors"
                  >
                    <motion.div
                      layout
                      className="w-5 h-5 rounded-full bg-white absolute top-0.5 right-0.5 shadow"
                    />
                  </button>
                ) : (
                  <button
                    onClick={
                      notifPermission === "denied"
                        ? undefined
                        : handleEnableNotifications
                    }
                    disabled={
                      notifPermission === "denied" || enablingNotif
                    }
                    className="w-11 h-6 rounded-full bg-[#2A2A2A] relative transition-colors disabled:opacity-50"
                  >
                    <motion.div
                      layout
                      className="w-5 h-5 rounded-full bg-[#A3A3A3] absolute top-0.5 left-0.5 shadow"
                    />
                  </button>
                )}
              </div>

              {/* Permission Status */}
              <div className="pl-12">
                {notifPermission === "unsupported" && (
                  <p className="text-xs text-[#737373]">
                    Notifications not supported in this browser
                  </p>
                )}
                {notifPermission === "denied" && (
                  <div className="flex items-center gap-1.5">
                    <BellOff className="w-3 h-3 text-[#DC2626]" />
                    <p className="text-xs text-[#DC2626]/80">
                      Blocked by browser. Allow in browser settings.
                    </p>
                  </div>
                )}
                {notifPermission === "granted" &&
                  profile.notificationsEnabled && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-[#22C55E]" />
                      <p className="text-xs text-[#22C55E]/80">Enabled</p>
                    </div>
                  )}
                {notifPermission === "default" && (
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-[#737373]" />
                    <p className="text-xs text-[#737373]">
                      Not yet asked — tap toggle to enable
                    </p>
                  </div>
                )}

                {/* Test button: turns "no notification" into a real reason. */}
                {notifPermission !== "unsupported" && (
                  <div className="mt-3 pt-3 border-t border-[#2A2A2A]">
                    <button
                      onClick={handleTestNotification}
                      disabled={testingNotif}
                      className="text-xs font-semibold text-[#FF6B35] hover:text-[#FF8555] disabled:opacity-50 transition-colors"
                    >
                      {testingNotif ? "Sending…" : "Send a test notification"}
                    </button>
                    {testResult && (
                      <p
                        className={`text-[11px] mt-2 leading-relaxed ${
                          testResult.ok ? "text-[#22C55E]" : "text-red-400"
                        }`}
                      >
                        {testResult.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Stakes -- pair-level, so either partner can change it */}
        {profile.partner && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <GlassCard className="p-5">
              <h2 className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-4">
                Stakes
              </h2>

              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-[#FF6B35]/10 flex items-center justify-center shrink-0">
                  <Coins className="w-4 h-4 text-[#FF6B35]" />
                </div>
                <div>
                  <p className="text-sm text-[#F5F5F5] font-medium">
                    Maximum fine
                  </p>
                  <p className="text-[11px] text-[#737373] leading-relaxed">
                    A missed dare costs a random amount up to this much. Shared
                    with your partner — either of you can change it.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#737373]">
                    ₹
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={FINE_LIMIT_MIN}
                    max={FINE_LIMIT_MAX}
                    value={maxFineInput}
                    onChange={(e) => {
                      setMaxFineInput(e.target.value);
                      setFineMsg(null);
                    }}
                    className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl pl-7 pr-3 py-2.5 text-sm text-[#F5F5F5] focus:outline-none focus:border-[#FF6B35] transition-colors"
                  />
                </div>
                <button
                  onClick={handleSaveMaxFine}
                  disabled={savingFine || maxFineInput.trim() === ""}
                  className="px-4 py-2.5 rounded-xl bg-[#FF6B35] text-[#0D0D0D] text-sm font-semibold disabled:opacity-40 transition-opacity"
                >
                  {savingFine ? "Saving…" : "Save"}
                </button>
              </div>

              <p className="text-[11px] text-[#737373] mt-2">
                Current range:{" "}
                <span className="text-[#F5F5F5]">
                  ₹{currentRange.min}–{currentRange.max}
                </span>{" "}
                per missed dare
              </p>

              {fineMsg && (
                <p
                  className={`text-[11px] mt-2 leading-relaxed ${
                    fineMsg.ok ? "text-[#22C55E]" : "text-red-400"
                  }`}
                >
                  {fineMsg.text}
                </p>
              )}
            </GlassCard>
          </motion.div>
        )}

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-3 pt-2"
        >
          {profile.partner && !showConfirmUnpair && (
            <GoldButton
              variant="ghost"
              onClick={() => setShowConfirmUnpair(true)}
              className="w-full flex items-center justify-center gap-2 border-[#DC2626]/20 text-[#DC2626] hover:bg-[#DC2626]/5"
            >
              <Unlink className="w-4 h-4" />
              Unpair from Partner
            </GoldButton>
          )}

          <GoldButton
            variant="outline"
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 border-[#FF6B35]/30 text-[#FF6B35]"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </GoldButton>
        </motion.div>
      </motion.div>

      <BottomNav />
    </div>
  );
}
