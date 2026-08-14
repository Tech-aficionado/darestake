import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { nextMidnightIST } from "./ist";

/**
 * Request notification permission using the simple Notification API.
 * No service worker required. Saves status to Firestore user doc.
 */
export async function requestNotificationPermission(
  userId: string
): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("Notifications not supported in this browser");
    return false;
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    return false;
  }

  // Save enabled status to Firestore
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    notificationsEnabled: true,
  });

  return true;
}

/**
 * Send an immediate local notification.
 * Uses ServiceWorker showNotification (works on mobile/PWA),
 * falls back to new Notification() on desktop.
 */
/** Why a notification attempt failed, for surfacing in the UI. */
export type NotifyResult = { ok: true } | { ok: false; reason: string };

/**
 * Resolve an active ServiceWorkerRegistration, or null.
 *
 * Deliberately does NOT gate on `navigator.serviceWorker.controller`: that is
 * null on the first load after the SW installs, which made the previous version
 * of this file skip the SW path and fall through to `new Notification()` --
 * which throws "Illegal constructor" on Android. `.ready` resolves once there is
 * an ACTIVE registration, which is what showNotification actually needs.
 */
async function getActiveRegistration(
  timeoutMs = 3000
): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing?.active) return existing;
    const raced = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
    ]);
    return raced && "showNotification" in raced ? raced : null;
  } catch {
    return null;
  }
}

function notificationOptions(body: string): NotificationOptions {
  return {
    body,
    icon: "/icons/icon-192x192.svg",
    badge: "/icons/icon-192x192.svg",
    tag: `darestake-${Date.now()}`,
  };
}

/**
 * Attempt to show a notification and report exactly why it failed.
 * Use this for the "test notification" button so the user sees a real reason
 * instead of silence.
 */
export async function tryNotify(
  title: string,
  body: string
): Promise<NotifyResult> {
  if (typeof window === "undefined") return { ok: false, reason: "Not in a browser." };
  if (!("Notification" in window)) {
    return { ok: false, reason: "This browser does not support notifications." };
  }
  if (Notification.permission === "denied") {
    return {
      ok: false,
      reason:
        "Notifications are blocked. Enable them for this site in your browser/OS settings.",
    };
  }
  if (Notification.permission === "default") {
    return { ok: false, reason: "Permission not granted yet — tap Enable first." };
  }

  const options = notificationOptions(body);

  const reg = await getActiveRegistration();
  if (reg) {
    try {
      await reg.showNotification(title, options);
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        reason: `Service worker rejected it: ${(e as Error)?.message ?? e}`,
      };
    }
  }

  // No active SW. Direct construction works on desktop but throws on Android.
  try {
    new Notification(title, options);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason:
        "No active service worker, and direct notifications aren't allowed here " +
        `(${(e as Error)?.message ?? e}). Reload the app once and retry.`,
    };
  }
}

/**
 * Fire-and-forget notification. Never throws.
 */
export async function sendLocalNotification(
  title: string,
  body: string
): Promise<void> {
  const result = await tryNotify(title, body);
  if (!result.ok) console.warn("Notification not shown:", result.reason);
}

/**
 * Calculate time until midnight IST and schedule deadline reminders.
 * Triggers notifications at 1 hour, 30 min, and 10 min before midnight IST.
 * Returns cleanup function to cancel scheduled timers.
 */
export function scheduleDeadlineReminder(taskTitle: string): () => void {
  const timerIds: ReturnType<typeof setTimeout>[] = [];

  // IST date math lives in ./ist. The old inline helper double-corrected for the
  // browser timezone and mixed local setHours() with an IST-shifted epoch.
  const getMidnightIST = nextMidnightIST;

  const midnight = getMidnightIST();
  const now = Date.now();

  const reminders = [
    { offset: 60 * 60 * 1000, label: "1 hour" },
    { offset: 30 * 60 * 1000, label: "30 minutes" },
    { offset: 10 * 60 * 1000, label: "10 minutes" },
  ];

  for (const reminder of reminders) {
    const triggerTime = midnight.getTime() - reminder.offset;
    const delay = triggerTime - now;

    if (delay > 0) {
      const timerId = setTimeout(() => {
        sendLocalNotification(
          "⏰ Deadline approaching!",
          `"${taskTitle}" is due in ${reminder.label}! Complete it to avoid a penalty.`
        );
      }, delay);
      timerIds.push(timerId);
    }
  }

  return () => {
    timerIds.forEach((id) => clearTimeout(id));
  };
}

/**
 * Check current notification permission status.
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/**
 * Disable notifications for user in Firestore.
 */
export async function disableNotifications(userId: string): Promise<void> {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    notificationsEnabled: false,
  });
}
