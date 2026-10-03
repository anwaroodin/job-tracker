import { describe, expect, it } from "vitest";
import { isSyncHour } from "~/server/gmail/sync/schedule.server";

const env = (vars: Partial<Env> = {}) => vars as Env;
const london = (iso: string) => new Date(iso);

describe("isSyncHour", () => {
  it("allows automatic syncs from 07:00 to 23:00 UK time by default", () => {
    expect(isSyncHour(env(), london("2026-01-15T06:59:00Z"))).toBe(false);
    expect(isSyncHour(env(), london("2026-01-15T07:00:00Z"))).toBe(true);
    expect(isSyncHour(env(), london("2026-01-15T22:59:00Z"))).toBe(true);
    expect(isSyncHour(env(), london("2026-01-15T23:00:00Z"))).toBe(false);
  });

  it("follows the time zone through daylight saving", () => {
    expect(isSyncHour(env(), london("2026-07-15T06:30:00Z"))).toBe(true);
    expect(isSyncHour(env(), london("2026-07-15T22:30:00Z"))).toBe(false);
  });

  it("takes custom hours and time zone, including windows past midnight", () => {
    expect(isSyncHour(env({ SYNC_HOURS: "9-17", SYNC_TIMEZONE: "America/New_York" }), london("2026-01-15T14:00:00Z"))).toBe(true);
    expect(isSyncHour(env({ SYNC_HOURS: "9-17", SYNC_TIMEZONE: "America/New_York" }), london("2026-01-15T23:00:00Z"))).toBe(false);
    expect(isSyncHour(env({ SYNC_HOURS: "20-2" }), london("2026-01-15T01:00:00Z"))).toBe(true);
    expect(isSyncHour(env({ SYNC_HOURS: "20-2" }), london("2026-01-15T12:00:00Z"))).toBe(false);
  });

  it("falls back to the default hours when the setting is malformed", () => {
    expect(isSyncHour(env({ SYNC_HOURS: "soon" }), london("2026-01-15T03:00:00Z"))).toBe(false);
    expect(isSyncHour(env({ SYNC_HOURS: "soon" }), london("2026-01-15T12:00:00Z"))).toBe(true);
  });
});
