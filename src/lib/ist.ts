/**
 * IST (UTC+05:30) date helpers.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * `Date.prototype.getTime()` already returns a timezone-independent UTC epoch.
 * The previous per-file helpers did:
 *
 *     new Date(now.getTime() + IST_OFFSET + now.getTimezoneOffset() * 60_000)
 *
 * That extra `getTimezoneOffset()` term is a double-correction. On a browser
 * already in IST it is -330 min, which exactly cancels IST_OFFSET and leaves the
 * raw UTC instant -- so every "IST date" was really the UTC date. Between
 * 00:00 and 05:30 IST that is the PREVIOUS day, which silently broke task
 * dating, today's-task lookups, and the penalty engine every night.
 *
 * THE RULE
 * --------
 * To read IST wall-clock fields: shift the epoch by +5:30 and read the **UTC**
 * fields (`toISOString()` / `getUTC*`). Never mix local getters/setters with a
 * shifted epoch.
 *
 * To convert IST wall-clock back to a real instant: `Date.UTC(...) - 5:30`.
 */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * A Date whose **UTC** fields represent the current IST wall clock.
 * Read it with `getUTC*` / `toISOString()` only.
 */
export function istNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/** Today's date in IST as `YYYY-MM-DD`. */
export function todayIST(): string {
  return istNow().toISOString().split("T")[0];
}

/** Yesterday's date in IST as `YYYY-MM-DD`. */
export function yesterdayIST(): string {
  return daysAgoIST(1);
}

/** The IST date `n` days before today, as `YYYY-MM-DD`. */
export function daysAgoIST(n: number): string {
  return new Date(istNow().getTime() - n * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
}

/** Day-of-week in IST (0 = Sunday ... 6 = Saturday). */
export function dayOfWeekIST(): number {
  return istNow().getUTCDay();
}

/**
 * The real instant at which the given IST date ends
 * (i.e. 00:00:00 IST of the following day).
 */
export function endOfDayIST(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  // 00:00 IST of the NEXT day, expressed as a true UTC instant.
  return new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0) - IST_OFFSET_MS);
}

/** The real instant of the next upcoming midnight IST. */
export function nextMidnightIST(): Date {
  return endOfDayIST(todayIST());
}

/**
 * Convert an IST wall-clock time on a given IST date into a real instant,
 * optionally adding a grace period in minutes.
 * `time24` is `"HH:mm"`.
 */
export function istTimeToInstant(
  dateStr: string,
  time24: string,
  graceMinutes = 0
): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = time24.split(":").map(Number);
  return new Date(
    Date.UTC(y, m - 1, d, hh, mm, 0, 0) -
      IST_OFFSET_MS +
      graceMinutes * 60 * 1000
  );
}

/** Milliseconds remaining until the next midnight IST (never negative). */
export function msUntilNextMidnightIST(): number {
  return Math.max(0, nextMidnightIST().getTime() - Date.now());
}
