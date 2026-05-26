import type { ExamTopic, StudyBlock, StudyWindow } from "@/lib/types";
import type { TriageScore, StudyMethod } from "@/lib/types/exam-emergency";
import { scoreTopics, sortByPriority } from "./exam-triage";

export interface BuildPlanInput {
  subject: string;
  topics: ExamTopic[];
  availableStudyWindows: StudyWindow[];
}

export interface ExamCurrentPlan {
  survival_plan: StudyBlock[];
  recovery_plan: StudyBlock[];
  stretch_plan: StudyBlock[];
}

function methodForConfidence(confidence: number, subject: string): StudyMethod {
  if (confidence <= 2) return "summary";
  if (confidence === 3) return "practice_questions";
  const writingSubjects = ["english", "history", "geography", "psychology", "economics"];
  if (writingSubjects.some((s) => subject.toLowerCase().includes(s))) return "essay_plan";
  return "active_recall";
}

function makeBlock(
  topic: ExamTopic,
  subject: string,
  durationMinutes: number,
  index: number,
): StudyBlock {
  const method = methodForConfidence(topic.confidence, subject);
  return {
    id: `block-${topic.id}-${index}`,
    title: `${topic.name} (${method.replace(/_/g, " ")})`,
    topic_ids: [topic.id],
    duration_minutes: durationMinutes,
    method,
    goal: `Cover key ideas in ${topic.name} in ${durationMinutes} minutes.`,
    success_criteria: `Can explain ${topic.name} without notes.`,
    fallback_if_stuck: "Write a memory dump — everything you know, no stopping.",
  };
}

export function buildFirst20MinutesBlock(topic: ExamTopic, subject: string): StudyBlock {
  return {
    id: `block-${topic.id}-first20`,
    title: `First 20 Minutes — ${topic.name}`,
    topic_ids: [topic.id],
    duration_minutes: 20,
    method: topic.confidence <= 2 ? "summary" : "active_recall",
    goal: `Mark your topic list, find the highest-value gap, do one memory dump on ${topic.name}.`,
    success_criteria: `Can say three key facts about ${topic.name} without notes.`,
    fallback_if_stuck: "Write a memory dump — everything you know, no stopping.",
  };
}

export function buildExamPlan(input: BuildPlanInput): ExamCurrentPlan {
  const { subject, topics, availableStudyWindows } = input;

  const totalAvailableMinutes = availableStudyWindows.reduce(
    (sum, w) => sum + w.available_minutes,
    0,
  ) || 120;

  if (topics.length === 0) {
    return { survival_plan: [], recovery_plan: [], stretch_plan: [] };
  }

  const scored = sortByPriority(scoreTopics(topics));
  const topicMap = new Map(topics.map((t) => [t.id, t]));

  const critical = scored.filter((s) => s.priority === "critical" || s.priority === "high");
  const medium = scored.filter((s) => s.priority === "medium");
  const nonIgnored = scored.filter((s) => s.priority !== "ignore_for_now");

  // First topic for First 20 Min block
  const firstTopic = topicMap.get(scored[0].topicId) ?? topics[0];

  // ── Survival plan ───────────────────────────────────────────────────────────
  const survivalBudget = Math.min(totalAvailableMinutes * 0.5, 120);
  const survivalPlan: StudyBlock[] = [buildFirst20MinutesBlock(firstTopic, subject)];
  let survivalUsed = 20;

  for (const ts of critical) {
    if (survivalUsed >= survivalBudget) break;
    const topic = topicMap.get(ts.topicId);
    if (!topic || topic.id === firstTopic.id) continue;
    const dur = topic.confidence <= 2 ? 30 : 25;
    if (survivalUsed + dur > survivalBudget + 10) break;
    survivalPlan.push(makeBlock(topic, subject, dur, survivalPlan.length));
    survivalUsed += dur;
  }

  // ── Recovery plan ───────────────────────────────────────────────────────────
  const recoveryBudget = Math.min(totalAvailableMinutes * 0.75, 240);
  const recoveryPlan: StudyBlock[] = [buildFirst20MinutesBlock(firstTopic, subject)];
  let recoveryUsed = 20;

  for (const ts of [...critical, ...medium]) {
    if (recoveryUsed >= recoveryBudget) break;
    const topic = topicMap.get(ts.topicId);
    if (!topic || topic.id === firstTopic.id) continue;
    const dur = topic.confidence <= 2 ? 40 : 30;
    if (recoveryUsed + dur > recoveryBudget + 15) break;
    recoveryPlan.push(makeBlock(topic, subject, dur, recoveryPlan.length));
    recoveryUsed += dur;
  }

  // ── Stretch plan ────────────────────────────────────────────────────────────
  const stretchPlan: StudyBlock[] = [buildFirst20MinutesBlock(firstTopic, subject)];
  let stretchUsed = 20;

  for (const ts of nonIgnored) {
    if (stretchUsed >= totalAvailableMinutes) break;
    const topic = topicMap.get(ts.topicId);
    if (!topic || topic.id === firstTopic.id) continue;
    const dur = 35;
    stretchPlan.push(makeBlock(topic, subject, dur, stretchPlan.length));
    stretchUsed += dur;
  }

  return { survival_plan: survivalPlan, recovery_plan: recoveryPlan, stretch_plan: stretchPlan };
}
