import { describe, expect, it } from "vitest";
import { createSeed } from "./seed";
import { attendanceStatus, batchState, lectureState, lectureStateIn, nextLectureForStudent, seatsFilled, studentAttendance } from "./selectors";
import { liveState } from "@/design-system/components/LiveClassCard";
import type { Lecture, Recording } from "./types";

const lecture: Lecture = {
  id: "l1",
  batchId: "b1",
  number: 13,
  title: "REST APIs with Express",
  start: "2026-10-21T18:30:00+05:30",
  end: "2026-10-21T20:00:00+05:30",
  timeZone: "Asia/Kolkata",
  linkPublished: true,
  status: "scheduled",
};
const at = (iso: string) => new Date(iso).getTime();

describe("lecture state", () => {
  it("follows the live-class rule: countdown, live, then recording", () => {
    expect(lectureState(lecture, undefined, at("2026-10-21T16:31:18+05:30"))).toBe("scheduled");
    expect(lectureState({ ...lecture, linkPublished: false }, undefined, at("2026-10-21T16:31:18+05:30"))).toBe("link-missing");
    expect(lectureState(lecture, undefined, at("2026-10-21T18:42:00+05:30"))).toBe("live");
    expect(lectureState(lecture, undefined, at("2026-10-21T21:10:00+05:30"))).toBe("ended");
    const rec = { status: "processing" } as Recording;
    expect(lectureState(lecture, rec, at("2026-10-21T21:10:00+05:30"))).toBe("recording-processing");
    expect(lectureState(lecture, { ...rec, status: "ready" }, at("2026-10-21T21:10:00+05:30"))).toBe("recording-ready");
    expect(lectureState({ ...lecture, status: "cancelled" }, undefined, at("2026-10-21T18:42:00+05:30"))).toBe("cancelled");
  });

  it("matches the LiveClassCard's own state machine", () => {
    expect(liveState(lecture, at("2026-10-21T16:31:18+05:30"))).toBe("upcoming");
    expect(liveState(lecture, at("2026-10-21T18:42:00+05:30"))).toBe("live");
    expect(liveState({ ...lecture, recording: { duration: "1h 28m" } }, at("2026-10-21T21:10:00+05:30"))).toBe("recording-ready");
  });
});

describe("batch state", () => {
  const b = { startDate: "2026-11-10", endDate: "2027-01-10", capacity: 30, lifecycle: "active" } as never;
  it("derives upcoming / full / ongoing / completed from dates and seats", () => {
    expect(batchState(b, 10, at("2026-10-21T12:00:00+05:30"))).toBe("upcoming");
    expect(batchState(b, 30, at("2026-10-21T12:00:00+05:30"))).toBe("full");
    expect(batchState(b, 30, at("2026-12-01T12:00:00+05:30"))).toBe("ongoing");
    expect(batchState(b, 30, at("2027-02-01T12:00:00+05:30"))).toBe("completed");
    expect(batchState({ ...(b as object), lifecycle: "draft" } as never, 0, at("2026-10-21T12:00:00+05:30"))).toBe("draft");
  });
});

describe("attendance", () => {
  it("never counts a Join click as attendance", () => {
    expect(attendanceStatus({ id: "a", lectureId: "l", studentId: "s", joinedAt: "x", verification: "unverified" })).toBe("joined");
    expect(attendanceStatus({ id: "a", lectureId: "l", studentId: "s", joinedAt: "x", verification: "absent" })).toBe("absent");
    expect(attendanceStatus({ id: "a", lectureId: "l", studentId: "s", verification: "present" })).toBe("present");
    expect(attendanceStatus(undefined)).toBe("unverified");
  });
});

describe("seed", () => {
  const now = at("2026-10-21T11:00:00+05:30");
  const db = createSeed(now);

  it("has a lecture live right now with its link published", () => {
    const live = db.lectures.find((l) => l.id === "lec-fsw-07-13")!;
    expect(lectureStateIn(db, live, now)).toBe("live");
  });

  it("shows the next lecture without a link", () => {
    const l14 = db.lectures.find((l) => l.id === "lec-fsw-07-14")!;
    expect(lectureStateIn(db, l14, now)).toBe("link-missing");
  });

  it("leaves the last finished FSW-07 lecture waiting for its recording", () => {
    const l12 = db.lectures.find((l) => l.id === "lec-fsw-07-12")!;
    expect(lectureStateIn(db, l12, now)).toBe("ended");
  });

  it("gives Priya a live class to join", () => {
    const priya = db.users.find((u) => u.email === "priya@example.in")!;
    expect(nextLectureForStudent(db, priya.studentId!, now)?.id).toBe("lec-fsw-07-13");
    const s = studentAttendance(db, priya.studentId!, "bat-fsw-07", now);
    expect(s.held).toBe(12);
    expect(s.pct).toBeGreaterThan(50);
  });

  it("fills seats as planned and never overfills", () => {
    expect(seatsFilled(db, "bat-fsw-07")).toBe(42);
    expect(batchState(db.batches.find((b) => b.id === "bat-dap-04")!, seatsFilled(db, "bat-dap-04"), now)).toBe("full");
    for (const b of db.batches) expect(seatsFilled(db, b.id)).toBeLessThanOrEqual(b.capacity);
  });

  it("links enrolled leads to their students", () => {
    const enrolled = db.leads.filter((l) => l.stage === "enrolled");
    expect(enrolled.length).toBeGreaterThan(3);
    for (const l of enrolled) expect(db.students.some((s) => s.id === l.studentId)).toBe(true);
  });

  it("uses unique ids", () => {
    for (const key of ["users", "students", "lectures", "leads", "enrolments", "attendance", "recordings"] as const) {
      const ids = (db[key] as Array<{ id: string }>).map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
