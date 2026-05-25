/**
 * selectPathProof — translates pursuit_model into Path-tab language.
 * No jargon ("capability cluster", "evidence signal" etc.) leaves this file.
 */
import type { MomentState } from "@/lib/types";
import { buildEvidenceVault } from "@/lib/portfolio/build-evidence-vault";

export interface PathProofResult {
  hero_title: string;
  this_week_proof: Array<{ title: string; when: string }>;
  next_milestone: string;
  evidence_collected: string[];
  bottleneck_human: string;
}

export function selectPathProof(state: MomentState | null): PathProofResult {
  if (!state) {
    return { hero_title: "Your path is just starting.", this_week_proof: [], next_milestone: "", evidence_collected: [], bottleneck_human: "" };
  }

  const vault = buildEvidenceVault(state);
  const pursuit = state.pursuit_model;
  const goal = state.active_goal;

  const hero = goal?.desired_identity
    ? `Becoming: ${goal.desired_identity}`
    : goal?.statement
      ? `Working on: ${goal.statement}`
      : "Your path is forming.";

  const thisWeek = vault.this_week_proof.slice(0, 5).map((p) => ({
    title: p.title,
    when: p.completed_at.slice(0, 10),
  }));

  const nextMilestone =
    pursuit?.workstreams?.find((w) => w.priority === "critical" || w.priority === "high")?.next_proof
    ?? goal?.target_stage
    ?? "Define your next visible proof.";

  const evidence: string[] = [];
  if (vault.summary.proof_this_week) evidence.push(`${vault.summary.proof_this_week} pieces of proof this week`);
  if (vault.summary.memories_saved) evidence.push(`${vault.summary.memories_saved} lessons saved`);
  if (vault.summary.artifacts_created) evidence.push(`${vault.summary.artifacts_created} artifacts in Forge`);
  if (vault.summary.recoveries) evidence.push(`${vault.summary.recoveries} recovery moments`);
  if (vault.skills_forming.length) evidence.push(`${vault.skills_forming.length} skills forming`);

  const bottleneck = pursuit?.workstreams?.[0]?.bottleneck
    ?? state.today_state?.current_bottleneck
    ?? "";

  return {
    hero_title: hero,
    this_week_proof: thisWeek,
    next_milestone: nextMilestone,
    evidence_collected: evidence,
    bottleneck_human: bottleneck,
  };
}
