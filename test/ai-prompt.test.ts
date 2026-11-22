import { describe, expect, it } from "vitest";
import { aiPrompt } from "~/lib/ai-prompt";

const cv = {
  summary: "Backend engineer.",
  experience: [{ id: "e", company: "Acme", title: "Engineer", start: "2022", end: null, location: "London", url: "", bullets: [{ id: "b", text: "Built billing APIs in Go" }] }],
  education: [],
  projects: [{ id: "p", name: "Hidden", url: "", subtitle: "", details: "", bullets: [{ id: "x", text: "Reserve work" }], optional: true }],
  skills: [{ id: "s", label: "Languages", items: ["Go", "TypeScript"] }],
  certifications: [],
};

describe("AI prompt", () => {
  it("puts the job and the CV together, leaving out reserve projects", () => {
    const prompt = aiPrompt({
      job: { company: "Stripe", role: "Backend Engineer", location: "Remote", salary: "", workType: "", employmentType: "", url: "https://x.test/job", description: "We need Go." },
      cv,
      tailored: true,
      confirmed: [{ term: "Kubernetes", has: true, detail: "Ran clusters" }, { term: "Rust", has: false, detail: "" }],
      name: "Sam",
      eligibility: { rightToWork: true, requiresSponsorship: false, noticePeriod: "1 month", availableImmediately: false, salary: "" },
    });
    expect(prompt).toContain("I'm applying for Backend Engineer at Stripe.");
    expect(prompt).toContain("We need Go.");
    expect(prompt).toContain("# My CV (already tailored to this job)");
    expect(prompt).toContain("### Engineer, Acme (London) · 2022 – Present\n- Built billing APIs in Go");
    expect(prompt).toContain("- Languages: Go, TypeScript");
    expect(prompt).toContain("- Kubernetes: Ran clusters");
    expect(prompt).toContain("Notice period: 1 month");
    expect(prompt).not.toMatch(/Reserve work|Rust/);
  });
});
