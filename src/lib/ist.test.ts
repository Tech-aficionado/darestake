import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  IST_OFFSET_MS,
  istNow,
  todayIST,
  yesterdayIST,
  daysAgoIST,
  dayOfWeekIST,
  endOfDayIST,
  nextMidnightIST,
  istTimeToInstant,
  msUntilNextMidnightIST,
} from "@/lib/ist";

/**
 * Tests for the IST date module.
 *
 * Every date bug this app has had traced back to this one concern, so these
 * tests are written to pin down the exact behaviour rather than just smoke-test
 * it. Two conventions matter:
 *
 *  1. Every assertion is an ABSOLUTE value (an ISO instant or a fixed date
 *     string). That makes the suite timezone-independent by construction: if
 *     anyone reintroduces a getTimezoneOffset() term, these fail on any machine
 *     whose local offset isn't zero -- including the IST machines this app is
 *     built on.
 *
 *  2. The clock is always frozen with vi.setSystemTime, because most of these
 *     functions read Date.now(). "It passed today" is not a test.
 *
 * Helper: `atIST(...)` builds the real instant corresponding to an IST wall
 * clock, so test intent reads in IST rather than UTC.
 */
function atIST(
  y: number,
  m: number,
  d: number,
  hh = 0,
  mm = 0,
  ss = 0
): Date {
  return new Date(Date.UTC(y, m - 1, d, hh, mm, ss, 0) - IST_OFFSET_MS);
}

