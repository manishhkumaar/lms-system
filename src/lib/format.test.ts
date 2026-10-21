import { describe, expect, it } from "vitest";
import { formatDate, formatDuration, formatINR, formatNumber, formatRange24, formatTimeRange, formatWhen, seatsLabel } from "./format";
import { addDays, dateKey, tzLabel, weekdayOf, zonedISO, zoneOffsetMinutes } from "./time";

describe("format", () => {
  it("uses Indian digit grouping and ₹", () => {
    expect(formatNumber(128400)).toBe("1,28,400");
    expect(formatINR(85000)).toBe("₹85,000");
    expect(seatsLabel(42, 50)).toBe("42 of 50 seats filled");
  });

  it("reads dates day-month", () => {
    expect(formatDate("2026-10-21")).toBe("21 Oct 2026");
    expect(formatDate("2026-10-21T18:30:00+05:30")).toBe("21 Oct 2026");
  });

  it("gives every time a zone and an end", () => {
    const s = "2026-10-21T18:30:00+05:30";
    const e = "2026-10-21T20:00:00+05:30";
    expect(formatWhen(s, e)).toBe("Wed, 21 Oct · 6:30–8:00 PM IST");
    expect(formatRange24(s, e)).toBe("18:30–20:00");
    expect(formatTimeRange("2026-10-21T11:30:00+05:30", "2026-10-21T13:00:00+05:30")).toBe("11:30 AM–1:00 PM");
  });

  it("formats durations", () => {
    expect(formatDuration(88)).toBe("1h 28m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(120)).toBe("2h");
  });
});

describe("time", () => {
  it("builds zoned ISO timestamps", () => {
    expect(zonedISO("2026-10-23", "18:30", "Asia/Kolkata")).toBe("2026-10-23T18:30:00+05:30");
    expect(zonedISO("2026-10-23", "09:00", "Asia/Dubai")).toBe("2026-10-23T09:00:00+04:00");
    expect(new Date(zonedISO("2026-07-01", "10:00", "Europe/London")).toISOString()).toBe("2026-07-01T09:00:00.000Z");
  });

  it("knows offsets and labels", () => {
    expect(zoneOffsetMinutes("Asia/Kolkata")).toBe(330);
    expect(tzLabel("Asia/Kolkata")).toBe("IST");
  });

  it("does calendar arithmetic", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(weekdayOf("2026-10-21")).toBe("Wed");
    expect(dateKey("2026-10-21T23:30:00Z", "Asia/Kolkata")).toBe("2026-10-22");
  });
});
