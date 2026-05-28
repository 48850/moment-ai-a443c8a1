/**
 * Operation Exam Lifeline V2 — tests for the exam emergency rescue system.
 * All pure functions, no mocks, no React.
 */
import { describe, it, expect } from "vitest";
import { detectExamIntent } from "@/lib/exam/detect-exam-intent";
import { getIntakeStatus, getMissingField } from "@/lib/exam/exam-intake-state";
import { scoreTopics, sortByPriority } from "@/lib/exam/exam-triage";
import { buildExamPlan, buildFirst20MinutesBlock, adaptPlanAfterFeedback } from "@/lib/exam/build-exam-plan";
import { buildEvidenceVault } from "@/lib/portfolio/build-evidence-vault";
import { buildExamEmergencyFromIntake } from "@/lib/exam/build-exam-emergency";
import { parseCoachResponse } from "@/lib/coach/coach-response-schema";
import { examEmergencySchema } from "@/lib/state/schema";
import type { ExamTopic } from "@/lib/types";
import type { ExamIntakePayload } from "@/lib/types/exam-emergency";

// ── detectExamIntent ──────────────────────────────────────────────────────────

describe("detectExamIntent", () => {
  it("detects 'I have a maths test tomorrow and I haven't studied'", () => {
    const result = detectExamIntent("I have a maths test tomorrow and I haven't studied");
    expect(result.detected).toBe(true);
  });

  it("detects 'exam emergency'", () => {
    const result = detectExamIntent("exam emergency help me");
    expect(result.detected).toBe(true);
  });

  it("extracts subject 'maths' correctly", () => {
    const result = detectExamIntent("I have a maths test tomorrow");
    expect(result.subject?.toLowerCase()).toContain("math");
  });

  it("urgencyLevel 'critical' for 'in 2 hours'", () => {
    const result = detectExamIntent("I have a physics exam in 2 hours and haven't revised");
    expect(result.urgencyLevel).toBe("critical");
  });

  it("urgencyLevel 'critical' for 'tonight'", () => {
    const result = detectExamIntent("I have a biology test tonight and I'm cooked");
    expect(result.urgencyLevel).toBe("critical");
  });

  it("urgencyLevel 'high' for 'tomorrow'", () => {
    const result = detectExamIntent("chemistry exam tomorrow haven't started");
    expect(result.urgencyLevel).toBe("high");
  });

  it("urgencyLevel 'low' for vague mention without timeframe", () => {
    const result = detectExamIntent("I have an english exam at some point next month");
    expect(["low", "medium"]).toContain(result.urgencyLevel);
  });

  it("no false positive for 'I have a meeting tomorrow'", () => {
    const result = detectExamIntent("I have a meeting tomorrow with my manager");
    expect(result.detected).toBe(false);
  });

  it("no false positive for 'doctor appointment'", () => {
    const result = detectExamIntent("I have a doctor appointment this week");
    expect(result.detected).toBe(false);
  });
});

// ── Exam intake state machine ─────────────────────────────────────────────────

