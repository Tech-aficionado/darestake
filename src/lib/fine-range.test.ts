import { describe, it, expect } from "vitest";
import {
  fineRange,
  DEFAULT_MIN_FINE,
  DEFAULT_MAX_FINE,
  FINE_LIMIT_MIN,
  FINE_LIMIT_MAX,
} from "@/lib/firestore-schema";

/**
 * fineRange resolves the [min, max] a missed dare can cost. The penalty engine
 * feeds its output straight into
 *     Math.floor(Math.random() * (max - min + 1)) + min
 * so an inverted or non-integer range would produce negative or fractional
 * fines against real money. These tests pin the clamping down.
 */
describe("fineRange", () => {
  it("uses the documented defaults when unset", () => {
    expect(fineRange(undefined)).toEqual({
      min: DEFAULT_MIN_FINE,
      max: DEFAULT_MAX_FINE,
    });
  });

  it("keeps the default floor for any max above it", () => {
    expect(fineRange(500)).toEqual({ min: DEFAULT_MIN_FINE, max: 500 });
    expect(fineRange(11)).toEqual({ min: DEFAULT_MIN_FINE, max: 11 });
  });

  it("clamps the floor down when the max is below it", () => {
    // Without this the range inverts and the random span goes negative.
    expect(fineRange(5)).toEqual({ min: 5, max: 5 });
    expect(fineRange(1)).toEqual({ min: 1, max: 1 });
  });

  it("never returns an inverted range", () => {
    for (const v of [1, 2, 5, 9, 10, 11, 50, 999, 100_000]) {
      const { min, max } = fineRange(v);
      expect(max).toBeGreaterThanOrEqual(min);
    }
  });

  it("always yields a non-negative random span", () => {
    // This is the exact expression the penalty engine evaluates.
    for (const v of [1, 5, 10, 50, 1000]) {
      const { min, max } = fineRange(v);
      expect(max - min + 1).toBeGreaterThan(0);
    }
  });

  it("clamps out-of-range values instead of trusting them", () => {
    expect(fineRange(0).max).toBe(FINE_LIMIT_MIN);
    expect(fineRange(-100).max).toBe(FINE_LIMIT_MIN);
    expect(fineRange(999_999_999).max).toBe(FINE_LIMIT_MAX);
  });

  it("floors fractional input to whole rupees", () => {
    expect(fineRange(49.9)).toEqual({ min: DEFAULT_MIN_FINE, max: 49 });
    expect(fineRange(1.7)).toEqual({ min: 1, max: 1 });
  });

  it("produces integer bounds for integer-ish input", () => {
    for (const v of [1, 7, 50, 3000]) {
      const { min, max } = fineRange(v);
      expect(Number.isInteger(min)).toBe(true);
      expect(Number.isInteger(max)).toBe(true);
    }
  });
});
