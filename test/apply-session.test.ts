import { describe, expect, it } from "vitest";
import { jobSearches } from "~/lib/job-search";
import { sessionProgress, type ApplySessionState } from "~/lib/state/apply-session";

const session = (target: ApplySessionState["target"], applied = 0): ApplySessionState => ({
  startedAt: 0,
  endedAt: null,
  target,
  applied: Array.from({ length: applied }, (_, i) => ({ id: String(i), company: "Acme", role: "Engineer" })),
  dropped: [],
  skippedAt: {},
  ticked: {},
});

describe("apply session", () => {
  it("measures a count target by applications and a time target by minutes", () => {
    expect(sessionProgress(session({ kind: "count", value: 4 }, 2), 60_000)).toMatchObject({ share: 0.5, reached: false });
    expect(sessionProgress(session({ kind: "minutes", value: 30 }), 30 * 60_000)).toMatchObject({ share: 1, reached: true });
  });

  it("builds past-week searches for each role, with the location when there is one", () => {
    const [search] = jobSearches(["Software Engineer"], "London");
    expect(search.links.map((link) => link.site)).toEqual(["LinkedIn", "Indeed", "Google"]);
    expect(search.links[0].url).toBe("https://www.linkedin.com/jobs/search/?keywords=Software%20Engineer&location=London&f_TPR=r604800");
    expect(jobSearches(["Designer"], "")[0].links[1].url).not.toContain("&l=");
  });
});
