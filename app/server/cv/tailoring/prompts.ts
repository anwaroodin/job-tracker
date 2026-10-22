export const STRATEGIES = ["nudge", "keywords", "full"] as const;
export type Strategy = (typeof STRATEGIES)[number];

export const DIFF_STRATEGY_INSTRUCTIONS: Record<Strategy, string> = {
  nudge: "Make minimal edits. Only rephrase where there is a clear match. Do not add new bullet points.",
  keywords: "Weave in relevant keywords where evidence already exists. You may rephrase bullets but do not add new ones.",
  full: "Make targeted adjustments. You may rephrase bullets, add verified JD skills, and add new bullets that elaborate on existing work, but do not invent new responsibilities.",
};

export const EXTRACT_KEYWORDS_PROMPT = `Extract job requirements as JSON. Output ONLY the JSON object, no other text.

Example format:
{
  "company": "Acme Corp",
  "role": "Senior Backend Engineer",
  "required_skills": ["Python", "AWS"],
  "preferred_skills": ["Kubernetes"],
  "experience_requirements": ["5+ years"],
  "education_requirements": ["Bachelor's in CS"],
  "key_responsibilities": ["Lead team"],
  "keywords": ["microservices", "agile"],
  "soft_skills": ["communication", "mentoring"],
  "experience_years": 5,
  "seniority_level": "senior"
}

Put only hard skills in required_skills and preferred_skills: technologies, tools, methods, domains and qualifications.
Put personal qualities and soft skills (communication, empathy, teamwork, ownership and the like) in soft_skills.
keywords are other technical or domain terms worth matching. Never include locations, salary, benefits, working patterns, the company's name or generic words in any list.
Extract numeric years (e.g., "5+ years" → 5) and infer seniority level.
Set "company" to the hiring company name and "role" to the job title exactly as
written in the posting; use an empty string for either if it is not stated.

Job description:
{job_description}`;

export const SKILL_TARGET_PLAN_PROMPT = `Build a concise skill target plan for tailoring this resume to the job.

Return ONLY a JSON object. Do not rewrite the resume.

Rules:
1. Prefer required and preferred JD skills.
2. Include existing resume skills that are highly relevant to the JD.
3. You may include JD skills that are missing from the resume skills list.
4. Do not include skills unrelated to the JD.
5. Do not include certifications, and do not include a broad discipline (such as front-end development) that the candidate's title or a broader listed skill already covers. Target concrete tools, technologies, methods and qualifications.
6. Generate reasons in British English.
7. Use the company research only to judge which of the candidate's skills this company values most.
8. Choose which personal projects to show, as indices into "personalProjects", most relevant to the job first. Projects marked "optional" are not on the resume yet: include one whenever it shows a skill or experience the job asks for better than a shown project does. Keep the number of projects about the same as now.

Existing resume skills:
{existing_skills}

JD keywords and skills:
{job_keywords}

Job Description:
{job_description}

What the company says it values and looks for (may be empty):
{company_research}

Confirmed by the candidate (true even though the resume doesn't show it yet; use it to target skills):
{confirmed}

Resume JSON:
{original_resume}

Output this exact JSON format:
{
  "target_skills": [
    {
      "skill": "skill name",
      "reason": "why this skill should be emphasized"
    }
  ],
  "strategy_notes": "brief notes for the next editing pass"
}`;

const HUMAN_VOICE = `HOW IT SHOULD SOUND (a recruiter must not be able to tell a model wrote it):
- Write the way an experienced software engineer writes about their own work: plain, specific and understated. Keep that voice whatever the candidate's field.
- Cut any sentence or phrase that only signals enthusiasm or importance, and vague audience tails such as "for real users", "for client users" or "for production users".
- No "not just X but Y", "it's not X, it's Y" or "X rather than Y" contrasts, and no closing line that restates the point.
- No lists of three for rhythm. List three things only when there are exactly three real things.
- No dashes (— or –) between clauses. Use a full stop, comma or colon.
- No "-ing" tails that claim more than the facts show ("..., ensuring quality", "..., demonstrating leadership").
- Plain verbs: "is", "has", "built", "ran", "led", never "serves as", "boasts", "spearheaded", "leveraged".
- Mix short sentences with longer ones, and don't start consecutive sentences the same way.
- Never use: passionate, excited, thrilled, eager, driven, results-driven, dynamic, proven track record, seamless, cutting-edge, innovative, pivotal, crucial, key (as an adjective), vibrant, showcase, underscore, highlight (as a verb), delve, landscape, journey, testament, foster, enhance, meticulous, synergy, align with, make an impact, add value, hit the ground running, great fit.
- Don't praise the company or repeat its values back to it. Naming what the role will build and how the candidate's work fits it is fine.`;

