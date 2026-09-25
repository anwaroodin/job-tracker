import type { EmailCategory } from "~/lib/email";

export type { EmailCategory };

export interface EmailInput {
  subject: string;
  body: string;
  from?: string;
}

export const CLASSIFIER_VERSION = 1;

// first match wins, so order matters. rejections tend to say things like
// "thanks for interviewing" which would otherwise land in interview
const RULES: Array<[Exclude<EmailCategory, "other">, RegExp[]]> = [
  [
    "offer",
    [
      /offer letter/i,
      /pleased to (extend|offer)/i,
      /(job|employment|formal|verbal) offer/i,
      /we('d| would) like to offer you/i,
    ],
  ],
  [
    "rejected",
    [
      /unfortunately/i,
      /after careful consideration/i,
      /decided to (move|proceed|go|pursue) (forward )?with (another|other)/i,
      /(pursue|progress) other (candidates|applicants)/i,
      /not (be )?(moving|progressing) forward/i,
      /(regret|sorry) to inform/i,
      /no longer (being )?considered/i,
      /position has been filled/i,
      /will not be (moving|proceeding|progressing)/i,
      /not (been )?successful/i,
      /\bunsuccessful\b/i,
    ],
  ],
  [
    "assessment",
    [
      /complete (the|an|our|your) (\w+ )?(assessment|test)/i,
      /online assessment/i,
      /assessment (link|invitation|invite)/i,
      /coding (challenge|test|exercise)/i,
      /take[- ]home/i,
      /online test/i,
      /\b(hackerrank|codility|codesignal|testgorilla|hirevue|leetcode)\b/i,
      /psychometric/i,
      /aptitude test/i,
    ],
  ],
  [
    "interview",
    [
      /invit(e|ing) you to (an? |the )?(\w+ )?interview/i,
      /interview (invitation|invite|request|confirmation)/i,
      /(schedule|book|arrange) (an?|your|the) (\w+ )?interview/i,
      /availability for (an? |the )?(\w+ )?interview/i,
      /schedule (a|your) (call|chat|meeting)/i,
      /(meet|speak) with (the|our) (team|hiring manager)/i,
      /\b(onsite|on-site|final round|next round)\b/i,
      /calendly\.com/i,
    ],
  ],
  [
    "screening",
    [
      /phone screen/i,
      /recruiter (call|chat)/i,
      /(intro|introductory|initial) (call|chat|conversation)/i,
      /(would|'d) (like|love) to (talk|speak|chat) (to|with) you/i,
    ],
  ],
  [
    "applied",
    [
      /thank(s| you) for (your )?(applying|application|interest)/i,
      /application (has been )?(received|submitted)/i,
      /we('ve| have) received your application/i,
      /successfully (applied|submitted)/i,
      /\bsuccessful application/i,
      /application confirmation/i,
      // job board confirmations: linkedin, indeed
      /your application was sent to/i,
      /your application to .+ at /i,
      /indeed application:/i,
    ],
  ],
];

export function classifyEmail({ subject, body }: EmailInput): EmailCategory {
  const text = `${subject}\n${body}`;
  for (const [category, patterns] of RULES) {
    if (patterns.some((p) => p.test(text))) return category;
  }
  return "other";
}
