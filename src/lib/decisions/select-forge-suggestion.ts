/**
 * selectForgeSuggestion — proposes one artifact to build, from fragile topics
 * + review queue. Deterministic.
 */
import type { MomentState } from "@/lib/types";
import { buildMomentMemory } from "@/lib/memory/build-moment-memory";
import { buildEvidenceVault } from "@/lib/portfolio/build-evidence-vault";

export interface ForgeSuggestion {
  has_suggestion: boolean;
  title: string;
  reason: string;
  topics: string[];
  artifact_kind: "quiz" | "revision_card" | "explainer" | "study_pack";
}

export function selectForgeSuggestion(state: MomentState | null): ForgeSuggestion {
  if (!state) return { has_suggestion: false, title: "", reason: "", topics: [], artifact_kind: "quiz" };

  const memory = buildMomentMemory(state);
  const vault = buildEvidenceVault(state);

  const topics = [
    ...memory.learning_profile.fragile_topics,
    ...vault.review_queue.map((r) => r.title),
  ].slice(0, 4);

  if (topics.length === 0) {
    return { has_suggestion: false, title: "", reason: "", topics: [], artifact_kind: "quiz" };
  }

  let kind: ForgeSuggestion["artifact_kind"] = "quiz";
  if (vault.review_queue.length >= 3) kind = "revision_card";
  else if (memory.learning_profile.fragile_topics.length >= 3) kind = "explainer";

  return {
    has_suggestion: true,
    title: kind === "quiz" ? "Generate a quiz from your gaps?" : kind === "revision_card" ? "Turn saved lessons into revision cards?" : kind === "explainer" ? "Build an explainer for fragile topics?" : "Build a study pack from your portfolio?",
    reason: `${topics.length} topics from your portfolio could become an artifact.`,
    topics,
    artifact_kind: kind,
  };
}