const SUMMARY_RULES = `## Professional summary

Write a 2–3 sentence summary (45–70 words) that sits at the top of the CV, tailored to this job.

What it must do:
- Open with who the candidate is: their title (the job's title only if the CV genuinely supports it) and the core of what they do, in the job description's own vocabulary.
- Give the strongest one or two pieces of evidence from the CV that match what this job asks for most. Prefer concrete things: a scale, a result, a type of product, a kind of team. One number is fine if the CV states it; never invent or round up.
- End on what they'd bring to this specific role or company. Name the company if given. Point to the actual work in the job description, not to "the mission" in the abstract.

Style:
- Implied first person: no "I", "me", "my", and no "he/she/they" or the candidate's name. Start sentences with the title, a noun or a verb.
- Plain, specific language a hiring manager would say out loud. Vary sentence length.
- Banned phrases: "proven track record", "well-positioned", "results-driven", "passionate about", "dynamic", "detail-oriented", "team player", "leverage", "seeking to", "excellent communication skills".
- No tool lists; tools belong in the skills section.
- Every claim must be traceable to the CV. If the CV doesn't back something the job wants, leave it out rather than stretch.

Before writing, pick the 2–3 requirements the job description stresses most and check which ones the CV actually supports. Build the summary around those.

Example (unrelated job — copy the quality, not the content or wording):
Good: "Retail supervisor with four years running the tills and stockroom at a busy high-street store. Trained most of the current weekend team and cut returns-desk queues by reorganising how refunds are processed. Ready to bring the same steady floor management to Northfield Stores' new Leeds branch."
Bad: "Retail Assistant with experience in customer service, stock management and teamwork. Proven track record of achieving targets and collaborating with stakeholders. Well-positioned to support Northfield Stores' mission by delivering excellent service."
The bad one could describe anyone. The good one could only describe this person.

`;

const WRITING_RULES = `CV WRITING RULES (every line you write must follow these):
- Start each bullet with a strong past-tense action verb (present tense only for a current role whose bullets already use it).
- One idea per bullet, about 12 to 25 words. Cut filler.
- Structure every bullet as action verb + task or project + outcome, for example "Added Redis caching to the payments service, cutting average API latency by ~34%". Put a number in as many bullets as the CV honestly allows: use any number from the CV or the candidate's answers that belongs to that work (including one stated in the summary or another line), and otherwise quantify scope the CV supports, such as how many users, clients, services or people. Never invent a percentage, revenue figure or result the CV and answers don't give.
- IMPORTANT: every number appears in one bullet only. Never repeat a figure, time period or phrase such as "2-week sprints" across bullets, and vary the kind of metric: scale (users, transactions, records), time saved, speed or latency, money, quantity delivered, team size. Process details like sprint length, meeting frequency or "end to end" are not results; leave them out rather than use them as the number. A bullet with no honest number is better than a repeated one.
- Write plain, grammatical British English, the way a strong candidate would write it themselves. Read each line back; if it sounds stuffed or awkward, rewrite it or keep the original.
- Never name personal qualities or soft skills (empathy, transparency, passion, ownership, hardworking and the like). Show them through what the candidate did and what came of it.
- Use the job's terms only where they name a real skill, tool or practice the candidate used, at most once per line, and never bolt them on with phrases like "with empathy" or "leveraging".
- Treat the candidate's confirmed answers as facts to draw on, not text to copy.
- IMPORTANT: end every bullet the same way. Either every bullet in the CV ends with a full stop or none does; follow what most of the master resume's bullets do.
- No personal pronouns (I, me, my, we, our, he, she, they) and no articles (a, an, the) anywhere in the bullets. Rephrase so the line still reads cleanly without them ("Added caching to payments service", never "I added a cache to the payments service").
- Start each bullet with the verb ("Built", never "Builds" or "He built"). Use each opening verb once across the whole CV where you can, never more than twice. Pick plain, common verbs that say exactly what happened (Built, Led, Ran, Wrote, Cut, Moved, Fixed, Set up, Shipped, Trained, Reduced), never thesaurus verbs (Orchestrated, Spearheaded, Architected, Championed, Pioneered, Effectuated, Revolutionised).
${SUMMARY_RULES}${HUMAN_VOICE}`;

