import type { ExamEmergency } from "@/lib/types";
import type { ExamIntakePayload } from "@/lib/types/exam-emergency";
import { examEmergencySchema } from "@/lib/state/schema";
import { scoreTopics } from "./exam-triage";
import { buildExamPlan } from "./build-exam-plan";

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function normaliseDateTime(raw: string | undefined): string {
  if (!raw) return new Date(Date.now() + 24 * 3_600_000).toISOString();
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  return new Date(Date.now() + 24 * 3_600_000).toISOString();
}

export function buildExamEmergencyFromIntake(input: ExamIntakePayload): ExamEmergency {
  const now = new Date().toISOString();
  const subject = toTitleCase((input.subject ?? "exam").trim());
  const examDateTime = normaliseDateTime(input.exam_date_time);

  const topics = (input.topics ?? []).map((t, i) => ({
    id: `topic-${i}-${t.name.replace(/\s+/g, "-").toLowerCase()}`,
    name: t.name,
    confidence: (t.confidence ?? 3) as 1 | 2 | 3 | 4 | 5,
    mark_value: t.mark_value,
    likelihood: t.likelihood,
    time_cost: t.time_cost,
    quick_win_potential: t.quick_win_potential,
    priority: "medium" as const,
  }));

  const scored = scoreTopics(topics);
  const withPriorities = topics.map((t) => ({
    ...t,
    priority: scored.find((s) => s.topicId === t.id)?.priority ?? ("medium" as const),
  }));

  const availableStudyWindows = (input.available_study_windows ?? [
    { start_time: "18:00", end_time: "22:00", day_label: "Today", available_minutes: 120 },
  ]);

  const currentPlan = buildExamPlan({
    subject,
    topics: withPriorities,
    availableStudyWindows,
  });

  const firstBlockId = currentPlan.survival_plan[0]?.id;

  const resources = (input.resources ?? []).map((r) => ({
    id: crypto.randomUUID(),
    kind: r.kind,
    label: r.label,
    helps_with: r.helps_with ?? [],
    priority: r.priority ?? ("medium" as const),
    how_to_use: r.how_to_use ?? "",
    created_at: now,
  }));

  const taskProfile = input.task_profile
    ? {
        format: input.task_profile.format ?? "unknown",
        sections: input.task_profile.sections ?? [],
        highest_mark_section: input.task_profile.highest_mark_section,
        has_rubric: input.task_profile.has_rubric ?? false,
        rubric_text: input.task_profile.rubric_text,
        has_topic_list: input.task_profile.has_topic_list ?? false,
        has_past_papers: input.task_profile.has_past_papers ?? false,
        teacher_emphasis: input.task_profile.teacher_emphasis,
        target_mark: input.task_profile.target_mark,
        updated_at: now,
      }
    : undefined;

  const draft = {
    id: crypto.randomUUID(),
    subject,
    exam_date_time: examDateTime,
    status: "active" as const,
    preparedness_score: input.preparedness_score,
    topics: withPriorities,
    available_study_windows: availableStudyWindows,
    target_outcome: input.target_outcome,
    current_plan: currentPlan,
    active_block_id: firstBlockId,
    feedback: [],
    intake_status: "active" as const,
    task_profile: taskProfile,
    resources,
    created_at: now,
    updated_at: now,
  };

  return examEmergencySchema.parse(draft);
}
