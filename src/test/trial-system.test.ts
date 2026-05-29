/**
 * Trial System — tests for trial helpers, mistake vault, and evidence vault integration.
 */
import { describe, it, expect } from "vitest";
import {
  createTrialFromForge,
  createTrialFromExam,
  ratingLevelFromAnswer,
  buildLocalFallbackRating,
  buildProofTextFromTrial,
} from "@/lib/trial/trial-helpers";
import { buildEvidenceVault } from "@/lib/portfolio/build-evidence-vault";
import type { MomentTrial, LearningToolResult, MistakeCard, ExamEmergency, ExamQuestion } from "@/lib/types";
import type { ForgeGuidebook } from "@/lib/types";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeGuidebook(overrides: Partial<ForgeGuidebook> = {}): ForgeGuidebook {
  return {
    id: "gb-1",
    title: "Mitosis Drill",
    description: "Practice explaining mitosis clearly",
    purpose: "Prove I can explain mitosis without looking at notes",
    feature_type: "drill_lab",
    bottleneck_addressed: "I always blank on the stages",
    linked_goal_id: "goal-1",
    required_inputs: [{ key: "notes", label: "Revision notes" }],
    steps: [],
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as unknown as ForgeGuidebook;
}

function makeExamEmergency(overrides: Partial<ExamEmergency> = {}): ExamEmergency {
  return {
    id: "exam-1",
    subject: "Biology",
    exam_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    hours_until_exam: 24,
    status: "active",
    resources: [{ id: "r1", title: "Notes", type: "notes", url: "" }],
    created_at: new Date().toISOString(),
    ...overrides,
  } as unknown as ExamEmergency;
}

function makeExamQuestion(overrides: Partial<ExamQuestion> = {}): ExamQuestion {
  return {
    id: "q-1",
    question_text: "Explain the stages of mitosis",
    question_type: "short_answer",
    created_at: new Date().toISOString(),
    revealed_without_attempt: false,
    expected_points: [],
    ...overrides,
  } as unknown as ExamQuestion;
}

function makeLearningToolResult(overrides: Partial<LearningToolResult> = {}): LearningToolResult {
  return {
    id: "r-1",
    trial_id: "trial-1",
    tool_type: "proof_drill",
    attempt_summary: "I explained prophase, metaphase, anaphase, and telophase correctly.",
    rating: {
      level: "solid",
      practice_estimate_label: "Solid",
      strengths: ["Covered all four stages"],
      missing_points: [],
      next_fix: "Add more detail on cytokinesis",
    },
    adaptation: {
      update_plan: false,
      add_review: false,
      create_mistake_card: false,
    },
    proof_event: {
      title: "Mitosis explanation",
      source: "forge",
      proof_text: "Proved I can explain mitosis — solid practice attempt.",
      skill_tags: ["biology", "mitosis"],
    },
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeWeakResult(trialId = "trial-1"): LearningToolResult {
  return makeLearningToolResult({
    trial_id: trialId,
    attempt_summary: "I only knew prophase.",
    rating: {
      level: "needs_work",
      practice_estimate_label: "Needs work",
      strengths: [],
      missing_points: ["metaphase", "anaphase", "cytokinesis"],
      next_fix: "Learn the full sequence of stages",
    },
    adaptation: {
      update_plan: false,
      add_review: true,
      create_mistake_card: true,
    },
    proof_event: {
      title: "Mitosis drill",
      source: "forge",
      proof_text: "Practised mitosis — needs work on stages.",
      skill_tags: ["biology"],
    },
  });
}

// ── createTrialFromForge ──────────────────────────────────────────────────────

describe("createTrialFromForge", () => {
  it("creates a trial with source: forge", () => {
    const guidebook = makeGuidebook();
    const trial = createTrialFromForge(guidebook);
    expect(trial.source).toBe("forge");
  });

  it("maps drill_lab feature_type to proof_drill mode", () => {
    const trial = createTrialFromForge(makeGuidebook({ feature_type: "drill_lab" }));
    expect(trial.mode).toBe("proof_drill");
  });

  it("maps proof_builder to pressure_test", () => {
    const trial = createTrialFromForge(makeGuidebook({ feature_type: "proof_builder" }));
    expect(trial.mode).toBe("pressure_test");
  });

  it("uses guidebook.purpose as proof_target", () => {
    const guidebook = makeGuidebook({ purpose: "Prove I can explain mitosis" });
    const trial = createTrialFromForge(guidebook);
    expect(trial.proof_target).toBe("Prove I can explain mitosis");
  });

  it("uses bottleneck_addressed as weakness_hypothesis", () => {
    const guidebook = makeGuidebook({ bottleneck_addressed: "I blank on stages" });
    const trial = createTrialFromForge(guidebook);
    expect(trial.weakness_hypothesis).toBe("I blank on stages");
  });

  it("starts with status: ready", () => {
    const trial = createTrialFromForge(makeGuidebook());
    expect(trial.status).toBe("ready");
  });
});

// ── createTrialFromExam ───────────────────────────────────────────────────────

describe("createTrialFromExam", () => {
  it("creates a trial with source: exam", () => {
    const trial = createTrialFromExam(makeExamEmergency(), makeExamQuestion());
    expect(trial.source).toBe("exam");
  });

  it("uses proof_drill mode for short_answer questions", () => {
    const trial = createTrialFromExam(makeExamEmergency(), makeExamQuestion({ question_type: "short_answer" }));
    expect(trial.mode).toBe("proof_drill");
  });

  it("uses answer_upgrade mode for essay questions", () => {
    const trial = createTrialFromExam(makeExamEmergency(), makeExamQuestion({ question_type: "essay" }));
    expect(trial.mode).toBe("answer_upgrade");
  });
});

// ── ratingLevelFromAnswer ─────────────────────────────────────────────────────

describe("ratingLevelFromAnswer", () => {
  it("returns needs_work for very short answers", () => {
    expect(ratingLevelFromAnswer(10, 0)).toBe("needs_work");
  });

  it("returns strong for long answers with many keywords", () => {
    expect(ratingLevelFromAnswer(120, 4)).toBe("strong");
  });

  it("returns solid for medium answers with 2+ keywords", () => {
    expect(ratingLevelFromAnswer(70, 2)).toBe("solid");
  });

  it("returns developing for medium-length answers", () => {
    expect(ratingLevelFromAnswer(50, 0)).toBe("developing");
  });
});

// ── buildLocalFallbackRating ──────────────────────────────────────────────────

describe("buildLocalFallbackRating", () => {
  it("returns a QuestionRating with practice_estimate_label", () => {
    const rating = buildLocalFallbackRating("short");
    expect(rating.practice_estimate_label).toBeDefined();
    expect(typeof rating.practice_estimate_label).toBe("string");
  });

  it("returns non-empty next_fix", () => {
    const rating = buildLocalFallbackRating("I think it produces ATP through glycolysis and the krebs cycle");
    expect(rating.next_fix.length).toBeGreaterThan(0);
  });

  it("returns needs_work for a very short answer", () => {
    const rating = buildLocalFallbackRating("idk");
    expect(rating.level).toBe("needs_work");
  });
});

// ── buildProofTextFromTrial ───────────────────────────────────────────────────

describe("buildProofTextFromTrial", () => {
  it("returns human-readable proof text", () => {
    const trial: MomentTrial = {
      id: "trial-1",
      source: "forge",
      proof_target: "Explain mitosis clearly",
      skill_target: "drill_lab",
      weakness_hypothesis: "",
      pressure_type: "skill",
      resource_ids: [],
      mode: "proof_drill",
      status: "rated",
      created_at: new Date().toISOString(),
    };
    const result = makeLearningToolResult();
    const text = buildProofTextFromTrial(trial, result);
    expect(text).toContain("Explain mitosis clearly");
    expect(text.length).toBeGreaterThan(20);
  });

  it("includes next_fix in the proof text", () => {
    const trial: MomentTrial = {
      id: "trial-1",
      source: "forge",
      proof_target: "Prove algebra skills",
      skill_target: "drill_lab",
      weakness_hypothesis: "",
      pressure_type: "skill",
      resource_ids: [],
      mode: "proof_drill",
      status: "rated",
      created_at: new Date().toISOString(),
    };
    const result = makeWeakResult();
    const text = buildProofTextFromTrial(trial, result);
    expect(text).toContain("Learn the full sequence of stages");
  });

  it("uses plain language — no bot/jargon terms", () => {
    const trial: MomentTrial = {
      id: "trial-1",
      source: "forge",
      proof_target: "Practice biology",
      skill_target: "drill_lab",
      weakness_hypothesis: "",
      pressure_type: "skill",
      resource_ids: [],
      mode: "proof_drill",
      status: "rated",
      created_at: new Date().toISOString(),
    };
    const result = makeLearningToolResult();
    const text = buildProofTextFromTrial(trial, result);
    expect(text).not.toMatch(/artifact|signal|telemetry|AI summary/i);
  });
});

// ── buildEvidenceVault: Trial proof ──────────────────────────────────────────

describe("buildEvidenceVault — trial proofs", () => {
  it("completed trial (proof_saved) appears in vault entries", () => {
    const trial: MomentTrial = {
      id: "trial-vault-1",
      source: "forge",
      proof_target: "Explain mitosis",
      skill_target: "drill_lab",
      weakness_hypothesis: "",
      pressure_type: "skill",
      resource_ids: [],
      mode: "proof_drill",
      status: "proof_saved",
      result: makeLearningToolResult({
        proof_event: {
          title: "Mitosis proof",
          source: "forge",
          proof_text: "Completed a solid practice attempt explaining mitosis.",
          skill_tags: [],
        },
      }),
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };

    const state = { moment_trials: [trial] } as any;
    const vault = buildEvidenceVault(state);
    const trialEntry = vault.entries.find((e) => e.id === `trial_proof_${trial.id}`);
    expect(trialEntry).toBeDefined();
    expect(trialEntry?.title).toBe("Mitosis proof");
  });

  it("active trial (in_progress) does not appear as proof", () => {
    const trial: MomentTrial = {
      id: "trial-active-1",
      source: "forge",
      proof_target: "In progress work",
      skill_target: "drill_lab",
      weakness_hypothesis: "",
      pressure_type: "skill",
      resource_ids: [],
      mode: "proof_drill",
      status: "in_progress",
      created_at: new Date().toISOString(),
    };

    const state = { moment_trials: [trial] } as any;
    const vault = buildEvidenceVault(state);
    const trialEntry = vault.entries.find((e) => e.id === `trial_proof_${trial.id}`);
    expect(trialEntry).toBeUndefined();
  });
});

// ── buildEvidenceVault: Repaired mistake proof ────────────────────────────────

describe("buildEvidenceVault — repaired mistake cards", () => {
  it("repaired MistakeCard appears in vault entries as task_proof", () => {
    const card: MistakeCard = {
      id: "mc-repaired-1",
      source: "exam",
      mistake_type: "weak_explanation",
      mistake: "Confused metaphase and anaphase",
      correction: "Metaphase = chromosomes line up; Anaphase = they pull apart",
      review_due_at: new Date().toISOString(),
      status: "repaired",
      created_at: new Date().toISOString(),
    };

    const state = { mistake_cards: [card] } as any;
    const vault = buildEvidenceVault(state);
    const repairEntry = vault.entries.find((e) => e.id === `mistake_repair_${card.id}`);
    expect(repairEntry).toBeDefined();
    expect(repairEntry?.type).toBe("task_proof");
  });

  it("open MistakeCard does not appear as proof", () => {
    const card: MistakeCard = {
      id: "mc-open-1",
      source: "exam",
      mistake_type: "weak_explanation",
      mistake: "Confused mitosis and meiosis",
      correction: "",
      review_due_at: new Date().toISOString(),
      status: "open",
      created_at: new Date().toISOString(),
    };

    const state = { mistake_cards: [card] } as any;
    const vault = buildEvidenceVault(state);
    const openEntry = vault.entries.find((e) => e.id === `mistake_repair_${card.id}`);
    expect(openEntry).toBeUndefined();
  });

  it("repair proof_of_completion contains the correction text", () => {
    const card: MistakeCard = {
      id: "mc-repaired-2",
      source: "forge",
      mistake_type: "forgot_fact",
      mistake: "Forgot ATP full name",
      correction: "Adenosine Triphosphate",
      review_due_at: new Date().toISOString(),
      status: "repaired",
      created_at: new Date().toISOString(),
    };

    const state = { mistake_cards: [card] } as any;
    const vault = buildEvidenceVault(state);
    const entry = vault.entries.find((e) => e.id === `mistake_repair_${card.id}`);
    expect(entry).toBeDefined();
    if (entry && "proof_of_completion" in entry) {
      expect(entry.proof_of_completion).toBe("Adenosine Triphosphate");
    }
  });
});
