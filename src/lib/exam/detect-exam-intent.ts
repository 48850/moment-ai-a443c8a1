import type { ExamIntentSignal } from "@/lib/types/exam-emergency";

const SUBJECT_MAP: Record<string, string> = {
  maths: "Maths", math: "Maths",
  biology: "Biology", bio: "Biology",
  chemistry: "Chemistry", chem: "Chemistry",
  physics: "Physics", phys: "Physics",
  history: "History", hist: "History",
  english: "English",
  french: "French", spanish: "Spanish", german: "German", latin: "Latin",
  geography: "Geography", geo: "Geography",
  psychology: "Psychology", psych: "Psychology",
  economics: "Economics", econ: "Economics",
  computing: "Computing", cs: "Computing",
  science: "Science",
};

const SUBJECT_PATTERN = new RegExp(
  `\\b(${Object.keys(SUBJECT_MAP).join("|")})\\b`,
  "i",
);

const EXAM_PATTERNS = [
  /\b(exam|test|mock|paper|assessment)\b/i,
  /\b(revise|revision|revising|study|studying|studied)\s+(for|before)\b/i,
  /\bhaven'?t\s+(started|revised|studied|done any|begun)\b/i,
  /\bneed to revise\b/i,
  /\bi'?m cooked\b/i,
  /\bexam emergency\b/i,
];

const CRITICAL_TIME = /(tonight|today|right now|in \d+ hours?|in a few hours?)/i;
const HIGH_TIME = /\btomorrow\b/i;
const MEDIUM_TIME = /\bthis week\b|\bin \d+ days?\b/i;

const FALSE_POSITIVE_GUARD = /\b(meeting|interview|doctor|dentist|appointment)\b/i;

function extractSubject(text: string): string | undefined {
  const m = text.match(SUBJECT_PATTERN);
  if (!m) return undefined;
  return SUBJECT_MAP[m[1].toLowerCase()];
}

function extractTimeframe(text: string): string | undefined {
  const critical = text.match(CRITICAL_TIME);
  if (critical) return critical[0];
  const high = text.match(HIGH_TIME);
  if (high) return "tomorrow";
  const med = text.match(MEDIUM_TIME);
  if (med) return med[0];
  return undefined;
}

export function detectExamIntent(text: string): ExamIntentSignal {
  if (!text) return { detected: false, urgencyLevel: "low" };

  const lower = text.toLowerCase();

  if (FALSE_POSITIVE_GUARD.test(lower) && !EXAM_PATTERNS.some((p) => p.test(lower))) {
    return { detected: false, urgencyLevel: "low" };
  }

  const hasExamPattern = EXAM_PATTERNS.some((p) => p.test(lower));
  if (!hasExamPattern) return { detected: false, urgencyLevel: "low" };

  const subject = extractSubject(text);
  const timeframe = extractTimeframe(text);

  let urgencyLevel: ExamIntentSignal["urgencyLevel"] = "low";
  if (CRITICAL_TIME.test(lower)) urgencyLevel = "critical";
  else if (HIGH_TIME.test(lower)) urgencyLevel = "high";
  else if (MEDIUM_TIME.test(lower)) urgencyLevel = "medium";

  return { detected: true, subject, timeframe, urgencyLevel };
}