export const DIFF_IMPROVE_PROMPT = `Given this resume and job description, output a JSON object with targeted changes to better align the resume with the job.

RULES:
1. Only modify content; never change names, companies, dates, institutions, or degrees
2. Do not invent achievements not supported by the original resume text or confirmed by the candidate below
3. Do not add new work entries, education entries, or project entries
4. {strategy_instruction}
5. Each change MUST include the original text (copied exactly) so it can be verified
6. For each change, explain WHY it helps match the job description
7. Generate all new text in British English
8. Do not use em dash characters
9. Rewrite every bullet that breaks the CV WRITING RULES below, whatever the strategy and even when it already matches the job. Beyond that, keep changes targeted: leave a line that already follows the rules and aligns with the job
10. Exception to rule 2: you may add a skill only if it appears in the verified skill targets below
11. Scan the summary and every work, project, and education description for content that already demonstrates a job-description keyword or skill, and reframe that text using the job description's terminology where it is not already phrased that way and reads naturally (per rule 9, leave content that already aligns well), while preserving the candidate's actual accomplishment. Do NOT add new work, metrics, or responsibilities; only restate existing content in the JD's language, and verify every reframe stays factually accurate.
12. Preserve original capitalization, especially for proper nouns, technical terms (e.g., REST, API, AWS), and acronyms. Do not change the casing of words that were capitalized in the original.
13. Use the company research only to decide which of the candidate's real experience to emphasise. Never copy its wording, slogans or values into the resume, and never claim the candidate shares a value the resume doesn't show.
14. Align the CV with this job's main responsibilities, not only its keywords. For each bullet, lead with the part of the work this job cares about and name it the way the job description does, wherever the candidate's work honestly supports it.
15. Never add a broad discipline or area to the skills section (for example "Front-end development" or "Software development") when the candidate's job title or a broader skill they list already covers it, as "Full-stack" covers front-end and back-end. The skills section lists concrete tools, technologies, methods and qualifications.
16. Before answering, go through every bullet in workExperience and personalProjects one at a time and check it against the CV WRITING RULES, above all the action verb + task or project + outcome structure, a number wherever the CV supports one and no number or time period repeated across bullets, the full stop rule, no pronouns or articles, and no opening verb used more than twice. Return a change for each bullet that fails.

${WRITING_RULES}

PATHS you can target:
- "summary" — the resume summary text
- "workExperience[i].description[j]" — a specific bullet (i = entry index, j = bullet index)
- "workExperience[i].description" — append a new bullet (action: "append")
- "personalProjects[i].description[j]" — a specific project bullet
- "personalProjects[i].description" — append a new project bullet (action: "append")
- "education[i].description[j]" — a specific education detail (replace only)
- "skills[k].items" — reorder a skill group's items (action: "reorder") or add one verified skill (action: "add_skill")
- "certifications" — reorder the certifications list (action: "reorder")

Do NOT target: personal details, dates, company names, job titles, project names, education degree/institution, or skill group labels.

Keywords to emphasize (only if already supported by resume content):
{job_keywords}

Verified skill targets:
{skill_targets}

Job Description:
{job_description}

What the company says it values and looks for (may be empty):
{company_research}

Confirmed by the candidate (true even though the resume doesn't show it yet; you may write it into the resume where it fits, and add it as a skill when it is a verified skill target):
{confirmed}

Original Resume:
{original_resume}

Output this exact JSON format, nothing else:
{
  "changes": [
    {
      "path": "workExperience[0].description[1]",
      "action": "replace",
      "original": "the exact original text at this path",
      "value": "the improved text",
      "reason": "why this change helps"
    },
    {
      "path": "summary",
      "action": "replace",
      "original": "the current summary text",
      "value": "the improved summary",
      "reason": "why this change helps"
    },
    {
      "path": "skills[0].items",
      "action": "reorder",
      "original": null,
      "value": ["most relevant skill first", "then next", "..."],
      "reason": "reordered to prioritize JD-relevant skills"
    },
    {
      "path": "skills[0].items",
      "action": "add_skill",
      "original": null,
      "value": "verified skill target missing from the skills list",
      "reason": "added verified JD skill for review"
    }
  ],
  "strategy_notes": "brief summary of the tailoring approach"
}`;

