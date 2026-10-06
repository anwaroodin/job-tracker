import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCv, saveCv } from "~/server/db/queries/profile.server";
import { askJev } from "~/server/jev/client.server";
import { cleanCv } from "~/server/cv/clean";
import { importCv } from "~/server/cv/import.server";
import {
  findDates,
  finalize,
  headingSection,
  projectFields,
  spans,
  splitLines,
  splitSkills,
  structure,
  type LineKind,
} from "~/server/cv/parse";
import { testDb, USER_ID } from "./db";

vi.mock("~/server/jev/client.server", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  askJev: vi.fn(),
}));

const JEV_ENV = { TYPESAFE_API_KEY: "key" } as Env;

const CV_TEXT = `Jane Doe
jane@example.com | 07700 900000
Profile
Frontend developer who ships accessible, fast
interfaces for retail brands.
Experience
Senior Frontend Developer | Acme Ltd | London
Jan 2021 – Present
• Rebuilt the checkout in React, cutting drop-off by 18%
• Led a team of 4 engineers
Junior Developer, Widgets Co
2018 - 2020
• Maintained the design system
Education
BSc Computer Science
University of Leeds, 2014 – 2017
Skills
Languages: TypeScript, JavaScript, CSS
React; Node.js`;

const KINDS: Record<string, LineKind> = {
  "Jane Doe": "contact",
  "jane@example.com | 07700 900000": "contact",
  Profile: "heading",
  "Frontend developer who ships accessible, fast": "summary",
  "interfaces for retail brands.": "summary",
  Experience: "heading",
  "Senior Frontend Developer | Acme Ltd | London": "entry",
  "Jan 2021 – Present": "entry",
  "Rebuilt the checkout in React, cutting drop-off by 18%": "bullet",
  "Led a team of 4 engineers": "bullet",
  "Junior Developer, Widgets Co": "entry",
  "2018 - 2020": "entry",
  "Maintained the design system": "bullet",
  Education: "heading",
  "BSc Computer Science": "entry",
  "University of Leeds, 2014 – 2017": "entry",
  Skills: "heading",
  "Languages: TypeScript, JavaScript, CSS": "skills",
  "React; Node.js": "skills",
};

const PICKS: Record<string, string> = {
  "Senior Frontend Developer": "title",
  "Acme Ltd": "company",
  London: "location",
  "Junior Developer": "title",
  "Widgets Co": "company",
  "BSc Computer Science": "qualification",
  "University of Leeds": "institution",
};