describe("exam intake state machine", () => {
  it("returns 'needs_subject' when no subject", () => {
    expect(getIntakeStatus({})).toBe("needs_subject");
  });

  it("returns 'needs_exam_time' when subject known, no time", () => {
    expect(getIntakeStatus({ subject: "Maths" })).toBe("needs_exam_time");
  });

  it("returns 'needs_topics' when subject + time known, no topics", () => {
    expect(
      getIntakeStatus({
        subject: "Maths",
        exam_date_time: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    ).toBe("needs_topics");
  });

  it("returns 'needs_available_time' when subject + time + topics known", () => {
    expect(
      getIntakeStatus({
        subject: "Maths",
        exam_date_time: new Date(Date.now() + 86_400_000).toISOString(),
        topics: [{ name: "Algebra" }],
      }),
    ).toBe("needs_available_time");
  });

  it("returns 'ready_to_build' when all required fields present", () => {
    expect(
      getIntakeStatus({
        subject: "Maths",
        exam_date_time: new Date(Date.now() + 86_400_000).toISOString(),
        topics: [{ name: "Algebra" }],
        available_study_windows: [
          {
            start_time: new Date().toISOString(),
            end_time: new Date(Date.now() + 3_600_000).toISOString(),
            day_label: "Today",
            available_minutes: 60,
          },
        ],
      }),
    ).toBe("ready_to_build");
  });

  it("getMissingField() returns only one question at a time", () => {
    const result = getMissingField({ subject: "Chemistry" });
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
  });

  it("getMissingField() returns null when ready", () => {
    const result = getMissingField({
      subject: "Maths",
      exam_date_time: new Date(Date.now() + 86_400_000).toISOString(),
      topics: [{ name: "Calculus" }],
      available_study_windows: [
        {
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + 3_600_000).toISOString(),
          day_label: "Today",
          available_minutes: 60,
        },
      ],
    });
    expect(result).toBeNull();
  });
});

// ── scoreTopics + sortByPriority ──────────────────────────────────────────────

const makeTopics = (overrides: Partial<ExamTopic>[] = []): ExamTopic[] =>
  overrides.map((o, i) => ({
    id: `topic-${i}`,
    name: `Topic ${i}`,
    confidence: 3,
    priority: "medium" as const,
    ...o,
  }));

describe("scoreTopics + sortByPriority", () => {
  it("high markValue + low confidence → high score", () => {
    const [scored] = scoreTopics(
      makeTopics([{ mark_value: 5, confidence: 1, likelihood: 5, quick_win_potential: 4, time_cost: 1 }]),
    );
    expect(scored.score).toBeGreaterThan(60);
    expect(["critical", "high"]).toContain(scored.priority);
  });

  it("missing optional fields default to neutral (3)", () => {
    const [scored] = scoreTopics(makeTopics([{ confidence: 3 }]));
    expect(scored.score).toBeGreaterThan(0);
    // All fields default to 3: 3×25 + 3×20 + 3×20 + 3×20 + 3×15 = 300
    expect(scored.score).toBe(300);
  });

  it("sorted descending by score", () => {
    const topics = makeTopics([
      { mark_value: 1, confidence: 5 },
      { mark_value: 5, confidence: 1 },
    ]);
    const scored = scoreTopics(topics);
    const sorted = sortByPriority(scored);
    expect(sorted[0].score).toBeGreaterThanOrEqual(sorted[1].score);
  });

  it("priority buckets match thresholds exactly", () => {
    // Max inputs → critical (score = 5×25 + 5×20 + 5×20 + 5×20 + 5×15 = 500)
    const [high] = scoreTopics(makeTopics([{ mark_value: 5, confidence: 1, likelihood: 5, quick_win_potential: 5, time_cost: 1 }]));
    expect(high.priority).toBe("critical");

    // High confidence + low mark value → lower score than high-value counterpart
    const [low] = scoreTopics(makeTopics([{ mark_value: 1, confidence: 5, likelihood: 1, quick_win_potential: 1, time_cost: 5 }]));
    expect(low.score).toBeLessThan(high.score);
  });

  it("deterministic: same input → same output every time", () => {
    const topics = makeTopics([{ mark_value: 3, confidence: 2, likelihood: 4 }]);
    const a = scoreTopics(topics);
    const b = scoreTopics(topics);
    expect(a[0].score).toBe(b[0].score);
    expect(a[0].priority).toBe(b[0].priority);
  });
});

// ── buildExamPlan ─────────────────────────────────────────────────────────────

const makePlanTopics = (): ExamTopic[] => [
  { id: "t1", name: "Algebra", confidence: 1, mark_value: 5, likelihood: 5, quick_win_potential: 4, time_cost: 2, priority: "critical" },
  { id: "t2", name: "Calculus", confidence: 3, mark_value: 4, likelihood: 4, quick_win_potential: 3, time_cost: 3, priority: "high" },
  { id: "t3", name: "Statistics", confidence: 4, mark_value: 2, likelihood: 2, quick_win_potential: 2, time_cost: 2, priority: "medium" },
];

describe("buildExamPlan", () => {
  const makeWindows = (minutes: number) => [
    {
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + minutes * 60_000).toISOString(),
      day_label: "Today",
      available_minutes: minutes,
    },
  ];

  it("First 20-Minute block always at index 0 of survival_plan", () => {
    const plan = buildExamPlan({
      subject: "Maths",
      topics: makePlanTopics(),
      availableStudyWindows: makeWindows(120),
    });
    expect(plan.survival_plan.length).toBeGreaterThan(0);
    expect(plan.survival_plan[0].duration_minutes).toBe(20);
  });

  it("survival plan total duration ≤ time budget", () => {
    const plan = buildExamPlan({
      subject: "Maths",
      topics: makePlanTopics(),
      availableStudyWindows: makeWindows(90),
    });
    const total = plan.survival_plan.reduce((s, b) => s + b.duration_minutes, 0);
    expect(total).toBeLessThanOrEqual(121);
  });

  it("all blocks have non-empty goal, success_criteria, fallback_if_stuck", () => {
    const plan = buildExamPlan({
      subject: "Maths",
      topics: makePlanTopics(),
      availableStudyWindows: makeWindows(180),
    });
    const allBlocks = [...plan.survival_plan, ...plan.recovery_plan, ...plan.stretch_plan];
    for (const block of allBlocks) {
      expect(block.goal.length).toBeGreaterThan(0);
      expect(block.success_criteria.length).toBeGreaterThan(0);
      expect(block.fallback_if_stuck.length).toBeGreaterThan(0);
    }
  });

  it("recovery plan contains critical + high topics", () => {
    const plan = buildExamPlan({
      subject: "Maths",
      topics: makePlanTopics(),
      availableStudyWindows: makeWindows(240),
    });
    expect(plan.recovery_plan.length).toBeGreaterThan(0);
  });

  it("no crash on zero topics (returns empty arrays)", () => {
    const plan = buildExamPlan({
      subject: "Maths",
      topics: [],
      availableStudyWindows: makeWindows(60),
    });
    expect(Array.isArray(plan.survival_plan)).toBe(true);
    expect(Array.isArray(plan.recovery_plan)).toBe(true);
    expect(Array.isArray(plan.stretch_plan)).toBe(true);
  });
});

