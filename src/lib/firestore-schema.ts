import { Timestamp } from "firebase/firestore";

export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  pairedWith: string | null; // partner UID
  pairId: string | null; // reference to Pair doc
  createdAt: Timestamp;
  streak: number;
  totalPenalties: number; // in rupees
  tasksCompleted: number;
  fcmToken?: string;
  notificationsEnabled?: boolean;
}

export interface Pair {
  id: string;
  members: [string, string]; // two UIDs
  createdAt: Timestamp;
  isActive: boolean;
  /**
   * Upper bound of the random fine, in rupees. Pair-level because the stakes
   * are a shared agreement and the jar is shared. Optional: pairs created
   * before this setting existed fall back to DEFAULT_MAX_FINE.
   */
  maxFine?: number;
}

/** Fine range defaults, used when a pair has no explicit maxFine. */
export const DEFAULT_MIN_FINE = 10;
export const DEFAULT_MAX_FINE = 50;

/** Bounds accepted by the settings UI. */
export const FINE_LIMIT_MIN = 1;
export const FINE_LIMIT_MAX = 100_000;

/**
 * Resolve the actual [min, max] fine range for a pair.
 *
 * The floor is normally DEFAULT_MIN_FINE, but it is clamped down when the
 * configured max is lower -- otherwise a max of 5 would produce an inverted
 * range and Math.random() over a negative span returns nonsense.
 */
export function fineRange(maxFine?: number): { min: number; max: number } {
  const max = Math.max(
    FINE_LIMIT_MIN,
    Math.min(FINE_LIMIT_MAX, Math.floor(maxFine ?? DEFAULT_MAX_FINE))
  );
  return { min: Math.min(DEFAULT_MIN_FINE, max), max };
}

export interface DailyTask {
  id: string;
  pairId: string;
  assignedTo: string; // UID of person who must complete
  assignedBy: string; // UID of person who assigned (partner or self)
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD in IST
  isCompleted: boolean;
  completedAt?: Timestamp;
  createdAt: Timestamp;
  deadline: Timestamp; // midnight IST of that day
  penaltyApplied: boolean;
  proofPhotoId?: string;
  proofPhotoUrl?: string;
  // Witness Mode (dispute)
  disputed?: boolean;
  disputedBy?: string;
  disputedAt?: Timestamp;
  disputeResolved?: boolean;
  // Time-Stamped Check-in
  checkInBy?: string; // 24hr 'HH:mm' IST
  checkInGrace?: number; // grace period in minutes (default 30)
  // Reactions
  reactions?: { [emoji: string]: string }; // emoji -> UID of reactor
}

export interface GoldJar {
  id: string; // same as pairId
  pairId: string;
  totalAmount: number; // in rupees
  entryCount: number;
  lastUpdated: Timestamp;
}

export interface GoldJarEntry {
  id: string;
  jarId: string;
  pairId: string;
  userId: string; // who got penalized
  amount: number; // rupees; within the pair's configured fine range
  reason: string;
  taskId: string;
  date: string; // YYYY-MM-DD
  createdAt: Timestamp;
}

export interface Streak {
  userId: string;
  pairId: string;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string; // YYYY-MM-DD
  updatedAt: Timestamp;
}

export type TaskStatus = "pending" | "completed" | "failed";

export function getTaskStatus(task: DailyTask): TaskStatus {
  if (task.isCompleted) return "completed";
  if (task.penaltyApplied) return "failed";
  return "pending";
}