function fakeJev() {
  vi.mocked(askJev).mockImplementation(async (_key, state, questions) => {
    const answers: Record<string, unknown> = {};
    const { lines } = state as { lines?: string[] };
    for (const [key, question] of Object.entries(questions)) {
      const [field, n] = key.split("_");
      if (field === "kind") answers[key] = { type: "choice", choice: KINDS[lines![Number(n)]] ?? "other", probabilities: {}, confidence: 1 };
      else if (field === "cont") answers[key] = { type: "noul", noul: lines![Number(n)] === "interfaces for retail brands." ? 0.9 : 0.1 };
      else {
        const criteria = (question as { criteria: Record<string, string> }).criteria;
        const hit = Object.entries(criteria).find(([, text]) => PICKS[text.replace(/"/g, "")] === field);
        const choice = hit?.[0] ?? "none";
        answers[key] = { type: "choice", choice, probabilities: { [choice]: 0.9 }, confidence: 0.9 };
      }
    }
    return { model: "jev-test", answers, inputTokens: 100 } as Awaited<ReturnType<typeof askJev>>;
  });
}

beforeEach(() => {
  vi.mocked(askJev).mockReset();
});

describe("parsing helpers", () => {
  it("splits lines, dropping bullet glyphs and blank lines but remembering them", () => {
    expect(splitLines("• One\n\n  - Two  three \r\n▪Four\n-5% churn")).toEqual([
      { text: "One", bullet: true },
      { text: "Two three", bullet: true },
      { text: "Four", bullet: true },
      { text: "-5% churn", bullet: false },
    ]);
  });

  it("recognises common section headings and nothing else", () => {
    expect(headingSection("Work Experience")).toBe("experience");
    expect(headingSection("Technical Skills:")).toBe("skills");
    expect(headingSection("Education & Training")).toBe("education");
    expect(headingSection("Hobbies")).toBe("skills");
    expect(headingSection("References")).toBe("other");
  });

  it("reads date ranges as written, with open-ended ranges ending in null", () => {
    expect(findDates("Jan 2021 – Present")).toEqual({ start: "Jan 2021", end: null });
    expect(findDates("2018 - 2020")).toEqual({ start: "2018", end: "2020" });
    expect(findDates("Graduated 2017")).toEqual({ start: "", end: "2017" });
  });

  it("splits an entry line into candidate spans without dates", () => {
    expect(spans("Senior Developer | Acme Ltd | Jan 2021 – Present")).toEqual([
      "Senior Developer",
      "Acme Ltd",
      "Senior Developer | Acme Ltd",
    ]);
    expect(spans("Engineer at Acme")).toContain("Acme");
  });

  it("splits skill lists, keeping their label as the group", () => {
    expect(splitSkills("Languages: TypeScript, JavaScript; CSS")).toEqual({ label: "Languages", items: ["TypeScript", "JavaScript", "CSS"] });
    expect(splitSkills("React, Go")).toEqual({ label: "Skills", items: ["React", "Go"] });
  });

  it("reads a project's link or subtitle and its tech stack", () => {
    expect(projectFields(["Plant Diary (plantdiary.app)", "(Go, SQLite)"])).toEqual({
      name: "Plant Diary",
      url: "plantdiary.app",
      subtitle: "",
      details: "Go, SQLite",
    });
    expect(projectFields(["Group Project (Library Booking System)"])).toMatchObject({
      name: "Group Project",
      url: "",
      subtitle: "Library Booking System",
    });
  });

  it("starts a new entry after bullets and attaches bullets to the entry above", () => {
    const lines = ["Experience", "Dev, Acme", "Did a thing", "Dev, Other", "Did another"];
    const kinds: LineKind[] = ["heading", "entry", "bullet", "entry", "bullet"];
    const parsed = structure(lines, kinds.map((kind) => ({ kind, continues: false })));
    expect(parsed.blocks.map((b) => [b.lines, b.bullets])).toEqual([
      [["Dev, Acme"], ["Did a thing"]],
      [["Dev, Other"], ["Did another"]],
    ]);
    const cv = finalize(parsed, [{ title: 0, company: 1 }, {}]);
    expect(cv.experience[0]).toMatchObject({ title: "Dev", company: "Acme" });
    expect(cv.experience[1]).toMatchObject({ title: "", company: "" });
  });
});

describe("importCv", () => {
  it("reads a headed CV itself, asking Jev only which part of an unclear header is the title", async () => {
    const { db } = testDb();
    fakeJev();
    const result = await importCv(JEV_ENV, db, USER_ID, CV_TEXT);
    if ("error" in result) throw new Error(result.error);

    const { cv } = result;
    expect(cv.summaries.map((s) => s.text)).toEqual([
      "Frontend developer who ships accessible, fast interfaces for retail brands.",
    ]);
    expect(cv.experience).toMatchObject([
      { title: "Senior Frontend Developer", company: "Acme Ltd", location: "London", start: "Jan 2021", end: null },
      { title: "Junior Developer", company: "Widgets Co", start: "2018", end: "2020" },
    ]);
    expect(cv.experience[0].bullets.map((b) => b.text)).toEqual([
      "Rebuilt the checkout in React, cutting drop-off by 18%",
      "Led a team of 4 engineers",
    ]);
    expect(cv.education).toMatchObject([
      { qualification: "BSc Computer Science", institution: "University of Leeds", start: "2014", end: "2017" },
    ]);
    expect(cv.skills.map(({ label, items }) => ({ label, items }))).toEqual([
      { label: "Languages", items: ["TypeScript", "JavaScript", "CSS"] },
      { label: "Skills", items: ["React", "Node.js"] },
    ]);
  });

  it("records the Jev spend as one cv-import usage row", async () => {
    const { db, sqlite } = testDb();
    fakeJev();
    await importCv(JEV_ENV, db, USER_ID, CV_TEXT);
    expect(sqlite.prepare("select source, input_tokens from jev_usage").all()).toEqual([
      { source: "cv-import", input_tokens: 100 },
    ]);
  });

  it("still reads a headed CV without Jev, or with this month's budget spent", async () => {
    const { db, sqlite } = testDb();
    const withoutKey = await importCv({} as Env, db, USER_ID, CV_TEXT);
    expect(withoutKey).toHaveProperty("cv.education.0.institution", "University of Leeds");
    sqlite.prepare("insert into user_settings (user_id, monthly_budget, updated_at) values (?, 0, ?)").run(USER_ID, "x");
    expect(await importCv(JEV_ENV, db, USER_ID, CV_TEXT)).toHaveProperty("cv");
    expect(askJev).not.toHaveBeenCalled();
  });

  it("refuses too little text, and a CV with no headings when Jev isn't available", async () => {
    const { db } = testDb();
    expect(await importCv(JEV_ENV, db, USER_ID, "hi")).toHaveProperty("error");
    expect(await importCv({} as Env, db, USER_ID, "Jane Doe\nAcme\n• Did a thing\n• Did another")).toHaveProperty("error");
    expect(askJev).not.toHaveBeenCalled();
  });

  it("falls back to Jev labelling every line when the CV has no headings it knows", async () => {
    const { db } = testDb();
    const kinds: Record<string, string> = { "Jane Doe": "contact", "Acme, London 2019 - 2021": "entry", Engineer: "entry" };
    vi.mocked(askJev).mockImplementation(async (_key, state, questions) => {
      const { lines } = state as { lines?: string[] };
      const answers = Object.fromEntries(
        Object.keys(questions).map((key) => {
          const [field, n] = key.split("_");
          if (field === "kind") return [key, { type: "choice", choice: kinds[lines![Number(n)]] ?? "bullet", probabilities: {}, confidence: 1 }];
          if (field === "cont") return [key, { type: "noul", noul: 0.1 }];
          return [key, { type: "choice", choice: "none", probabilities: { none: 1 }, confidence: 1 }];
        }),
      );
      return { model: "jev-test", answers, inputTokens: 10 } as Awaited<ReturnType<typeof askJev>>;
    });
    const result = await importCv(JEV_ENV, db, USER_ID, "Jane Doe\nAcme, London 2019 - 2021\nEngineer\n• Did a thing\n• Did another");
    if ("error" in result) throw new Error(result.error);
    expect(result.cv.experience).toHaveLength(1);
    expect(result.cv.experience[0].bullets.map((b) => b.text)).toEqual(["Did a thing", "Did another"]);
  });
});

const BULLETED_CV = `Jane Doe
+44 7700 900000 | London, UK | jane@example.com
Work Experience
Acme, Bristol (acme.co.uk) Mar 2023 - Present
Platform Engineer
• Moved the nightly batch jobs onto a queue so that reports arrive before the morning stand-up and nobody has to rerun them by
hand when one fails
• Wrote the on-call runbook used by 6 teams
Widgets Studio, Bristol (widgets.com) Jan 2020 - Feb 2023
Backend Developer
• Added caching in front of the search service, halving response times
Projects
Plant Diary (plantdiary.app)
(Go, SQLite, HTMX)
• Built a watering tracker used by 300 hobby gardeners
Education
University of Leeds Sep 2016 - Jun 2019
BSc Computer Science
• Final project: route planning for delivery vans
Additional Information
Technical Skills: TypeScript, Python, React`;

const BULLETED_KINDS: Record<string, LineKind> = {
  "Jane Doe": "contact",
  "+44 7700 900000 | London, UK | jane@example.com": "contact",
  "Acme, Bristol (acme.co.uk) Mar 2023 - Present": "entry",
  "Platform Engineer": "entry",
  "Widgets Studio, Bristol (widgets.com) Jan 2020 - Feb 2023": "entry",
  "Backend Developer": "entry",
  "Plant Diary (plantdiary.app)": "entry",
  "(Go, SQLite, HTMX)": "skills",
  "University of Leeds Sep 2016 - Jun 2019": "entry",
  "BSc Computer Science": "entry",
  "Additional Information": "heading",
  "Technical Skills: TypeScript, Python, React": "skills",
};

describe("importCv with bulleted PDFs", () => {
  it("keeps every bullet separate even when Jev thinks every line continues", async () => {
    const { db } = testDb();
    vi.mocked(askJev).mockImplementation(async (_key, state, questions) => {
      const { lines } = state as { lines?: string[] };
      const answers: Record<string, unknown> = {};
      for (const [key, question] of Object.entries(questions)) {
        const [field, n] = key.split("_");
        if (field === "kind") answers[key] = { type: "choice", choice: BULLETED_KINDS[lines![Number(n)]] ?? "bullet", probabilities: {}, confidence: 1 };
        else if (field === "cont") answers[key] = { type: "noul", noul: 0.9 };
        else {
          const criteria = (question as { criteria: Record<string, string> }).criteria;
          const want = { title: /Engineer|Developer|BSc/, company: /^"(Acme|Widgets Studio)"$/, institution: /Leeds"$/, qualification: /BSc/, location: /^"Bristol"$/ }[field];
          const hit = Object.entries(criteria).find(([, text]) => want?.test(text));
          answers[key] = { type: "choice", choice: hit?.[0] ?? "none", probabilities: { [hit?.[0] ?? "none"]: 0.9 }, confidence: 0.9 };
        }
      }
      return { model: "jev-test", answers, inputTokens: 10 } as Awaited<ReturnType<typeof askJev>>;
    });

    const result = await importCv(JEV_ENV, db, USER_ID, BULLETED_CV);
    if ("error" in result) throw new Error(result.error);
    const { cv } = result;

    expect(cv.experience.map((e) => [e.company, e.title, e.url, e.start, e.end, e.bullets.length])).toEqual([
      ["Acme", "Platform Engineer", "acme.co.uk", "Mar 2023", null, 2],
      ["Widgets Studio", "Backend Developer", "widgets.com", "Jan 2020", "Feb 2023", 1],
    ]);
    expect(cv.experience[0].bullets[0].text).toBe(
      "Moved the nightly batch jobs onto a queue so that reports arrive before the morning stand-up and nobody has to rerun them by hand when one fails",
    );
    expect(cv.projects.map((p) => [p.name, p.url, p.details, p.bullets.length])).toEqual([["Plant Diary", "plantdiary.app", "Go, SQLite, HTMX", 1]]);
    expect(cv.education).toMatchObject([{ institution: "University of Leeds", qualification: "BSc Computer Science", start: "Sep 2016", end: "Jun 2019" }]);
    expect(cv.skills.map(({ label, items }) => ({ label, items }))).toEqual([{ label: "Technical Skills", items: ["TypeScript", "Python", "React"] }]);
  });
});

describe("saving", () => {
  it("cleans what the browser posts and round-trips it", async () => {
    const { db } = testDb();
    const cv = cleanCv({
      summaries: [{ id: "s1", text: "  Hello  " }, { text: "" }],
      experience: [{ id: "<script>", title: "Dev", bullets: [{ text: "Shipped" }, { text: " " }] }, {}],
      skills: ["React", "React", 5],
      extra: "ignored",
    });
    expect(cv.summaries).toEqual([{ id: "s1", text: "Hello" }]);
    expect(cv.experience).toHaveLength(1);
    expect(cv.experience[0].id).not.toBe("<script>");
    expect(cv.experience[0].bullets.map((b) => b.text)).toEqual(["Shipped"]);
    expect(cv.skills.map((g) => g.items)).toEqual([["React"]]);

    await saveCv(db, USER_ID, cv);
    expect(await getCv(db, USER_ID)).toEqual(cv);
  });
});
