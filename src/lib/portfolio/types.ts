/**
 * Evidence Vault — structured portfolio entries.
 * Built fresh from MomentState on every read.
 */

export type PortfolioEntryType =
  | "task_proof"
  | "learning_memory"
  | "forge_artifact"
  | "reflection"
  | "recovery"
  | "pattern"
  | "milestone"
  | "capability"
  | "weekly_recap";

export interface BasePortfolioEntry {
  id: string;
  type: PortfolioEntryType;
  created_at: string;
  title: string;
}

export interface TaskProofEntry extends BasePortfolioEntry {
  type: "task_proof";
  task_id: string;
  completed_at: string;
  goal_link?: string;
  workstream?: string;
  proof_of_completion?: string;
  feedback?: string;
}

export interface LearningMemoryEntry extends BasePortfolioEntry {
  type: "learning_memory";
  source_task_id: string;
  source_task_title: string;
  key_lesson: string;
  confusion_gap?: string;
  next_step?: string;
}

export interface ForgeArtifactEntry extends BasePortfolioEntry {
  type: "forge_artifact";
  feature: string;
  signal_key: string;
  value: string;
}

export interface ReflectionEntry extends BasePortfolioEntry {
  type: "reflection";
  win: string;
  struggle?: string;
  energy: number;
}

export interface RecoveryEntry extends BasePortfolioEntry {
  type: "recovery";
  reason: string;
  /** Positive reframe shown to the user. */
  reframe: string;
}

export interface PatternEntry extends BasePortfolioEntry {
  type: "pattern";
  message: string;
  confidence: number;
}

export interface MilestoneEntry extends BasePortfolioEntry {
  type: "milestone";
  label: string;
}

export interface CapabilityEntry extends BasePortfolioEntry {
  type: "capability";
  capability_name: string;
  status: string;
}

export interface WeeklyRecapEntry extends BasePortfolioEntry {
  type: "weekly_recap";
  proof_count: number;
  memories_saved: number;
  recoveries: number;
  best_day?: string;
}

export type PortfolioEntry =
  | TaskProofEntry
  | LearningMemoryEntry
  | ForgeArtifactEntry
  | ReflectionEntry
  | RecoveryEntry
  | PatternEntry
  | MilestoneEntry
  | CapabilityEntry
  | WeeklyRecapEntry;

export interface EvidenceVault {
  entries: PortfolioEntry[];
  this_week_proof: TaskProofEntry[];
  learning_memories: LearningMemoryEntry[];
  open_loops: Array<{ task_id: string; title: string; days_open: number }>;
  review_queue: Array<{ task_id: string; title: string; key_lesson: string; days_since_saved: number }>;
  skills_forming: Array<{ name: string; status: string }>;
  recovery_moments: RecoveryEntry[];
  artifacts: ForgeArtifactEntry[];
  patterns: PatternEntry[];
  summary: {
    headline: string;
    proof_this_week: number;
    memories_saved: number;
    artifacts_created: number;
    recoveries: number;
    total_entries: number;
  };
}
