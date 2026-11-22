import { afterEach, describe, expect, it, vi } from "vitest";
import { readJobText } from "~/lib/job-pdf";
import { readJobWithJev } from "~/server/jev/job-description.server";

describe("reading a job description PDF", () => {
  it("reads labelled fields the way recruiters lay them out", () => {
    const { job } = readJobText(
      [
        "Job Description",
        "Job Title: Full Stack Engineer",
        "Company: XYZ Reality",
        "Location: London",
        "Salary: £60,000 - £75,000 per annum",
        "Contract type:",
        "Permanent",
        "",
        "About the role",
        "We are looking for an engineer who works hybrid, three days in the office.",
      ].join("\n"),
    );
    expect(job).toMatchObject({
      company: "XYZ Reality",
      role: "Full Stack Engineer",
      location: "London",
      salary: "£60,000 - £75,000 per annum",
      employmentType: "Permanent",
      workType: "Hybrid",
    });
    expect(job.description).toContain("About the role");
  });

  it("falls back to the title line and the company's own introduction", () => {
    const { job } = readJobText(
      ["Senior Product Designer", "About Monzo", "Monzo is a bank that lives on your phone.", "This is a full time, remote role paying £70k - £85k."].join("\n"),
    );
    expect(job).toMatchObject({ company: "Monzo", role: "Senior Product Designer", salary: "£70k - £85k", workType: "Remote", employmentType: "Full-time" });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("lets Jev pick the company and title, and only asks about fields the PDF doesn't label", async () => {
    const text = [
      "Our client, Acme Robotics, is hiring",
      "Lead Backend Engineer",
      "Location: Manchester",
      "Join Acme Robotics and work with Python every day.",
      "You'll be in the office two days a week.",
    ].join("\n");
    const choice = (pick: string) => ({ type: "choice", choice: pick, probabilities: { [pick]: 0.9 }, confidence: 0.9 });
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      const { questions } = JSON.parse(String(init?.body));
      expect(Object.keys(questions).sort()).toEqual(["company", "employmentType", "role", "workType"]);
      const company = Object.entries(questions.company.criteria).find(([, name]) => name === "Acme Robotics")![0];
      const role = Object.entries(questions.role.criteria).find(([, line]) => line === "Lead Backend Engineer")![0];
      return Response.json({
        model: "jev-1",
        answers: { company: choice(company), role: choice(role), workType: choice("hybrid"), employmentType: choice("none") },
        usage: { input_tokens: 300 },
      });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { job, spend } = await readJobWithJev("key", text);

    expect(job).toMatchObject({ company: "Acme Robotics", role: "Lead Backend Engineer", location: "Manchester", workType: "Hybrid", employmentType: "" });
    expect(spend).toEqual([{ model: "jev-1", inputTokens: 300 }]);
  });
});
