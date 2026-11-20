import { afterEach, describe, expect, it, vi } from "vitest";
import { buildEmail, cleanDomain, companyDomain, detectPattern, nameParts } from "~/lib/email-pattern";
import { hiringManagerTitles, isRecruiterRole, linkedInCompanyPeople, linkedInCompanySlug, peopleWhoEmailed } from "~/lib/outreach";
import { contactsFor, saveContacts, setContactEmail } from "~/server/db/queries/contacts.server";
import { recordPatterns, patternsFor } from "~/server/db/queries/email-patterns.server";
import { parseFindReply, parseLeads } from "~/server/outreach/generect.server";
import { findPeople } from "~/server/services/outreach/find-people.server";
import { outreachMonth } from "~/server/services/outreach/budget.server";
import { profileQuery, profilesFromResults } from "~/server/outreach/brave.server";
import { addContacts } from "~/server/services/applications/contacts.server";
import { findContactEmail } from "~/server/services/outreach/find-email.server";
import { USER_ID, testDb } from "./db";
import { addApplication } from "./fixtures";

const jane = { name: "Jane Smith", profileUrl: "https://www.linkedin.com/in/janesmith/", degree: "2nd", headline: "Design Manager", note: "Job poster" };

describe("email patterns", () => {
  it("reads names the way they appear in email headers", () => {
    expect(nameParts("Dr. José Álvarez-Ruiz (Pepe)")).toEqual({ first: "jose", last: "alvarezruiz" });
    expect(nameParts("Smith, Jane")).toEqual({ first: "jane", last: "smith" });
    expect(nameParts("Jane Smith, PhD")).toEqual({ first: "jane", last: "smith" });
    expect(nameParts("Jane")).toBeNull();
  });

  it("detects the pattern behind a real address and builds new ones from it", () => {
    expect(detectPattern("Jane Smith", "jane.smith@acme.com")).toBe("first.last");
    expect(detectPattern("Jane Smith", "jsmith@acme.com")).toBe("flast");
    expect(detectPattern("Acme Careers", "careers@acme.com")).toBeNull();
    expect(detectPattern("Jane Smith", "js-recruiting@acme.com")).toBeNull();
    expect(buildEmail({ first: "sam", last: "lee" }, "flast", "acme.com")).toBe("slee@acme.com");
  });

  it("counts confirmations per domain and pattern", async () => {
    const { db } = testDb();
    await recordPatterns(db, [{ domain: "acme.com", pattern: "first.last" }, { domain: "acme.com", pattern: "flast" }]);
    await recordPatterns(db, [{ domain: "acme.com", pattern: "first.last" }]);
    expect(await patternsFor(db, "acme.com")).toEqual([
      { pattern: "first.last", confirmations: 2 },
      { pattern: "flast", confirmations: 1 },
    ]);
  });
});

describe("contacts", () => {
  it("updates a recaptured person without losing the email found for them", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "app-1" });
    await saveContacts(db, USER_ID, "app-1", [jane], "linkedin");
    const [saved] = await contactsFor(db, USER_ID, "app-1");
    await setContactEmail(db, USER_ID, saved.id, "jane.smith@acme.com", "valid", "checker");

    await saveContacts(db, USER_ID, "app-1", [{ ...jane, headline: "Head of Design" }], "linkedin");
    const contacts = await contactsFor(db, USER_ID, "app-1");
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ headline: "Head of Design", email: "jane.smith@acme.com", emailStatus: "valid" });
  });
});

describe("outreach", () => {
  it("finds the company's email domain from emails, then the job URL", () => {
    expect(companyDomain("", "https://boards.greenhouse.io/acme/1", ["no-reply@greenhouse.io", "jane@acme.com"])).toBe("acme.com");
    expect(companyDomain("", "https://careers.acme.co.uk/jobs/1", ["jane@gmail.com"])).toBe("acme.co.uk");
    expect(companyDomain("", "https://www.linkedin.com/jobs/view/1", [])).toBe("");
    expect(companyDomain("acme.io", "https://careers.acme.com", [])).toBe("acme.io");
    expect(cleanDomain("https://www.Acme.com/careers")).toBe("acme.com");
    expect(cleanDomain("jane@acme.com")).toBe("acme.com");
    expect(cleanDomain("not a domain")).toBe("");
  });

  it("lists people who emailed you, without automated senders, yourself or unlinked emails", () => {
    const senders = peopleWhoEmailed(
      [
        { fromName: "Jane Smith", fromAddress: "Jane.Smith@acme.com", dismissedAt: null },
        { fromName: "Jane Smith", fromAddress: "jane.smith@acme.com", dismissedAt: null },
        { fromName: "Acme", fromAddress: "no-reply@acme.com", dismissedAt: null },
        { fromName: "Me", fromAddress: "test@example.com", dismissedAt: null },
        { fromName: "Sam", fromAddress: "sam@acme.com", dismissedAt: "2026-01-01" },
      ],
      "test@example.com",
    );
    expect(senders).toEqual([{ name: "Jane Smith", email: "jane.smith@acme.com" }]);
  });
});