/** Freeze the clock at a given IST wall-clock moment. */
function freezeAtIST(
  y: number,
  m: number,
  d: number,
  hh = 0,
  mm = 0,
  ss = 0
): void {
  vi.setSystemTime(atIST(y, m, d, hh, mm, ss));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("IST_OFFSET_MS", () => {
  it("is exactly 5 hours 30 minutes", () => {
    expect(IST_OFFSET_MS).toBe(19_800_000);
    expect(IST_OFFSET_MS).toBe(5.5 * 60 * 60 * 1000);
  });
});

describe("the original bug (regression guard)", () => {
  /**
   * The bug: helpers computed IST as
   *     new Date(now.getTime() + IST_OFFSET + now.getTimezoneOffset() * 60_000)
   * getTime() is already a UTC epoch, so the getTimezoneOffset() term is a
   * double-correction. On an IST machine it is -330 min, exactly cancelling
   * IST_OFFSET and leaving raw UTC -- so between 00:00 and 05:30 IST every
   * date was the PREVIOUS day.
   *
   * The offset is supplied explicitly here rather than read from the host, so
   * this test is deterministic on any machine.
   */
  const IST_LOCAL_OFFSET_MIN = -330; // what getTimezoneOffset() returns in IST

  function buggyTodayIST(now: Date): string {
    return new Date(
      now.getTime() + IST_OFFSET_MS + IST_LOCAL_OFFSET_MIN * 60 * 1000
    )
      .toISOString()
      .split("T")[0];
  }

  it("returns the correct day at 01:00 IST, where the old formula was a day behind", () => {
    // 01:00 IST on 14 Aug 2026 == 19:30 UTC on 13 Aug 2026.
    freezeAtIST(2026, 8, 14, 1, 0);

    expect(buggyTodayIST(new Date())).toBe("2026-08-13"); // the old, wrong answer
    expect(todayIST()).toBe("2026-08-14"); // the correct answer
  });

  it("agrees with the old formula OUTSIDE the 00:00-05:30 window", () => {
    // The bug was invisible for ~18.5h a day, which is why it survived so long.
    freezeAtIST(2026, 8, 14, 12, 0);
    expect(buggyTodayIST(new Date())).toBe(todayIST());
  });

  it.each([
    [0, 0],
    [2, 15],
    [5, 29],
  ])(
    "is correct across the whole broken window (%i:%i IST)",
    (hh, mm) => {
      freezeAtIST(2026, 8, 14, hh, mm);
      expect(todayIST()).toBe("2026-08-14");
    }
  );
});

describe("istNow", () => {
  it("returns a Date whose UTC fields are the IST wall clock", () => {
    freezeAtIST(2026, 8, 14, 7, 45, 30);
    const n = istNow();
    expect(n.getUTCFullYear()).toBe(2026);
    expect(n.getUTCMonth()).toBe(7); // August, 0-indexed
    expect(n.getUTCDate()).toBe(14);
    expect(n.getUTCHours()).toBe(7);
    expect(n.getUTCMinutes()).toBe(45);
    expect(n.getUTCSeconds()).toBe(30);
  });

  it("is exactly 5:30 ahead of the real instant", () => {
    freezeAtIST(2026, 8, 14, 12, 0);
    expect(istNow().getTime() - Date.now()).toBe(IST_OFFSET_MS);
  });
});

describe("todayIST", () => {
  it("holds the same date right up to 23:59:59 IST", () => {
    freezeAtIST(2026, 8, 14, 23, 59, 59);
    expect(todayIST()).toBe("2026-08-14");
  });

  it("rolls to the next date at exactly 00:00:00 IST", () => {
    freezeAtIST(2026, 8, 15, 0, 0, 0);
    expect(todayIST()).toBe("2026-08-15");
  });

  it("rolls over one millisecond before midnight vs at midnight", () => {
    const midnight = atIST(2026, 8, 15, 0, 0, 0);

    vi.setSystemTime(new Date(midnight.getTime() - 1));
    expect(todayIST()).toBe("2026-08-14");

    vi.setSystemTime(midnight);
    expect(todayIST()).toBe("2026-08-15");
  });

  it("handles month boundaries", () => {
    freezeAtIST(2026, 8, 31, 23, 30);
    expect(todayIST()).toBe("2026-08-31");
    freezeAtIST(2026, 9, 1, 0, 30);
    expect(todayIST()).toBe("2026-09-01");
  });

  it("handles year boundaries", () => {
    // 00:30 IST on 1 Jan is still 19:00 UTC on 31 Dec -- the exact shape of
    // the original bug, but across a year.
    freezeAtIST(2027, 1, 1, 0, 30);
    expect(todayIST()).toBe("2027-01-01");
  });

  it("handles a leap day", () => {
    freezeAtIST(2028, 2, 29, 3, 0);
    expect(todayIST()).toBe("2028-02-29");
  });
});

describe("daysAgoIST", () => {
  beforeEach(() => {
    freezeAtIST(2026, 8, 14, 2, 0); // inside the historically broken window
  });

  it("returns today for n = 0", () => {
    expect(daysAgoIST(0)).toBe("2026-08-14");
    expect(daysAgoIST(0)).toBe(todayIST());
  });

  it("returns yesterday for n = 1", () => {
    expect(daysAgoIST(1)).toBe("2026-08-13");
  });

  it("matches the 14-day penalty lookback window", () => {
    // The penalty sweep queries date >= daysAgoIST(14).
    expect(daysAgoIST(14)).toBe("2026-07-31");
  });

  it("walks back across a month boundary", () => {
    expect(daysAgoIST(13)).toBe("2026-08-01");
    expect(daysAgoIST(15)).toBe("2026-07-30");
  });

  it("walks back across a year boundary", () => {
    freezeAtIST(2027, 1, 2, 1, 0);
    expect(daysAgoIST(1)).toBe("2027-01-01");
    expect(daysAgoIST(2)).toBe("2026-12-31");
    expect(daysAgoIST(3)).toBe("2026-12-30");
  });

  it("produces a strictly decreasing sequence with no gaps or repeats", () => {
    const seen = Array.from({ length: 20 }, (_, i) => daysAgoIST(i));
    expect(new Set(seen).size).toBe(20);
    const sortedDesc = [...seen].sort().reverse();
    expect(seen).toEqual(sortedDesc);
  });
});

describe("yesterdayIST", () => {
  it("equals daysAgoIST(1)", () => {
    freezeAtIST(2026, 8, 14, 4, 0);
    expect(yesterdayIST()).toBe("2026-08-13");
    expect(yesterdayIST()).toBe(daysAgoIST(1));
  });
});

describe("dayOfWeekIST", () => {
  it("returns 0 for Sunday through 6 for Saturday", () => {
    // 16 Aug 2026 is a Sunday.
    freezeAtIST(2026, 8, 16, 12, 0);
    expect(dayOfWeekIST()).toBe(0);
    freezeAtIST(2026, 8, 14, 12, 0); // Friday
    expect(dayOfWeekIST()).toBe(5);
    freezeAtIST(2026, 8, 15, 12, 0); // Saturday
    expect(dayOfWeekIST()).toBe(6);
  });

  it("uses the IST day even when UTC is still on the previous day", () => {
    // 00:30 IST Sunday 16 Aug == 19:00 UTC Saturday 15 Aug.
    // A local getDay() on the shifted epoch would report Saturday here.
    freezeAtIST(2026, 8, 16, 0, 30);
    expect(dayOfWeekIST()).toBe(0); // Sunday, not 6
  });

  it("drives the weekly summary correctly (Sunday check)", () => {
    // weekly-summary.ts only fires when dayOfWeekIST() === 0.
    freezeAtIST(2026, 8, 16, 0, 5); // just after midnight IST on Sunday
    expect(dayOfWeekIST()).toBe(0);
  });
});

describe("endOfDayIST", () => {
  it("returns 00:00 IST of the following day as a real instant", () => {
    // End of 14 Aug IST == 18:30:00Z on 14 Aug.
    expect(endOfDayIST("2026-08-14").toISOString()).toBe(
      "2026-08-14T18:30:00.000Z"
    );
  });

  it("rolls correctly at a month end", () => {
    expect(endOfDayIST("2026-08-31").toISOString()).toBe(
      "2026-08-31T18:30:00.000Z"
    );
  });

  it("rolls correctly at a year end", () => {
    expect(endOfDayIST("2026-12-31").toISOString()).toBe(
      "2026-12-31T18:30:00.000Z"
    );
  });

  it("handles February in a leap year", () => {
    expect(endOfDayIST("2028-02-28").toISOString()).toBe(
      "2028-02-28T18:30:00.000Z"
    );
    expect(endOfDayIST("2028-02-29").toISOString()).toBe(
      "2028-02-29T18:30:00.000Z"
    );
  });

  it("handles February in a non-leap year", () => {
    expect(endOfDayIST("2027-02-28").toISOString()).toBe(
      "2027-02-28T18:30:00.000Z"
    );
  });

  it("is always exactly 24h after the previous day's end", () => {
    const a = endOfDayIST("2026-08-30").getTime();
    const b = endOfDayIST("2026-08-31").getTime();
    expect(b - a).toBe(24 * 60 * 60 * 1000);
  });

  it("does not depend on the current clock", () => {
    freezeAtIST(2020, 1, 1, 0, 0);
    const first = endOfDayIST("2026-08-14").toISOString();
    freezeAtIST(2030, 6, 15, 23, 59);
    expect(endOfDayIST("2026-08-14").toISOString()).toBe(first);
  });
});

describe("nextMidnightIST", () => {
  it("is the upcoming IST midnight, early in the day", () => {
    freezeAtIST(2026, 8, 14, 1, 0);
    expect(nextMidnightIST().toISOString()).toBe("2026-08-14T18:30:00.000Z");
  });

  it("is the same instant late in the same IST day", () => {
    freezeAtIST(2026, 8, 14, 23, 0);
    expect(nextMidnightIST().toISOString()).toBe("2026-08-14T18:30:00.000Z");
  });

  it("moves to the following day once midnight has passed", () => {
    freezeAtIST(2026, 8, 15, 0, 0, 0);
    expect(nextMidnightIST().toISOString()).toBe("2026-08-15T18:30:00.000Z");
  });

  it("is always in the future", () => {
    for (const hh of [0, 6, 12, 18, 23]) {
      freezeAtIST(2026, 8, 14, hh, 30);
      expect(nextMidnightIST().getTime()).toBeGreaterThan(Date.now());
    }
  });
});

describe("istTimeToInstant", () => {
  it("converts an IST wall-clock time to the right instant", () => {
    // 07:00 IST == 01:30 UTC.
    expect(istTimeToInstant("2026-08-14", "07:00").toISOString()).toBe(
      "2026-08-14T01:30:00.000Z"
    );
  });

  it("adds the grace period", () => {
    // 07:00 IST + 30m grace == 02:00 UTC. This is the check-in deadline shape.
    expect(istTimeToInstant("2026-08-14", "07:00", 30).toISOString()).toBe(
      "2026-08-14T02:00:00.000Z"
    );
  });

  it("defaults grace to zero", () => {
    expect(istTimeToInstant("2026-08-14", "07:00").getTime()).toBe(
      istTimeToInstant("2026-08-14", "07:00", 0).getTime()
    );
  });

  it("handles midnight IST, which falls on the previous UTC day", () => {
    expect(istTimeToInstant("2026-08-14", "00:00").toISOString()).toBe(
      "2026-08-13T18:30:00.000Z"
    );
  });

  it("agrees with endOfDayIST when given 00:00 of the next day", () => {
    expect(istTimeToInstant("2026-08-15", "00:00").getTime()).toBe(
      endOfDayIST("2026-08-14").getTime()
    );
  });

  it("lets grace push the deadline past IST midnight", () => {
    // 23:30 IST + 60m grace == 00:30 IST the next day == 19:00Z same UTC day.
    expect(istTimeToInstant("2026-08-14", "23:30", 60).toISOString()).toBe(
      "2026-08-14T19:00:00.000Z"
    );
  });

  it("handles a late-evening time (the case that used to exceed 1440 minutes)", () => {
    // The old dashboard compared minutes-of-day and could exceed 1440, so
    // late-evening deadlines never fired.
    expect(istTimeToInstant("2026-08-14", "23:59").toISOString()).toBe(
      "2026-08-14T18:29:00.000Z"
    );
  });

  it("handles single-digit hours and minutes", () => {
    expect(istTimeToInstant("2026-08-14", "09:05").toISOString()).toBe(
      "2026-08-14T03:35:00.000Z"
    );
  });

  it("does not depend on the current clock", () => {
    freezeAtIST(2020, 1, 1, 0, 0);
    const first = istTimeToInstant("2026-08-14", "07:00", 30).toISOString();
    freezeAtIST(2030, 6, 15, 23, 59);
    expect(istTimeToInstant("2026-08-14", "07:00", 30).toISOString()).toBe(
      first
    );
  });
});

describe("msUntilNextMidnightIST", () => {
  it("is a full day at exactly midnight IST", () => {
    freezeAtIST(2026, 8, 14, 0, 0, 0);
    expect(msUntilNextMidnightIST()).toBe(24 * 60 * 60 * 1000);
  });

  it("counts down correctly mid-day", () => {
    freezeAtIST(2026, 8, 14, 23, 0, 0);
    expect(msUntilNextMidnightIST()).toBe(60 * 60 * 1000); // 1h left
  });

  it("is one millisecond before midnight", () => {
    vi.setSystemTime(new Date(atIST(2026, 8, 15, 0, 0, 0).getTime() - 1));
    expect(msUntilNextMidnightIST()).toBe(1);
  });

  it("is never negative and never more than 24h", () => {
    for (const [hh, mm] of [
      [0, 0],
      [5, 29],
      [12, 0],
      [23, 59],
    ]) {
      freezeAtIST(2026, 8, 14, hh, mm);
      const ms = msUntilNextMidnightIST();
      expect(ms).toBeGreaterThanOrEqual(0);
      expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    }
  });

  it("is a usable setTimeout delay for the dashboard rollover", () => {
    // The dashboard schedules setTimeout(..., msUntilNextMidnightIST() + 1000).
    // Landing there must put todayIST() on the NEXT day.
    freezeAtIST(2026, 8, 14, 22, 15);
    const delay = msUntilNextMidnightIST() + 1000;
    vi.setSystemTime(new Date(Date.now() + delay));
    expect(todayIST()).toBe("2026-08-15");
  });
});

describe("cross-function consistency", () => {
  it("nextMidnightIST equals endOfDayIST(todayIST())", () => {
    for (const hh of [0, 3, 12, 23]) {
      freezeAtIST(2026, 8, 14, hh, 17);
      expect(nextMidnightIST().getTime()).toBe(
        endOfDayIST(todayIST()).getTime()
      );
    }
  });

  it("stepping through a whole IST day never skips or repeats a date", () => {
    const dates = new Set<string>();
    for (let hh = 0; hh < 24; hh++) {
      freezeAtIST(2026, 8, 14, hh, 0);
      dates.add(todayIST());
    }
    expect([...dates]).toEqual(["2026-08-14"]);
  });

  it("a task dated today is never already past its midnight deadline", () => {
    // Guards the penalty engine: a task created at any hour today must not be
    // sweepable as "missed" until IST midnight has actually passed.
    for (const hh of [0, 1, 5, 12, 23]) {
      freezeAtIST(2026, 8, 14, hh, 30);
      expect(endOfDayIST(todayIST()).getTime()).toBeGreaterThan(Date.now());
    }
  });
});
