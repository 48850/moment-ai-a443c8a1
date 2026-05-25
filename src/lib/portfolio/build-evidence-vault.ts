/**
 * buildEvidenceVault — turns raw MomentState into structured PortfolioEntry[].
 * Pure. No AI. No mutations.
 *
 * The Evidence Vault is the data layer behind the Portfolio surface and is
 * also read by Today / Plan / Coach / Path / Forge / Constellation.
 */
import type { MomentState } from "@/lib/types";
import { buildMomentMemory } from "@/lib/memory/build-moment-memory";
import type {
  EvidenceVault,
  PortfolioEntry,
  TaskProofEntry,
  LearningMemoryEntry,
  ForgeArtifactEntry,
  ReflectionEntry,
  RecoveryEntry,
  PatternEntry,
  CapabilityEntry,
} from "./types";

const DAY = 86_400_000;
const SEVEN_DAYS = 7 * DAY;

function safeDate(s?: string) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const EMPTY_VAULT: EvidenceVault = {
  entries: [],
  this_week_proof: [],
  learning_memories: [],
  open_loops: [],
  review_queue: [],
  skills_forming: [],
  recovery_moments: [],
  artifacts: [],
  patterns: [],
  summary: { headline: "Your evidence is empty — finish one thing and it starts.", proof_this_week: 0, memories_saved: 0, artifacts_created: 0, recoveries: 0, total_entries: 0 },
};

function rescueReframe(reason: string): string {
  switch (reason) {
    case "overwhelmed": return "You noticed too much, then adjusted. That's the skill.";
    case "tired": return "You protected energy instead of breaking. That counts.";
    case "stuck": return "You named a block early. Recovery starts here.";
    case "anxious": return "You stayed in motion through pressure. Real proof.";
    default: return "You took the right move under pressure.";
  }
}

function findFeedbackFor(state: MomentState, taskId: string): string | undefined {
  const items = (state.execution_feedback ?? []).filter((f) => f.task_id === taskId);
  return items[items.length - 1]?.feedback;
}

