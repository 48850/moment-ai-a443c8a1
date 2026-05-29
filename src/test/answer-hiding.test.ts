/**
 * Answer Hiding — tests for selectVisibleQuestionFields and exam question actions.
 */
import { describe, it, expect } from "vitest";
import {
  selectVisibleQuestionFields,
  isQuestionAnswered,
  nextUnansweredQuestion,
} from "@/lib/exam/question-helpers";
import type { ExamQuestion } from "@/lib/types";

function makeQuestion(overrides: Partial<ExamQuestion> = {}): ExamQuestion {
  return {
    id: crypto.randomUUID(),
    question_text: "What is the function of mitochondria?",
    question_type: "short_answer",
    correct_answer: "Produces ATP via cellular respiration",
    model_answer: "The mitochondria produce ATP through cellular respiration, acting as the powerhouse of the cell.",
    expected_points: ["ATP production", "cellular respiration", "energy release"],
    hint: "Think about energy currency in cells",
    created_at: new Date().toISOString(),
    revealed_without_attempt: false,
    ...overrides,
  };
}

function makeMCQQuestion(overrides: Partial<ExamQuestion> = {}): ExamQuestion {
  return {
    id: crypto.randomUUID(),
    question_text: "Which organelle produces ATP?",
    question_type: "multiple_choice",
    options: ["Nucleus", "Mitochondria", "Ribosome", "Vacuole"],
    correct_answer: "Mitochondria",
    model_answer: "Mitochondria are the site of cellular respiration.",
    expected_points: ["mitochondria"],
    created_at: new Date().toISOString(),
    revealed_without_attempt: false,
    ...overrides,
  };
}

// ── Before attempt — answer fields hidden ────────────────────────────────────

describe("selectVisibleQuestionFields — before attempt", () => {
  it("does not expose correct_answer before attempt", () => {
    const q = makeQuestion();
    const visible = selectVisibleQuestionFields(q);
    expect(visible.correct_answer).toBeUndefined();
  });

  it("does not expose model_answer before attempt", () => {
    const q = makeQuestion();
    const visible = selectVisibleQuestionFields(q);
    expect(visible.model_answer).toBeUndefined();
  });

  it("does not expose expected_points before attempt", () => {
    const q = makeQuestion();
    const visible = selectVisibleQuestionFields(q);
    expect(visible.expected_points).toBeUndefined();
  });

  it("exposes question_text and question_type before attempt", () => {
    const q = makeQuestion();
    const visible = selectVisibleQuestionFields(q);
    expect(visible.question_text).toBe(q.question_text);
    expect(visible.question_type).toBe(q.question_type);
  });

  it("exposes hint before attempt", () => {
    const q = makeQuestion();
    const visible = selectVisibleQuestionFields(q);
    expect(visible.hint).toBe(q.hint);
  });

  it("MCQ: options visible before attempt", () => {
    const q = makeMCQQuestion();
    const visible = selectVisibleQuestionFields(q);
    expect(visible.options).toEqual(["Nucleus", "Mitochondria", "Ribosome", "Vacuole"]);
  });

  it("MCQ: correct_answer NOT visible before attempt", () => {
    const q = makeMCQQuestion();
    const visible = selectVisibleQuestionFields(q);
    expect(visible.correct_answer).toBeUndefined();
  });
});

// ── After attempt — answer fields visible ────────────────────────────────────

describe("selectVisibleQuestionFields — after attempt", () => {
  it("exposes correct_answer after attempt", () => {
    const q = makeQuestion({
      attempt: {
        submitted_at: new Date().toISOString(),
        answer_text: "Makes energy",
      },
    });
    const visible = selectVisibleQuestionFields(q);
    expect(visible.correct_answer).toBe("Produces ATP via cellular respiration");
  });

  it("exposes model_answer after attempt", () => {
    const q = makeQuestion({
      attempt: {
        submitted_at: new Date().toISOString(),
        answer_text: "Makes energy",
      },
    });
    const visible = selectVisibleQuestionFields(q);
    expect(visible.model_answer).toBeDefined();
  });

  it("exposes expected_points after attempt", () => {
    const q = makeQuestion({
      attempt: {
        submitted_at: new Date().toISOString(),
        answer_text: "Makes energy",
      },
    });
    const visible = selectVisibleQuestionFields(q);
    expect(visible.expected_points).toEqual(["ATP production", "cellular respiration", "energy release"]);
  });

  it("exposes attempt object after submit", () => {
    const attempt = { submitted_at: new Date().toISOString(), answer_text: "Makes energy" };
    const q = makeQuestion({ attempt });
    const visible = selectVisibleQuestionFields(q);
    expect(visible.attempt).toEqual(attempt);
  });
});

// ── After reveal_without_attempt ─────────────────────────────────────────────

describe("selectVisibleQuestionFields — after reveal_without_attempt", () => {
  it("exposes correct_answer when revealed_without_attempt is true", () => {
    const q = makeQuestion({ revealed_without_attempt: true });
    const visible = selectVisibleQuestionFields(q);
    expect(visible.correct_answer).toBe("Produces ATP via cellular respiration");
  });

  it("exposes model_answer when revealed_without_attempt is true", () => {
    const q = makeQuestion({ revealed_without_attempt: true });
    const visible = selectVisibleQuestionFields(q);
    expect(visible.model_answer).toBeDefined();
  });

  it("exposes expected_points when revealed_without_attempt is true", () => {
    const q = makeQuestion({ revealed_without_attempt: true });
    const visible = selectVisibleQuestionFields(q);
    expect(visible.expected_points).toEqual(["ATP production", "cellular respiration", "energy release"]);
  });

  it("revealed_without_attempt flag is preserved in visible fields", () => {
    const q = makeQuestion({ revealed_without_attempt: true });
    const visible = selectVisibleQuestionFields(q);
    expect(visible.revealed_without_attempt).toBe(true);
  });
});

// ── isQuestionAnswered ────────────────────────────────────────────────────────

describe("isQuestionAnswered", () => {
  it("returns false when no attempt and not revealed", () => {
    expect(isQuestionAnswered(makeQuestion())).toBe(false);
  });

  it("returns true when attempt exists", () => {
    const q = makeQuestion({
      attempt: { submitted_at: new Date().toISOString(), answer_text: "answer" },
    });
    expect(isQuestionAnswered(q)).toBe(true);
  });

  it("returns true when revealed_without_attempt is true", () => {
    const q = makeQuestion({ revealed_without_attempt: true });
    expect(isQuestionAnswered(q)).toBe(true);
  });
});

// ── nextUnansweredQuestion ────────────────────────────────────────────────────

describe("nextUnansweredQuestion", () => {
  it("returns first unanswered question", () => {
    const q1 = makeQuestion({
      attempt: { submitted_at: new Date().toISOString(), answer_text: "done" },
    });
    const q2 = makeQuestion();
    const q3 = makeQuestion();
    expect(nextUnansweredQuestion([q1, q2, q3])).toBe(q2);
  });

  it("returns null when all answered", () => {
    const q1 = makeQuestion({ revealed_without_attempt: true });
    const q2 = makeQuestion({
      attempt: { submitted_at: new Date().toISOString(), answer_text: "done" },
    });
    expect(nextUnansweredQuestion([q1, q2])).toBeNull();
  });

  it("returns null on empty array", () => {
    expect(nextUnansweredQuestion([])).toBeNull();
  });
});
