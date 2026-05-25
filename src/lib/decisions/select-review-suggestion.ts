/**
 * selectReviewSuggestions — surfaces lessons that need re-encountering.
 * Pulled from Evidence Vault review_queue + fragile topics.
 */
import type { MomentState } from "@/lib/types";
import { buildEvidenceVault } from "@/lib/portfolio/build-evidence-vault";
import { buildMomentMemory } from "@/lib/memory/build-moment-memory";

export interface ReviewSuggestion {
  source: "saved_lesson" | "fragile_topic";
  task_id?: string;
  title: string;
  hint: string;
  days_since?: number;
}

export function selectReviewSuggestions(state: MomentState | null): ReviewSuggestion[] {
  if (!state) return [];
  const vault = buildEvidenceVault(state);
  const memory = buildMomentMemory(state);

  const fromQueue: ReviewSuggestion[] = vault.review_queue.map((r) => ({
    source: "saved_lesson",
    task_id: r.task_id,
    title: r.title,
    hint: r.key_lesson,
    days_since: r.days_since_saved,
  }));

  const fromFragile: ReviewSuggestion[] = memory.learning_profile.fragile_topics
    .slice(0, 3)
    .map((t) => ({
      source: "fragile_topic",
      title: t,
      hint: "Marked as a gap. Worth a 10-min revisit.",
    }));

  return [...fromQueue, ...fromFragile].slice(0, 6);
}
