import {
  addDays,
  computeMarkerFlag,
  daysBetween,
  toDateString,
} from "@/types/health";

describe("computeMarkerFlag", () => {
  it("flags a value exactly at the reference low edge as normal", () => {
    expect(computeMarkerFlag(10, 10, 20)).toBe("normal");
  });

  it("flags a value just below the reference low edge as low", () => {
    expect(computeMarkerFlag(9.9, 10, 20)).toBe("low");
  });

  it("flags a value exactly at the reference high edge as normal", () => {
    expect(computeMarkerFlag(20, 10, 20)).toBe("normal");
  });

  it("flags a value just above the reference high edge as high", () => {
    expect(computeMarkerFlag(20.1, 10, 20)).toBe("high");
  });

  it("flags a value safely in the normal middle as normal", () => {
    expect(computeMarkerFlag(15, 10, 20)).toBe("normal");
  });

  it("treats an undefined refLow as no lower bound", () => {
    expect(computeMarkerFlag(-1000, undefined, 20)).toBe("normal");
  });

  it("treats an undefined refHigh as no upper bound", () => {
    expect(computeMarkerFlag(1000, 10, undefined)).toBe("normal");
  });

  it("returns normal when neither reference bound is given", () => {
    expect(computeMarkerFlag(42)).toBe("normal");
  });
});

describe("toDateString", () => {
  it("formats a date as YYYY-MM-DD with zero-padded month and day", () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("pads single-digit months and days", () => {
    expect(toDateString(new Date(2025, 8, 9))).toBe("2025-09-09");
  });

  it("formats December correctly (no month rollover)", () => {
    expect(toDateString(new Date(2025, 11, 31))).toBe("2025-12-31");
  });
});

describe("daysBetween", () => {
  it("returns 0 for the same date", () => {
    expect(daysBetween("2026-07-10", "2026-07-10")).toBe(0);
  });

  it("returns a positive count when b is later than a", () => {
    expect(daysBetween("2026-07-10", "2026-07-15")).toBe(5);
  });

  it("returns a negative count when b is earlier than a", () => {
    expect(daysBetween("2026-07-15", "2026-07-10")).toBe(-5);
  });

  it("handles a month rollover", () => {
    expect(daysBetween("2026-01-28", "2026-02-02")).toBe(5);
  });

  it("handles a year rollover", () => {
    expect(daysBetween("2025-12-30", "2026-01-02")).toBe(3);
  });

  it("handles a leap-year February correctly", () => {
    // 2028 is a leap year, so Feb has 29 days.
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
  });
});

describe("addDays", () => {
  it("adds a positive number of days within the same month", () => {
    expect(addDays("2026-07-10", 5)).toBe("2026-07-15");
  });

  it("subtracts days when n is negative", () => {
    expect(addDays("2026-07-10", -5)).toBe("2026-07-05");
  });

  it("rolls over into the next month", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
  });

  it("rolls over into the previous month when subtracting", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("rolls over into the next year", () => {
    expect(addDays("2025-12-30", 3)).toBe("2026-01-02");
  });

  it("rolls over into the previous year", () => {
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("handles leap-year rollover (Feb 29 exists in 2028)", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("handles non-leap-year February rollover", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("adding 0 days returns the same date", () => {
    expect(addDays("2026-07-10", 0)).toBe("2026-07-10");
  });
});