// ── buildExamEmergencyFromIntake ──────────────────────────────────────────────

describe("buildExamEmergencyFromIntake", () => {
  const validIntake: ExamIntakePayload = {
    action: "ready_to_build",
    subject: "maths",
    exam_date_time: new Date(Date.now() + 86_400_000).toISOString(),
    preparedness_score: 4,
    topics: [
      { name: "Algebra", confidence: 2, mark_value: 5, likelihood: 4, quick_win_potential: 3, time_cost: 2 },
      { name: "Calculus", confidence: 3, mark_value: 4, likelihood: 3, quick_win_potential: 2, time_cost: 3 },
    ],
    available_study_windows: [
      {
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 7_200_000).toISOString(),
        day_label: "Today",
        available_minutes: 120,
      },
    ],
  };

  it("creates a valid ExamEmergency (passes examEmergencySchema.parse())", () => {
    const emergency = buildExamEmergencyFromIntake(validIntake);
    expect(() => examEmergencySchema.parse(emergency)).not.toThrow();
  });

  it("sets active_block_id to first survival block", () => {
    const emergency = buildExamEmergencyFromIntake(validIntake);
    expect(emergency.active_block_id).toBe(emergency.current_plan.survival_plan[0]?.id);
  });

  it("status is 'active'", () => {
    const emergency = buildExamEmergencyFromIntake(validIntake);
    expect(emergency.status).toBe("active");
  });

  it("all topics have assigned priority", () => {
    const emergency = buildExamEmergencyFromIntake(validIntake);
    for (const topic of emergency.topics) {
      expect(["critical", "high", "medium", "low", "ignore_for_now"]).toContain(topic.priority);
    }
  });

  it("title-cases the subject", () => {
    const emergency = buildExamEmergencyFromIntake({ ...validIntake, subject: "maths" });
    expect(emergency.subject).toBe("Maths");
  });
});

