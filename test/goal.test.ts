import { describe, expect, it } from "vitest";
import { clearBookmarkOnApply } from "~/server/services/status/rules";
import { cleanWeeklyGoal, goalNotice, goalProgress } from "~/lib/goal";

const weeks = (...counts: number[]) => counts.map((count, i) => ({ weekStart: `2026-01-${String(i + 1).padStart(2, "0")}`, count }));
const wednesday = new Date("2026-11-18T12:00:00Z");

describe("weekly goal", () => {
  it("counts the streak of past weeks that hit the goal", () => {
    expect(goalProgress(weeks(5, 2, 5, 6, 1), 5, wednesday).streak).toBe(2);
  });

  it("adds this week to the streak once the goal is hit", () => {
    const progress = goalProgress(weeks(5, 5, 5), 5, wednesday);
    expect([progress.hit, progress.streak, progress.remaining]).toEqual([true, 3, 0]);
  });

  it("works out the pace for the rest of the week", () => {
    const progress = goalProgress(weeks(0, 1), 10, wednesday);
    expect([progress.daysLeft, progress.remaining, progress.perDay, progress.onTrack]).toEqual([5, 9, 2, false]);
  });

  it("rejects goals outside 1 to 100", () => {
    expect([cleanWeeklyGoal("5"), cleanWeeklyGoal("0"), cleanWeeklyGoal("abc"), cleanWeeklyGoal(500)]).toEqual([5, null, null, null]);
  });
});

describe("goal notices", () => {
  const at = (iso: string) => new Date(iso);
  const twoWeeks = (last: number, now: number) => [{ weekStart: "2026-11-09T00:00:00.000Z", count: last }, { weekStart: "2026-11-16T00:00:00.000Z", count: now }];

  it("sends the weekly review on Monday", () => {
    expect(goalNotice(twoWeeks(4, 0), 5, at("2026-11-16T09:00:00Z"))).toMatchObject({ key: "review-2026-11-16", body: "You applied to 4 of 5 last week" });
  });

  it("warns when behind from Thursday, and on the last day", () => {
    expect(goalNotice(twoWeeks(0, 1), 5, at("2026-11-18T09:00:00Z"))).toBeNull();
    expect(goalNotice(twoWeeks(0, 1), 5, at("2026-11-19T09:00:00Z"))?.key).toBe("behind-2026-11-16");
    expect(goalNotice(twoWeeks(0, 1), 5, at("2026-11-22T09:00:00Z"))?.key).toBe("last-day-2026-11-16");
  });

  it("celebrates once the goal is hit", () => {
    expect(goalNotice(twoWeeks(5, 5), 5, at("2026-11-20T09:00:00Z"))).toMatchObject({ key: "hit-2026-11-16", body: "2 weeks in a row" });
  });
});

describe("leaving saved", () => {
  it("dates the application when it's applied to, not when it was saved", () => {
    expect(clearBookmarkOnApply("saved", { status: "applied", manualStatusAt: "2026-11-17T10:00:00.000Z" })).toMatchObject({ appliedAt: "2026-11-17T10:00:00.000Z", starred: false });
    expect(clearBookmarkOnApply("applied", { status: "interview" }).appliedAt).toBeUndefined();
  });
});
