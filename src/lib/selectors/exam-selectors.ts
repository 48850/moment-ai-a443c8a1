import type { MomentState, ExamEmergency, ExamTaskProfile, ExamResource, ExamQuestion, ExamTopic, ExamWorkRating } from "@/lib/types";
import type { WorkRatingLevel } from "@/lib/types/exam-emergency";

export function selectActiveExamEmergency(state: MomentState | null): ExamEmergency | null {
  if (!state) return null;
  const exams = (state as any).exam_emergencies as ExamEmergency[] | undefined;
  return exams?.find((e) => e.status === "active" || e.status === "intake") ?? null;
}

export function selectExamTaskProfile(state: MomentState | null, id: string): ExamTaskProfile | null {
  if (!state) return null;
  const exams = (state as any).exam_emergencies as ExamEmergency[] | undefined;
  return exams?.find((e) => e.id === id)?.task_profile ?? null;
}

export function selectExamResources(state: MomentState | null, id: string): ExamResource[] {
  if (!state) return [];
  const exams = (state as any).exam_emergencies as ExamEmergency[] | undefined;
  return exams?.find((e) => e.id === id)?.resources ?? [];
}

export function selectNextExamQuestion(emergency: ExamEmergency): ExamQuestion | null {
  const answeredQuestionIds = new Set(
    (emergency.answer_attempts ?? []).map((a) => a.question_id),
  );
  const unanswered = (emergency.questions ?? []).filter((q) => !answeredQuestionIds.has(q.id));
  if (unanswered.length === 0) return null;
  return unanswered.sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
}

export function selectWeakestExamTopics(emergency: ExamEmergency, n = 3): ExamTopic[] {
  const ratings = emergency.work_ratings ?? [];
  const needsWorkByTopic = new Map<string, number>();
  for (const r of ratings) {
    if (r.level === "needs_work") {
      const q = (emergency.questions ?? []).find((q) => q.id === r.question_id);
      if (q?.topic_name) {
        needsWorkByTopic.set(q.topic_name, (needsWorkByTopic.get(q.topic_name) ?? 0) + 1);
      }
    }
  }

  return [...(emergency.topics ?? [])]
    .sort((a, b) => {
      const aNeeds = needsWorkByTopic.get(a.name) ?? 0;
      const bNeeds = needsWorkByTopic.get(b.name) ?? 0;
      if (bNeeds !== aNeeds) return bNeeds - aNeeds;
      return a.confidence - b.confidence;
    })
    .slice(0, n);
}

export function selectRecentExamRatings(emergency: ExamEmergency, n = 5): ExamWorkRating[] {
  return [...(emergency.work_ratings ?? [])]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, n);
}

const LEVEL_ORDER: Record<WorkRatingLevel, number> = {
  needs_work: 0,
  developing: 1,
  solid: 2,
  strong: 3,
};

export function selectExamCopilotProgress(emergency: ExamEmergency): {
  totalQuestions: number;
  answeredCount: number;
  ratedCount: number;
  averageLevel: WorkRatingLevel | null;
  weakTopicNames: string[];
} {
  const questions = emergency.questions ?? [];
  const attempts = emergency.answer_attempts ?? [];
  const ratings = emergency.work_ratings ?? [];

  const answeredIds = new Set(attempts.map((a) => a.question_id));
  const answeredCount = questions.filter((q) => answeredIds.has(q.id)).length;

  const levels = ratings.map((r) => r.level as WorkRatingLevel);
  let averageLevel: WorkRatingLevel | null = null;
  if (levels.length > 0) {
    const avg = levels.reduce((sum, l) => sum + LEVEL_ORDER[l], 0) / levels.length;
    const rounded = Math.round(avg);
    averageLevel = (Object.keys(LEVEL_ORDER) as WorkRatingLevel[]).find(
      (k) => LEVEL_ORDER[k] === rounded,
    ) ?? "developing";
  }

  const weakTopicNames = selectWeakestExamTopics(emergency, 3).map((t) => t.name);

  return {
    totalQuestions: questions.length,
    answeredCount,
    ratedCount: ratings.length,
    averageLevel,
    weakTopicNames,
  };
}

export function selectExamResourceMap(emergency: ExamEmergency): Record<string, ExamResource[]> {
  const map: Record<string, ExamResource[]> = {};
  for (const resource of emergency.resources ?? []) {
    for (const topicId of resource.topic_ids ?? []) {
      if (!map[topicId]) map[topicId] = [];
      map[topicId].push(resource);
    }
  }
  return map;
}
