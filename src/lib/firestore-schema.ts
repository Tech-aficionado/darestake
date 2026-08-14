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
  amount: number; // Rs 10-50
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