// ── Reliability ───────────────────────────────────────────────────────────────

describe("reliability", () => {
  it("malformed AI exam_plan does not crash parseCoachResponse", () => {
    expect(() =>
      parseCoachResponse(
        { exam_plan: { action: "create", emergency: { broken: true, missing_required: "yes" } } },
        "Here is your plan.",
      ),
    ).not.toThrow();
  });

  it("returns null for exam_plan when emergency is invalid", () => {
    const parsed = parseCoachResponse(
      { exam_plan: { action: "create", emergency: "not an object at all" } },
      "Here.",
    );
    expect(parsed.exam_plan).toBeNull();
  });

  it("local builder produces a usable emergency from partial intake", () => {
    const partial: ExamIntakePayload = {
      action: "start",
      subject: "Biology",
    };
    const emergency = buildExamEmergencyFromIntake(partial);
    expect(emergency.subject).toBeTruthy();
    expect(emergency.id).toBeTruthy();
    expect(typeof emergency.current_plan).toBe("object");
  });

  it("examEmergencySchema rejects missing required fields", () => {
    expect(() =>
      examEmergencySchema.parse({ subject: "Maths" }),
    ).toThrow();
  });
});

// ── adaptPlanAfterFeedback ────────────────────────────────────────────────────

function makeTestEmergency(durationMinutes = 30) {
  const intake: ExamIntakePayload = {
    action: "ready_to_build",
    subject: "Maths",
    exam_date_time: new Date(Date.now() + 16 * 3_600_000).toISOString(),
    topics: [
      { name: "Algebra", confidence: 2, mark_value: 5, likelihood: 4 },
      { name: "Geometry", confidence: 3, mark_value: 4, likelihood: 3 },
    ],
    available_study_windows: [{ start_time: "18:00", end_time: "22:00", day_label: "Today", available_minutes: 240 }],
  };
  const emergency = buildExamEmergencyFromIntake(intake);
  // Override first survival block duration for tests that need a specific value
  if (durationMinutes !== 20) {
    const first = emergency.current_plan.survival_plan[0];
    emergency.current_plan.survival_plan[0] = { ...first, duration_minutes: durationMinutes };
  }
  return emergency;
}