describe("findContactEmail without a working checker", () => {
  const env = { GENERECT_API_KEY: "key" } as Env;
  const setUp = async () => {
    const { db } = testDb();
    await addApplication(db, { id: "app-1", emailDomain: "acme.com" });
    await saveContacts(db, USER_ID, "app-1", [jane], "linkedin");
    const [saved] = await contactsFor(db, USER_ID, "app-1");
    return { db, contactId: saved.id };
  };
  const generect = (data: object) => vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ data, meta: { amount_charged: 0 } }));

  afterEach(() => vi.unstubAllGlobals());

  it("asks Generect by LinkedIn URL and learns the company's format", async () => {
    const { db, contactId } = await setUp();
    const fetchSpy = generect({ valid_email: "Jane_Smith@acme.com", result: "valid", catch_all: false, source: "generect" });
    vi.stubGlobal("fetch", fetchSpy);

    await findContactEmail(env, db, USER_ID, "app-1", contactId);

    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({ linkedin_url: jane.profileUrl });
    expect((await contactsFor(db, USER_ID, "app-1"))[0]).toMatchObject({ email: "jane_smith@acme.com", emailStatus: "valid" });
    expect(await patternsFor(db, "acme.com")).toEqual([{ pattern: "first_last", confirmations: 1 }]);
    expect((await contactsFor(db, USER_ID, "app-1"))[0].emailSource).toBe("generect");
  });

  it("logs what Generect charged and stops calling it once the monthly limit is reached", async () => {
    const { db, contactId } = await setUp();
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ data: { valid_email: "jane.smith@acme.com", result: "valid", catch_all: false, source: "generect" }, meta: { amount_charged: 0.03 } }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const capped = { ...env, GENERECT_MONTHLY_BUDGET_USD: "0.03" } as Env;

    await findContactEmail(capped, db, USER_ID, "app-1", contactId);
    expect((await outreachMonth(capped, db)).find((p) => p.provider === "generect")).toMatchObject({ requests: 1, found: 1, cost: 0.03, overBudget: true });

    fetchSpy.mockClear();
    await findContactEmail(capped, db, USER_ID, "app-1", contactId);
    expect(fetchSpy.mock.calls.some(([url]) => url.includes("generect"))).toBe(false);
  });

  it("falls back to the known format when Generect finds nothing", async () => {
    const { db, contactId } = await setUp();
    await recordPatterns(db, [{ domain: "acme.com", pattern: "flast" }]);
    const fetchSpy = generect({ valid_email: null });
    vi.stubGlobal("fetch", fetchSpy);

    await findContactEmail(env, db, USER_ID, "app-1", contactId);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect((await contactsFor(db, USER_ID, "app-1"))[0]).toMatchObject({ email: "jsmith@acme.com", emailStatus: "likely" });
  });

  it("keeps a personal address from Generect without learning a format from it", async () => {
    const { db, contactId } = await setUp();
    vi.stubGlobal("fetch", generect({ valid_email: "jane.smith@gmail.com", result: "valid", catch_all: false, source: "generect" }));

    await findContactEmail(env, db, USER_ID, "app-1", contactId);

    expect((await contactsFor(db, USER_ID, "app-1"))[0]).toMatchObject({ email: "jane.smith@gmail.com", emailStatus: "valid" });
    expect(await patternsFor(db, "gmail.com")).toEqual([]);
  });

  it("never calls an address Generect built from a format, or a catch-all one, verified", () => {
    expect(parseFindReply({ data: { valid_email: "jane@acme.com", result: "valid", source: "FORMAT" } })).toEqual({ email: "jane@acme.com", status: "likely" });
    expect(parseFindReply({ data: { valid_email: "jane@acme.com", result: "valid", catch_all: true } })).toEqual({ email: "jane@acme.com", status: "accept_all" });
    expect(parseFindReply({ data: { valid_email: "not-an-email", result: "valid" } })).toBeNull();
  });
});