export const KEYWORD_INJECTION_PROMPT = `Work the following skills back into this resume by reframing the candidate's existing experience in the job description's language, wherever they fit naturally.

CRITICAL RULES:
1. Only reframe with keywords the master resume substantively supports (e.g., if the master shows "used Python for data analysis", surface "Python" and "data analysis" language)
2. Do NOT add skills, technologies, or certifications not in the master resume
3. Rephrase existing bullet points and content to include keywords
4. Maintain the exact same JSON structure: the same entries in the same order, with the same number of bullets in each
5. Do not use em-dashes (—) or their variants (---, --)
6. Add a skill only where it reads naturally; leave a skill out rather than force it into a line
7. Leave lines that don't need a skill exactly as they are

${WRITING_RULES}

Keywords to inject (only if supported by master resume):
{keywords_to_inject}

Current tailored resume:
{current_resume}

Master resume (source of truth):
{master_resume}

Job description context:
{job_description}

Output the complete resume JSON with keywords naturally integrated. Return ONLY valid JSON.`;

export const COVER_LETTER_PROMPT = `Write a short cover letter for this job application, as the candidate, in the first person and in British English.

Job Description:
{job_description}

Candidate Resume (JSON):
{resume_data}

What the candidate found out about the company (may be empty):
{company_research}

${HUMAN_VOICE}

Requirements:
- 100 to 150 words over three short paragraphs.
- First paragraph: name the role, then one concrete thing from the job description (a product, a problem they're solving or part of their stack) and how it connects to the candidate's own work. Never open with "I am writing to apply", "I was excited to see" or praise of the company.
- Second paragraph: one or two pieces of the candidate's real work that match what the job asks for, with the specifics: what they built or ran, for whom, and what came of it. Use the job's term for something only when it names what the candidate actually did (if the CV shows "built automated data pipelines" and the job says "ETL", call that work ETL).
- Last paragraph: one or two sentences saying they'd like to talk it through. No "at your earliest convenience" and no stacked thanks.
- If the CV shows a change of career, say what carries over in one sentence without justifying the move.
- Use the company's real name from the job description, never a placeholder.
- Use only facts from the CV. Use the company research only to choose what to mention, never to repeat its wording or values.

Output JSON with the greeting line ("Dear <name>," when the job description names who is hiring, otherwise "Dear Hiring Manager,"), the paragraphs, and the sign-off line ("Kind regards,"), without the candidate's name.`;

export const SYSTEM_PROMPTS = {
  gaps: "You judge which skills a CV already shows or clearly implies. Output only valid JSON.",
  keywords: "You extract structured job requirements. Output only valid JSON.",
  plan: "You are an expert resume editor. Output only valid JSON.",
  diffs: "You are an expert resume editor. Output only valid JSON with targeted changes.",
  inject: "You are a resume editor. Inject keywords naturally without adding fabricated content. Return only valid JSON matching the input schema.",
  emphasis: "You are an expert CV editor who knows how recruiters skim. Output only valid JSON.",
  letter: "You write cover letters the way the candidate would write them: plain, specific and indistinguishable from their own writing. Output only valid JSON.",
};

export function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key] : match));
}
