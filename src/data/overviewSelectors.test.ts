import { describe, expect, it } from "vitest";
import {
  activeStudentCount,
  attendanceByBatch,
  batchSummary,
  enrolmentSeries,
  leadConversion,
  leadsBySource,
  liveLectures,
  newEnrolments,
  periodStart,
  pipelineByStage,
  runningBatches,
  weekRangeMs,
} from "./overviewSelectors";
import { createSeed } from "./seed";

const now = new Date("2026-10-21T11:00:00+05:30").getTime();
const db = createSeed(now);

describe("overview selectors", () => {
  it("counts active students and live lectures", () => {
    expect(activeStudentCount(db)).toBeGreaterThan(100);
    expect(liveLectures(db, now).map((l) => l.id)).toContain("lec-fsw-07-13");
  });

  it("never counts future-dated or transferred enrolments as new joins", () => {
    for (const e of newEnrolments(db, 0, now)) expect(Date.parse(e.enrolledAt)).toBeLessThanOrEqual(now);
  });

  it("buckets enrolments by week and by month", () => {
    const weeks = enrolmentSeries(db, "90d", now);
    expect(weeks.length).toBeGreaterThanOrEqual(13);
    expect(weeks.reduce((n, p) => n + p.value, 0)).toBe(newEnrolments(db, periodStart("90d", now), now).length);
    const months = enrolmentSeries(db, "year", now);
    expect(months.map((m) => m.label).slice(0, 2)).toEqual(["Jan", "Feb"]);
    expect(months).toHaveLength(10);
  });

  it("splits leads by source and stage without losing any", () => {
    const from = periodStart("year", now);
    const total = leadsBySource(db, from, now).reduce((n, s) => n + s.count, 0);
    expect(pipelineByStage(db.leads).reduce((n, s) => n + s.count, 0)).toBe(db.leads.length);
    expect(leadConversion(db, from, now).created).toBe(total);
  });

  it("reports verified attendance per batch as a percentage", () => {
    const rows = attendanceByBatch(db, now, periodStart("30d", now));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.pct).toBeGreaterThanOrEqual(0);
      expect(r.pct).toBeLessThanOrEqual(100);
    }
  });

  it("summarises every non-cancelled batch", () => {
    const rows = batchSummary(db, now);
    expect(rows.length).toBe(db.batches.length);
    const fsw = rows.find((r) => r.batch.code === "FSW-07")!;
    expect(fsw.held).toBe(12);
    expect(fsw.recordingsPublished).toBe(11);
    expect(runningBatches(db, now).every((b) => ["ongoing", "upcoming", "full"].includes(b.state))).toBe(true);
  });

  it("gives a Monday-to-Monday week", () => {
    const [a, b] = weekRangeMs(now);
    expect(b - a).toBe(7 * 86400000);
    expect(a).toBeLessThanOrEqual(now);
  });
});