export function buildEvidenceVault(state: MomentState | null): EvidenceVault {
  if (!state) return EMPTY_VAULT;

  const now = Date.now();
  const cutoff = new Date(now - SEVEN_DAYS).toISOString();
  const entries: PortfolioEntry[] = [];

  // ---------- task proofs ----------
  const completed = (state.tasks ?? []).filter((t) => t.status === "done");
  const taskProofs: TaskProofEntry[] = completed.map((t) => ({
    id: `proof_${t.id}`,
    type: "task_proof",
    created_at: t.completed_at || t.created_at,
    completed_at: t.completed_at || t.created_at,
    title: t.title,
    task_id: t.id,
    goal_link: t.goal_id || undefined,
    workstream: t.workstream_id || undefined,
    proof_of_completion: t.proof_of_completion,
    feedback: findFeedbackFor(state, t.id),
  }));
  entries.push(...taskProofs);

  // ---------- learning memories ----------
  const memories: LearningMemoryEntry[] = [];
  for (const t of state.tasks ?? []) {
    const lesson = t.note_review?.mini_lesson;
    if (!lesson?.body) continue;
    memories.push({
      id: `memory_${t.id}`,
      type: "learning_memory",
      created_at: t.note_review!.created_at || t.completed_at || t.created_at,
      title: lesson.title || t.note_review!.headline || "Lesson",
      source_task_id: t.id,
      source_task_title: t.title,
      key_lesson: lesson.body.slice(0, 400),
      confusion_gap: t.note_review!.gaps?.[0],
      next_step: t.note_review!.next_step || undefined,
    });
  }
  entries.push(...memories);

  // ---------- reflections ----------
  const reflectionEntries: ReflectionEntry[] = (state.reflections ?? [])
    .filter((r) => (r.accomplishment ?? "").trim())
    .map((r) => ({
      id: `reflection_${r.id}`,
      type: "reflection",
      created_at: r.created_at || r.date,
      title: r.accomplishment.slice(0, 80),
      win: r.accomplishment,
      struggle: r.struggle,
      energy: r.energy_rating,
    }));
  entries.push(...reflectionEntries);

  // ---------- recoveries ----------
  const recoveries: RecoveryEntry[] = (state.rescue_signals ?? []).map((r) => ({
    id: `recovery_${r.id}`,
    type: "recovery",
    created_at: r.created_at,
    title: `Recovery: ${r.reason}`,
    reason: r.reason,
    reframe: rescueReframe(r.reason),
  }));
  entries.push(...recoveries);

  // ---------- forge artifacts ----------
  const artifacts: ForgeArtifactEntry[] = (state.forge_state?.forge_signals ?? []).map((s) => ({
    id: `artifact_${s.id}`,
    type: "forge_artifact",
    created_at: s.created_at,
    title: s.feature_title,
    feature: s.feature_title,
    signal_key: s.signal_key,
    value: s.value,
  }));
  entries.push(...artifacts);

  // ---------- capabilities ----------
  const capabilities: CapabilityEntry[] = (state.pursuit_model?.capability_clusters ?? [])
    .filter((c) => c.status !== "not_started")
    .map((c) => ({
      id: `capability_${c.id}`,
      type: "capability",
      created_at: state.pursuit_model?.compiled_at ?? new Date().toISOString(),
      title: c.name,
      capability_name: c.name,
      status: c.status,
    }));
  entries.push(...capabilities);

  // ---------- patterns (mirror memory.current_patterns into the vault) ----------
  const memory = buildMomentMemory(state);
  const patterns: PatternEntry[] = memory.current_patterns.map((p, idx) => ({
    id: `pattern_${p.id}_${idx}`,
    type: "pattern",
    created_at: new Date().toISOString(),
    title: p.message.slice(0, 80),
    message: p.message,
    confidence: p.confidence,
  }));
  entries.push(...patterns);

  // ---------- derived collections ----------
  const thisWeekProof = taskProofs.filter((p) => (p.completed_at ?? "") >= cutoff)
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at));

  const learningMemoriesSorted = [...memories].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const reviewQueue = memories
    .filter((m) => !m.next_step)
    .map((m) => {
      const d = safeDate(m.created_at);
      return {
        task_id: m.source_task_id,
        title: m.source_task_title,
        key_lesson: m.key_lesson.slice(0, 140),
        days_since_saved: d ? Math.floor((now - d.getTime()) / DAY) : 0,
      };
    })
    .sort((a, b) => b.days_since_saved - a.days_since_saved)
    .slice(0, 5);

  const skillsForming = (state.pursuit_model?.capability_clusters ?? [])
    .filter((c) => c.status === "emerging" || c.status === "developing")
    .map((c) => ({ name: c.name, status: c.status }));

  const openLoops = memory.open_loops;

  // ---------- summary ----------
  const proofThisWeek = thisWeekProof.length;
  const memoriesSaved = memories.length;
  const artifactsCreated = artifacts.length;
  const recoveryCount = recoveries.length;

  let headline = "Your evidence is growing.";
  if (proofThisWeek === 0 && memoriesSaved === 0) headline = "Finish one thing — it becomes proof.";
  else if (proofThisWeek >= 3) headline = `${proofThisWeek} pieces of proof this week.`;
  else if (memoriesSaved && proofThisWeek === 0) headline = "You learned. Now turn it into proof.";

  entries.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    entries,
    this_week_proof: thisWeekProof,
    learning_memories: learningMemoriesSorted,
    open_loops: openLoops,
    review_queue: reviewQueue,
    skills_forming: skillsForming,
    recovery_moments: recoveries.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    artifacts: artifacts.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    patterns,
    summary: {
      headline,
      proof_this_week: proofThisWeek,
      memories_saved: memoriesSaved,
      artifacts_created: artifactsCreated,
      recoveries: recoveryCount,
      total_entries: entries.length,
    },
  };
}

/** Compact, prompt-ready block. */
export function renderEvidenceVaultForPrompt(v: EvidenceVault): string {
  const lines: string[] = [];
  lines.push(`EVIDENCE VAULT: ${v.summary.headline}`);
  lines.push(`- This week: ${v.summary.proof_this_week} proofs · ${v.summary.memories_saved} memories · ${v.summary.artifacts_created} artifacts · ${v.summary.recoveries} recoveries`);
  if (v.this_week_proof.length) {
    lines.push(`- Latest proof: ${v.this_week_proof.slice(0, 5).map((p) => `"${p.title}"`).join(" | ")}`);
  }
  if (v.review_queue.length) {
    lines.push(`- Review soon: ${v.review_queue.slice(0, 3).map((r) => `"${r.title}" (${r.days_since_saved}d)`).join(" | ")}`);
  }
  if (v.skills_forming.length) {
    lines.push(`- Skills forming: ${v.skills_forming.map((s) => `${s.name}(${s.status})`).join(", ")}`);
  }
  lines.push("RULE: Reference these by name. Never re-teach memories already saved. Never duplicate completed proof.");
  return lines.join("\n");
}
