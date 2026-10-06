# Third-party notice

The tailoring pipeline in this folder (`prompts.ts`, `resume.ts`, `keywords.ts`, `refine.ts`, `pipeline.ts`) is ported from [Resume-Matcher](https://github.com/srbhr/Resume-Matcher) (`apps/backend/app/prompts` and `apps/backend/app/services/{improver,refiner,ats}.py`), licensed under the Apache License 2.0 (copy in `LICENSE-resume-matcher`).

Changes from the original: rewritten in TypeScript for this app's CV structure (labelled skill groups, bullet ids, education details as a list); prompts adapted to those paths; each LLM step runs through Claude Code on the user's machine instead of LiteLLM; the cover letter is returned as greeting, paragraphs and sign-off; company research is passed to the skill plan, the edits and the cover letter; an added emphasis stage (not in the original) picks phrases to bold.
