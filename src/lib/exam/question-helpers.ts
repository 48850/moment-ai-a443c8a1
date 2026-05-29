/**
 * question-helpers — pure functions for exam question state.
 *
 * selectVisibleQuestionFields is the single source of truth for answer hiding.
 * Both UI components and tests use this function — never render answer fields
 * directly from question state.
 */
import type { ExamQuestion, ExamQuestionAttempt, QuestionRating } from "@/lib/types";

export interface VisibleQuestionFields {
  question_text: string;
  question_type: ExamQuestion["question_type"];
  options?: string[];
  hint?: string;
  attempt?: ExamQuestionAttempt;
  revealed_without_attempt: boolean;
  // Only present when attempt exists OR revealed_without_attempt is true:
  correct_answer?: string;
  model_answer?: string;
  expected_points?: string[];
}

export function selectVisibleQuestionFields(question: ExamQuestion): VisibleQuestionFields {
  const answered = !!question.attempt || question.revealed_without_attempt;
  const base: VisibleQuestionFields = {
    question_text: question.question_text,
    question_type: question.question_type,
    revealed_without_attempt: question.revealed_without_attempt,
  };

  if (question.options) base.options = question.options;
  if (question.hint) base.hint = question.hint;
  if (question.attempt) base.attempt = question.attempt;

  if (answered) {
    if (question.correct_answer) base.correct_answer = question.correct_answer;
    if (question.model_answer) base.model_answer = question.model_answer;
    base.expected_points = question.expected_points ?? [];
  }

  return base;
}

export function isQuestionAnswered(question: ExamQuestion): boolean {
  return !!question.attempt || question.revealed_without_attempt;
}

export function nextUnansweredQuestion(questions: ExamQuestion[]): ExamQuestion | null {
  return questions.find((q) => !isQuestionAnswered(q)) ?? null;
}

export function drillSummary(questions: ExamQuestion[]): {
  total: number;
  answered: number;
  skipped: number;
  strongCount: number;
  needsWorkCount: number;
  topicWeaknesses: string[];
} {
  const answered = questions.filter((q) => !!q.attempt);
  const skipped = questions.filter((q) => q.revealed_without_attempt && !q.attempt);

  const ratings = answered
    .map((q) => q.attempt?.rating)
    .filter((r): r is QuestionRating => !!r);

  const strongCount = ratings.filter((r) => r.level === "strong" || r.level === "solid").length;
  const needsWorkCount = ratings.filter((r) => r.level === "needs_work" || r.level === "developing").length;

  const topicWeaknesses: string[] = [];
  for (const q of answered) {
    if (
      q.attempt?.rating?.level === "needs_work" ||
      q.attempt?.rating?.level === "developing"
    ) {
      if (q.topic_id && !topicWeaknesses.includes(q.topic_id)) {
        topicWeaknesses.push(q.topic_id);
      }
    }
  }

  return {
    total: questions.length,
    answered: answered.length,
    skipped: skipped.length,
    strongCount,
    needsWorkCount,
    topicWeaknesses,
  };
}