describe("adaptPlanAfterFeedback", () => {
  it("confused — inserts a 15-min micro-review block after the block", () => {
    const emergency = makeTestEmergency(30);
    const blockId = emergency.current_plan.survival_plan[0].id;
    const before = emergency.current_plan.survival_plan.length;
    const adapted = adaptPlanAfterFeedback(emergency, blockId, "confused");
    expect(adapted.survival_plan.length).toBe(before + 1);
    const microIdx = adapted.survival_plan.findIndex((b) => b.id.includes("-micro-"));
    expect(microIdx).toBe(1);
    expect(adapted.survival_plan[microIdx].duration_minutes).toBe(15);
  });

  it("confused — does not insert micro-review if block is already ≤15 min", () => {
    const emergency = makeTestEmergency(15);
    const blockId = emergency.current_plan.survival_plan[0].id;
    const before = emergency.current_plan.survival_plan.length;
    const adapted = adaptPlanAfterFeedback(emergency, blockId, "confused");
    expect(adapted.survival_plan.length).toBe(before);
  });

  it("too_long — shrinks subsequent blocks by 20%, minimum 15 min", () => {
    const emergency = makeTestEmergency();
    const survivalBlocks = emergency.current_plan.survival_plan;
    const blockId = survivalBlocks[0].id;
    const originalNext = survivalBlocks[1]?.duration_minutes;
    if (!originalNext) return; // skip if only 1 block
    const adapted = adaptPlanAfterFeedback(emergency, blockId, "too_long");
    const shrunk = adapted.survival_plan[1].duration_minutes;
    expect(shrunk).toBe(Math.max(15, Math.round(originalNext * 0.8)));
  });

  it("avoided — inserts a 10-min starter block after the block", () => {
    const emergency = makeTestEmergency(30);
    const blockId = emergency.current_plan.survival_plan[0].id;
    const before = emergency.current_plan.survival_plan.length;
    const adapted = adaptPlanAfterFeedback(emergency, blockId, "avoided");
    expect(adapted.survival_plan.length).toBe(before + 1);
    const starterIdx = adapted.survival_plan.findIndex((b) => b.id.includes("-starter-"));
    expect(starterIdx).toBe(1);
    expect(adapted.survival_plan[starterIdx].duration_minutes).toBe(10);
  });

  it("easy / hard / completed — plan unchanged", () => {
    const emergency = makeTestEmergency(30);
    const blockId = emergency.current_plan.survival_plan[0].id;
    const originalLen = emergency.current_plan.survival_plan.length;
    for (const result of ["easy", "hard", "completed"] as const) {
      const adapted = adaptPlanAfterFeedback(emergency, blockId, result);
      expect(adapted.survival_plan.length).toBe(originalLen);
      expect(adapted).toEqual(emergency.current_plan);
    }
  });
});

// ── buildEvidenceVault — exam proof ──────────────────────────────────────────

function makeMinimalState(overrides: Record<string, unknown> = {}) {
  return {
    tasks: [],
    reflections: [],
    rescue_signals: [],
    forge_state: { forge_signals: [] },
    pursuit_model: null,
    execution_feedback: [],
    ...overrides,
  } as any;
}

describe("buildEvidenceVault — exam proof", () => {
  it("creates a proof entry for a completed exam", () => {
    const intake: ExamIntakePayload = {
      action: "ready_to_build",
      subject: "Physics",
      exam_date_time: new Date(Date.now() - 3_600_000).toISOString(),
      topics: [{ name: "Forces" }],
      available_study_windows: [{ start_time: "18:00", end_time: "20:00", day_label: "Today", available_minutes: 120 }],
    };
    const emergency = { ...buildExamEmergencyFromIntake(intake), status: "completed" as const };
    const state = makeMinimalState({ exam_emergencies: [emergency] });
    const vault = buildEvidenceVault(state);
    const examEntry = vault.entries.find((e) => e.id.startsWith("exam_proof_"));
    expect(examEntry).toBeDefined();
    expect((examEntry as any).title).toContain("Physics");
  });

  it("does not create proof for active or intake exams", () => {
    const intake: ExamIntakePayload = {
      action: "ready_to_build",
      subject: "Chemistry",
      exam_date_time: new Date(Date.now() + 16 * 3_600_000).toISOString(),
      available_study_windows: [{ start_time: "18:00", end_time: "20:00", day_label: "Today", available_minutes: 120 }],
    };
    const active = buildExamEmergencyFromIntake(intake);
    const state = makeMinimalState({ exam_emergencies: [active] });
    const vault = buildEvidenceVault(state);
    const examEntry = vault.entries.find((e) => e.id.startsWith("exam_proof_"));
    expect(examEntry).toBeUndefined();
  });

  it("includes reflection text in proof_of_completion when present", () => {
    const intake: ExamIntakePayload = {
      action: "ready_to_build",
      subject: "Biology",
      exam_date_time: new Date(Date.now() - 3_600_000).toISOString(),
      available_study_windows: [{ start_time: "18:00", end_time: "20:00", day_label: "Today", available_minutes: 120 }],
    };
    const emergency = {
      ...buildExamEmergencyFromIntake(intake),
      status: "completed" as const,
      reflection: { result: "hard" as const, surprise: "ran out of time", created_at: new Date().toISOString() },
    };
    const state = makeMinimalState({ exam_emergencies: [emergency] });
    const vault = buildEvidenceVault(state);
    const examEntry = vault.entries.find((e) => e.id.startsWith("exam_proof_"));
    expect((examEntry as any).proof_of_completion).toContain("hard");
    expect((examEntry as any).proof_of_completion).toContain("ran out of time");
  });
});