describe("finding people when LinkedIn showed no one", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("searches for the team's managers by role", () => {
    expect(hiringManagerTitles("Full Stack Engineer")).toContain("Engineering Manager");
    expect(hiringManagerTitles("Senior Product Designer")).toContain("Head of Design");
    expect(hiringManagerTitles("Barista")).toEqual(["Hiring Manager", "Team Lead"]);
  });

  it("keeps only leads with an id and a name", () => {
    const reply = { data: { leads: [{ id: "lead-1", full_name: " Sam Lee ", job_title: "Recruiter" }, { id: "", full_name: "No Id" }, { id: "lead-3" }] } };
    expect(parseLeads(reply)).toEqual([{ leadId: "lead-1", name: "Sam Lee", title: "Recruiter" }]);
  });

  it("saves managers and recruiters once, then finds their email by lead id", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "app-1", company: "Acme", role: "Software Engineer", emailDomain: "acme.com" });
    const env = { GENERECT_API_KEY: "key" } as Env;
    const leads = { data: { leads: [{ id: "lead-1", full_name: "Sam Lee", job_title: "Engineering Manager" }] }, meta: { amount_charged: 0 } };
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) => Response.json(leads));
    vi.stubGlobal("fetch", fetchSpy);

    await findPeople(env, db, USER_ID, "app-1");
    await findPeople(env, db, USER_ID, "app-1");
    const [sam, ...rest] = await contactsFor(db, USER_ID, "app-1");
    expect(rest).toEqual([]);
    expect(sam).toMatchObject({ name: "Sam Lee", headline: "Engineering Manager", leadId: "lead-1", source: "search", profileUrl: "" });
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toMatchObject({ company_name: "Acme", detail: "thin" });

    fetchSpy.mockImplementation(async () => Response.json({ data: { valid_email: "sam.lee@acme.com", result: "valid", catch_all: false, source: "generect" } }));
    await findContactEmail(env, db, USER_ID, "app-1", sam.id);
    expect(JSON.parse(String(fetchSpy.mock.calls.at(-1)?.[1]?.body))).toEqual({ lead_id: "lead-1" });
    expect((await contactsFor(db, USER_ID, "app-1"))[0]).toMatchObject({ email: "sam.lee@acme.com", emailStatus: "valid" });
  });

  it("keeps a LinkedIn contact and a found person apart on the same application", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "app-1" });
    await saveContacts(db, USER_ID, "app-1", [jane], "linkedin");
    await saveContacts(db, USER_ID, "app-1", [jane], "linkedin");
    expect(await contactsFor(db, USER_ID, "app-1")).toHaveLength(1);
  });
});

