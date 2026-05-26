import type { ExamTopic } from "@/lib/types";
import type { TriageScore, ExamTopicPriority } from "@/lib/types/exam-emergency";

const DEFAULT_SCORE = 3;

function priorityFromScore(score: number): ExamTopicPriority {
  if (score >= 75) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  if (score >= 20) return "low";
  return "ignore_for_now";
}

function buildRationale(topic: ExamTopic, score: number): string {
  const parts: string[] = [];
  const markValue = topic.mark_value ?? DEFAULT_SCORE;
  const likelihood = topic.likelihood ?? DEFAULT_SCORE;
  const confidence = topic.confidence;
  const quickWin = topic.quick_win_potential ?? DEFAULT_SCORE;

  if (markValue >= 4) parts.push("high mark value");
  if (likelihood >= 4) parts.push("likely to appear");
  if (confidence <= 2) parts.push("weak confidence");
  if (quickWin >= 4) parts.push("quick win potential");

  if (parts.length === 0) {
    return score >= 60 ? "Multiple moderate factors" : "Lower priority relative to other topics";
  }
  return parts.join(" + ");
}

export function scoreTopics(topics: ExamTopic[]): TriageScore[] {
  return topics.map((t) => {
    const markValue = t.mark_value ?? DEFAULT_SCORE;
    const likelihood = t.likelihood ?? DEFAULT_SCORE;
    const confidence = t.confidence;
    const quickWin = t.quick_win_potential ?? DEFAULT_SCORE;
    const timeCost = t.time_cost ?? DEFAULT_SCORE;

    const score =
      markValue * 25 +
      likelihood * 20 +
      (6 - confidence) * 20 +
      quickWin * 20 +
      (6 - timeCost) * 15;

    const priority = priorityFromScore(score);

    return {
      topicId: t.id,
      topicName: t.name,
      score,
      priority,
      rationale: buildRationale(t, score),
    };
  });
}

export function sortByPriority(scored: TriageScore[]): TriageScore[] {
  return [...scored].sort((a, b) => b.score - a.score);
}
