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
5. Do not include certifications.
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
9. Keep changes minimal and targeted; do not rewrite content that already aligns well
10. Exception to rule 2: you may add a skill only if it appears in the verified skill targets below
11. By DEFAULT, scan the summary and every work, project, and education description for content that already demonstrates a job-description keyword or skill, and reframe that text using the job description's terminology where it is not already phrased that way (per rule 9, leave content that already aligns well), while preserving the candidate's actual accomplishment. Do NOT add new work, metrics, or responsibilities; only restate existing content in the JD's language, and verify every reframe stays factually accurate.
12. Preserve original capitalization, especially for proper nouns, technical terms (e.g., REST, API, AWS), and acronyms. Do not change the casing of words that were capitalized in the original.
13. Use the company research only to decide which of the candidate's real experience to emphasise. Never copy its wording, slogans or values into the resume, and never claim the candidate shares a value the resume doesn't show.

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

export const KEYWORD_INJECTION_PROMPT = `Inject the following keywords into this resume by reframing the candidate's existing experience in the job description's language. Target EVERY section (summary, work experience, projects, skills) by default.

CRITICAL RULES:
1. Only reframe with keywords the master resume substantively supports (e.g., if the master shows "used Python for data analysis", surface "Python" and "data analysis" language)
2. Do NOT add skills, technologies, or certifications not in the master resume
3. Rephrase existing bullet points and content to include keywords
4. Maintain the exact same JSON structure: the same entries in the same order, with the same number of bullets in each
5. Do not use em-dashes (—) or their variants (---, --)
6. Make keyword incorporation the DEFAULT across all content sections, not an optional enhancement

Keywords to inject (only if supported by master resume):
{keywords_to_inject}

Current tailored resume:
{current_resume}

Master resume (source of truth):
{master_resume}

Job description context:
{job_description}

Output the complete resume JSON with keywords naturally integrated. Return ONLY valid JSON.`;

export const EMPHASIS_PROMPT = `A recruiter skims a CV for a few seconds before deciding whether to read it. Choose what to bold so that the skim alone shows why this candidate fits this job.

Job keywords:
{job_keywords}

CV lines, one per line as "path: text":
{lines}

Rules:
1. Bold at most one phrase per line, two only when both are essential.
2. Bold only what this job cares about: a quantified result (for example "cut deploy time by 40%") or a required skill or technology that is central to the line.
3. Leave a line with nothing relevant to this job unbolded. Roughly half the lines or fewer should have any bold.
4. Never bold a whole line, a full sentence, filler, job titles or generic words like "team" or "projects".
5. Each phrase is 1-5 words, copied exactly (same spelling and capitalisation) from its line, and appears only once in that line.
6. Read together, the bold phrases should sum up the candidate's fit for this job.

Output JSON with the lines you chose, each with its path and the phrases to bold.`;

export const COVER_LETTER_PROMPT = `Write a brief cover letter for this job application.

IMPORTANT: Write in British English.

Job Description:
{job_description}

Candidate Resume (JSON):
{resume_data}

What the candidate found out about the company (may be empty):
{company_research}

Requirements:
- 100-150 words maximum
- 3-4 short paragraphs
- Opening: Reference ONE specific thing from the job description (product, tech stack, or problem they're solving) - not generic excitement about "the role"
- Middle: Pick 1-2 qualifications from resume that DIRECTLY match stated requirements, and reframe them in the job's language/terminology where the candidate's proven experience supports it (e.g., if the resume shows "built automated data pipelines" and the job says "ETL," describe that real work as ETL) - prioritize relevance over impressiveness
- Closing: Simple availability to discuss, no desperate enthusiasm
- If resume shows career transition, frame the pivot as intentional and relevant
- Extract company name from job description - do not use placeholders
- Do NOT invent information not in the resume
- Tone: Confident peer, not eager applicant
- Do NOT use em dash ("—") anywhere in the writing/output, even if it exists, remove it

Output JSON with the greeting line, the paragraphs, and the sign-off line (for example "Kind regards,"), without the candidate's name.`;

export const GAPS_PROMPT = `Sort the skills this job asks for that the candidate's CV doesn't name word for word.

"implied": the CV shows the skill in other words, or it follows obviously from the candidate's work or field. A full-stack engineer has frontend and backend experience, anyone who built React apps knows JavaScript, and every software engineer codes. Generic parts of the candidate's own field always count as implied.
"ask": only specific skills with nothing in the CV pointing to them, so the candidate has to say whether they have them. At most 6, the most important first.
Put every skill in exactly one list.

Skills:
{skills}

CV:
{resume}`;

export const SYSTEM_PROMPTS = {
  gaps: "You judge which skills a CV already shows or clearly implies. Output only valid JSON.",
  keywords: "You extract structured job requirements. Output only valid JSON.",
  plan: "You are an expert resume editor. Output only valid JSON.",
  diffs: "You are an expert resume editor. Output only valid JSON with targeted changes.",
  inject: "You are a resume editor. Inject keywords naturally without adding fabricated content. Return only valid JSON matching the input schema.",
  emphasis: "You are an expert CV editor who knows how recruiters skim. Output only valid JSON.",
  letter: "You write concise, specific cover letters. Output only valid JSON.",
};

export function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key] : match));
}