describe("LinkedIn profiles from search results", () => {
  afterEach(() => vi.unstubAllGlobals());

  const results = [
    { title: "Jane Smith – Talent Acquisition Partner – XYZ <strong>Reality</strong> | LinkedIn", url: "https://uk.linkedin.com/in/janesmith?trk=x", description: "London" },
    { title: "Sam Lee - Engineering Manager | LinkedIn", url: "https://www.linkedin.com/in/samlee/", description: "Engineering Manager at XYZ Reality · Experience" },
    { title: "Pat Doe - Recruiter - Other Co | LinkedIn", url: "https://www.linkedin.com/in/patdoe", description: "Recruiter at Other Co" },
    { title: "XYZ Reality | LinkedIn", url: "https://www.linkedin.com/company/xyz-reality", description: "XYZ Reality" },
    { title: "Ola Nordmann - XYZ Reality | LinkedIn", url: "https://www.linkedin.com/in/ola", description: "Senior Recruiter at XYZ Reality · Experience: XYZ Reality · Location: London. View Ola's profile" },
    { title: "Kim Park - XYZ Reality | LinkedIn", url: "https://www.linkedin.com/in/kim", description: "Experience: XYZ Reality · Location: Leeds · 500+ connections on LinkedIn" },
  ];

  it("reads name, title and profile, and drops people at other companies", () => {
    expect(profilesFromResults(results, "XYZ Reality")).toEqual([
      { name: "Jane Smith", profileUrl: "https://www.linkedin.com/in/janesmith/", degree: "", headline: "Talent Acquisition Partner", note: "" },
      { name: "Sam Lee", profileUrl: "https://www.linkedin.com/in/samlee/", degree: "", headline: "Engineering Manager", note: "" },
      { name: "Ola Nordmann", profileUrl: "https://www.linkedin.com/in/ola/", degree: "", headline: "Senior Recruiter", note: "London" },
      { name: "Kim Park", profileUrl: "https://www.linkedin.com/in/kim/", degree: "", headline: "", note: "Leeds" },
    ]);
    expect(linkedInCompanyPeople("XYZ Reality", "recruitment")).toBe("https://www.linkedin.com/company/xyz-reality/people/?keywords=recruitment");
    expect(linkedInCompanySlug("Café & Co.")).toBe("cafe-and-co");
    expect([isRecruiterRole("Talent Acquisition Partner"), isRecruiterRole("Engineering Manager")]).toEqual([true, false]);
    expect(profileQuery('Acme "Labs"', ["Recruiter", "Head of Design"])).toBe('site:linkedin.com/in "Acme Labs" ("Recruiter" OR "Head of Design")');
  });

  it("saves search results with their LinkedIn profile, and only falls back to Generect when search finds no one", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "app-1", company: "XYZ Reality", role: "Full Stack Engineer" });
    const fetchSpy = vi.fn(async (url: string, _init?: RequestInit) => Response.json({ web: { results: url.includes("brave") ? results : [] } }));
    vi.stubGlobal("fetch", fetchSpy);

    expect(await findPeople({ BRAVE_SEARCH_API_KEY: "b", GENERECT_API_KEY: "g" } as Env, db, USER_ID, "app-1")).toEqual({ ok: true });

    expect(fetchSpy.mock.calls.every(([url]) => url.includes("api.search.brave.com"))).toBe(true);
    const saved = await contactsFor(db, USER_ID, "app-1");
    expect(saved.map((person) => person.name)).toEqual(["Jane Smith", "Ola Nordmann", "Sam Lee"]);
    expect(saved.every((person) => person.source === "search")).toBe(true);
  });

  it("only keeps people whose current company is the one hiring", () => {
    const people = profilesFromResults(
      [
        { title: "Robert Ermini - Zip | LinkedIn", url: "https://www.linkedin.com/in/robertermini/", description: "Engineering Manager at Zip. Previously Constructor · Experience: Zip" },
        { title: "Lee Park - Head of Engineering | LinkedIn", url: "https://www.linkedin.com/in/leepark/", description: "Experience: Zip · Past: Constructor" },
        { title: "Emma Haskins - Senior Talent Acquisition Manager ... | LinkedIn", url: "https://www.linkedin.com/in/emma/", description: "Experience: Constructor · Location: London" },
        { title: "Vedran Vučetić - Constructor | LinkedIn", url: "https://www.linkedin.com/in/vedran/", description: "Staff Engineer at Constructor" },
        { title: "Ana Silva - Recruiter at Constructor | LinkedIn", url: "https://www.linkedin.com/in/ana/", description: "" },
      ],
      "Constructor",
    );
    expect(people.map(({ name, headline, note }) => [name, headline, note])).toEqual([
      ["Emma Haskins", "Senior Talent Acquisition Manager", "London"],
      ["Vedran Vučetić", "Staff Engineer", ""],
      ["Ana Silva", "Recruiter", ""],
    ]);
  });

  it("replaces earlier search results on a new search, but keeps people with an email", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "app-1", company: "XYZ Reality", role: "Full Stack Engineer" });
    const stale = { ...jane, name: "Old Result", profileUrl: "https://www.linkedin.com/in/old/" };
    const emailed = { ...jane, name: "Kept Result", profileUrl: "https://www.linkedin.com/in/kept/" };
    await saveContacts(db, USER_ID, "app-1", [stale, emailed], "search");
    const kept = (await contactsFor(db, USER_ID, "app-1")).find((person) => person.name === "Kept Result")!;
    await setContactEmail(db, USER_ID, kept.id, "kept@xyzreality.com", "valid", "checker");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ web: { results } })));

    await findPeople({ BRAVE_SEARCH_API_KEY: "b" } as Env, db, USER_ID, "app-1");

    const names = (await contactsFor(db, USER_ID, "app-1")).map((person) => person.name);
    expect(names).toContain("Kept Result");
    expect(names).not.toContain("Old Result");
  });

  it("keeps people saved from LinkedIn search pages apart from the job's hiring team", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "app-1" });
    await addContacts(db, USER_ID, "app-1", [jane], "people");
    expect((await contactsFor(db, USER_ID, "app-1"))[0].source).toBe("people");
  });
});