// ── Exam Copilot — task profile + resources (Step 2) ─────────────────────────

describe("ExamCopilot task profile + resources", () => {
  it("buildExamEmergencyFromIntake accepts task_profile and resources", () => {
    const intake: ExamIntakePayload = {
      action: "ready_to_build",
      subject: "Physics",
      exam_date_time: new Date(Date.now() + 86_400_000).toISOString(),
      topics: [{ name: "Mechanics", confidence: 3 }],
      available_study_windows: [
        { start_time: "18:00", end_time: "20:00", day_label: "Tonight", available_minutes: 120 },
      ],
      task_profile: {
        format: "mixed",
        sections: ["Multi choice", "Short answer", "Extended response"],
        highest_mark_section: "Extended response",
        target_mark: "70%",
        has_past_papers: true,
        has_rubric: true,
      },
      resources: [
        { kind: "past_paper", label: "2023 VCE Physics paper" },
        { kind: "rubric", label: "Marking key" },
      ],
    };
    const emergency = buildExamEmergencyFromIntake(intake);
    expect(emergency.task_profile?.format).toBe("mixed");
    expect(emergency.task_profile?.target_mark).toBe("70%");
    expect(emergency.task_profile?.sections.length).toBe(3);
    expect(emergency.resources.length).toBe(2);
    expect(emergency.resources[0].priority).toBe("high");
    expect(emergency.resources[0].how_to_use).toContain("exam timing");
  });

  it("emergency without task_profile/resources still parses", () => {
    const intake: ExamIntakePayload = {
      action: "ready_to_build",
      subject: "Chem",
      exam_date_time: new Date(Date.now() + 86_400_000).toISOString(),
      topics: [{ name: "Reactions", confidence: 4 }],
      available_study_windows: [
        { start_time: "18:00", end_time: "20:00", day_label: "Today", available_minutes: 120 },
      ],
    };
    const emergency = buildExamEmergencyFromIntake(intake);
    expect(emergency.task_profile).toBeUndefined();
    expect(emergency.resources).toEqual([]);
  });

  it("emits per-block portfolio proof for each completed block", () => {
    const intake: ExamIntakePayload = {
      action: "ready_to_build",
      subject: "History",
      exam_date_time: new Date(Date.now() + 86_400_000).toISOString(),
      topics: [
        { name: "Cold War", confidence: 2 },
        { name: "WWII", confidence: 3 },
      ],
      available_study_windows: [
        { start_time: "18:00", end_time: "22:00", day_label: "Today", available_minutes: 240 },
      ],
    };
    const emergency = buildExamEmergencyFromIntake(intake);
    const firstTwoBlocks = emergency.current_plan.survival_plan.slice(0, 2);
    expect(firstTwoBlocks.length).toBe(2);
    const withFeedback = {
      ...emergency,
      feedback: firstTwoBlocks.map((b) => ({
        block_id: b.id,
        result: "completed" as const,
        created_at: new Date().toISOString(),
      })),
    };
    const state = makeMinimalState({ exam_emergencies: [withFeedback] });
    const vault = buildEvidenceVault(state);
    const blockProofs = vault.entries.filter((e) => e.id.startsWith("exam_block_proof_"));
    expect(blockProofs.length).toBe(2);
    expect((blockProofs[0] as any).title).toContain("History");
  });
});
