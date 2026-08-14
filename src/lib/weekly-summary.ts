import { DailyTask, getTaskStatus } from "./firestore-schema";
import { sendLocalNotification } from "./notifications";
import { todayIST, dayOfWeekIST } from "./ist";

export interface WeeklyStats {
  totalTasks: number;
  completed: number;
  failed: number;
  completionRate: number;
  bestDay: string | null; // day name
  worstDay: string | null; // day name
  currentStreak: number;
  totalPenalties: number;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Compute weekly stats from tasks for a specific user.
 * Looks at the last 7 days of tasks.
 */
export function getWeeklyStats(tasks: DailyTask[], userId: string): WeeklyStats {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  const userTasks = tasks.filter(
    (t) => t.assignedTo === userId && t.date >= sevenDaysAgoStr
  );

  const completed = userTasks.filter((t) => getTaskStatus(t) === "completed").length;
  const failed = userTasks.filter((t) => getTaskStatus(t) === "failed").length;
  const totalTasks = userTasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

  // Compute per-day failure rates
  const dayFailures: Record<number, number> = {};
  const dayTotals: Record<number, number> = {};

  for (const task of userTasks) {
    const dayOfWeek = new Date(task.date + "T00:00:00").getDay();
    dayTotals[dayOfWeek] = (dayTotals[dayOfWeek] || 0) + 1;
    if (getTaskStatus(task) === "failed") {
      dayFailures[dayOfWeek] = (dayFailures[dayOfWeek] || 0) + 1;
    }
  }

  let bestDay: string | null = null;
  let worstDay: string | null = null;
  let minFailRate = Infinity;
  let maxFailRate = -1;

  for (const day of Object.keys(dayTotals).map(Number)) {
    const failRate = (dayFailures[day] || 0) / dayTotals[day];
    if (failRate < minFailRate) {
      minFailRate = failRate;
      bestDay = DAY_NAMES[day];
    }
    if (failRate > maxFailRate) {
      maxFailRate = failRate;
      worstDay = DAY_NAMES[day];
    }
  }

  // Calculate streak from tasks (consecutive completed days)
  const sortedDates = [...new Set(
    userTasks
      .filter((t) => getTaskStatus(t) === "completed")
      .map((t) => t.date)
  )].sort().reverse();

  let currentStreak = 0;
  const today = now.toISOString().split("T")[0];
  let checkDate = today;

  for (const date of sortedDates) {
    if (date === checkDate || date === getPrevDate(checkDate)) {
      currentStreak++;
      checkDate = date;
    } else {
      break;
    }
  }

  return {
    totalTasks,
    completed,
    failed,
    completionRate,
    bestDay,
    worstDay,
    currentStreak,
    totalPenalties: failed * 25, // approximate avg penalty
  };
}

function getPrevDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

/**
 * Generate a human-friendly weekly summary message.
 */
export function generateWeeklySummary(stats: WeeklyStats, userName: string): string {
  const { completionRate, completed, failed, bestDay, worstDay, currentStreak } = stats;

  let message = `📊 ${userName}'s Week: `;

  if (completionRate >= 80) {
    message += `Crushing it! ${completed}/${stats.totalTasks} tasks done (${completionRate}%).`;
  } else if (completionRate >= 50) {
    message += `Decent week — ${completed}/${stats.totalTasks} tasks (${completionRate}%).`;
  } else {
    message += `Rough week — only ${completed}/${stats.totalTasks} tasks (${completionRate}%).`;
  }

  if (currentStreak > 1) {
    message += ` 🔥 ${currentStreak}-day streak!`;
  }

  if (worstDay && failed > 0) {
    message += ` Watch out for ${worstDay}s.`;
  }

  return message;
}

/**
 * Check if today is Sunday and send a weekly summary notification.
 * Uses localStorage to deduplicate — fires only once per week.
 */
export function checkAndSendWeeklySummary(
  tasks: DailyTask[],
  userId: string,
  userName: string
): void {
  if (typeof window === "undefined") return;

  // Only fire on Sundays in IST. dayOfWeekIST reads the UTC day off an
  // IST-shifted epoch; the old code used a local getDay() on that epoch and
  // also double-corrected for the browser offset.
  if (dayOfWeekIST() !== 0) return;

  const weekKey = `weekly-summary-${todayIST()}`;
  if (localStorage.getItem(weekKey)) return;

  const stats = getWeeklyStats(tasks, userId);
  if (stats.totalTasks === 0) return;

  const summary = generateWeeklySummary(stats, userName);
  sendLocalNotification("📊 Weekly Summary", summary);

  localStorage.setItem(weekKey, "sent");
}
