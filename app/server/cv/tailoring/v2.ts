import type { TailorRequest } from "~/types/cv";
import type { Stage } from "./pipeline";
import { DIFF_IMPROVE_PROMPT, WRITING_RULES } from "./prompts";

export const V2_JOB_CHARS = 6000;

const SONNET = "claude-sonnet-5-5";
const HAIKU = "claude-haiku-5-5";

export const V2_MODEL_CAPS: Partial<Record<Stage, TailorRequest["model"]>> = {
  plan: SONNET,
  inject: SONNET,
  letter: SONNET,
  emphasis: HAIKU,
};

export const INJECT_CHANGES_PROMPT = `Work the following skills back into this resume by reframing the candidate's existing experience in the job description's language, wherever they fit naturally.

CRITICAL RULES:
1. Only reframe with keywords the master resume substantively supports (e.g., if the master shows "used Python for data analysis", surface "Python" and "data analysis" language)
2. Do NOT add skills, technologies, or certifications not in the master resume
3. Only rephrase existing lines: the summary, a bullet, or an education detail. Never add or remove a line
4. Do not use em-dashes (—) or their variants (---, --)
5. Add a skill only where it reads naturally; leave a skill out rather than force it into a line
6. Return a change only for a line you actually rephrase. Copy the line's current text exactly into "original"

${WRITING_RULES}

PATHS you can target (action is always "replace"):
- "summary"
- "workExperience[i].description[j]"
- "personalProjects[i].description[j]"
- "education[i].description[j]"

Keywords to inject (only if supported by master resume):
{keywords_to_inject}

Current tailored resume:
{current_resume}

Master resume (source of truth):
{master_resume}

Job description context:
{job_description}

Output this exact JSON format, nothing else:
{
  "changes": [
    {
      "path": "workExperience[0].description[1]",
      "action": "replace",
      "original": "the exact current text at this path",
      "value": "the rephrased text",
      "reason": "which keyword this works in"
    }
  ],
  "strategy_notes": ""
}`;

const V2_DIFF_RULES: [string, string][] = [
  ["5. Each change MUST include the original text (copied exactly) so it can be verified", "5. Target each line by the path shown before it in the resume below. Don't copy the original text back; code looks it up from the path"],
  ["6. For each change, explain WHY it helps match the job description", "6. Give each change a reason of at most 12 words saying why it helps"],
  [
    "16. Before answering, go through every bullet in workExperience and personalProjects one at a time and check it against the CV WRITING RULES, above all the action verb + task or project + outcome structure, a number wherever the CV supports one and no number or time period repeated across bullets, the full stop rule, no pronouns or articles, and no opening verb used more than twice. Return a change for each bullet that fails.",
    "16. Code has already checked every bullet for the mechanical rules: pronouns, articles, opening verbs used more than twice, repeated numbers, missing numbers and length. Full stops are evened out by code afterwards, so ignore them. Return a change for every bullet listed under MECHANICAL ISSUES, and don't recheck the others for these rules. Spend your attention on what code can't check: the action verb + task + outcome structure, plain natural wording, and matching the job (rules 11 and 14).",
  ],
  ["Original Resume:\n{original_resume}", "MECHANICAL ISSUES (found by code):\n{writing_audit}\n\nOriginal Resume (each line is path: text):\n{original_resume}"],
];

export const DIFF_V2_PROMPT = V2_DIFF_RULES.reduce((prompt, [from, to]) => {
  if (!prompt.includes(from)) throw new Error(`v2 diff prompt is out of date: missing "${from.slice(0, 40)}"`);
  return prompt.replace(from, to);
}, DIFF_IMPROVE_PROMPT).replace(/^\s*"original": .*\n/gm, "");

