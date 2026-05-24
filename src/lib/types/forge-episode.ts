export type ForgeEpisodeFormat =
  | "context_roast"
  | "courtroom_trial"
  | "fake_news"
  | "villain_arc"
  | "mission_briefing"
  | "goal_trailer"
  | "weekly_recap"
  | "task_rescue";

export type ForgeEpisodeTone = "deadpan" | "chaotic" | "savage" | "cinematic" | "dry" | "wholesome";

export type ForgeCharacterRole =
  | "judge"
  | "task"
  | "moment_ai"
  | "future_self"
  | "villain"
  | "news_anchor"
  | "constellation_node"
  | "user_proxy";

export type ForgeSceneTransition = "cut" | "fade" | "zoom" | "smash_cut" | "swipe" | "glitch";

export type ForgeCharacterAction =
  | "idle"
  | "shake"
  | "panic"
  | "float"
  | "dramatic_turn"
  | "collapse"
  | "look_at_camera"
  | "point"
  | "enter"
  | "react";

export interface ForgeCharacter {
  id: string;
  name: string;
  role: ForgeCharacterRole;
  appearance?: string;
  expression?: "neutral" | "unimpressed" | "haunted" | "tired" | "alarmed" | "proud" | "confused";
}

export interface ForgeSceneAction {
  actorId: string;
  action: ForgeCharacterAction;
  timing: "start" | "middle" | "end";
  text?: string;
}

export interface ForgeScene {
  id: string;
  durationSeconds: number;
  setting: string;
  visualStyle: string;
  characters: ForgeCharacter[];
  actions: ForgeSceneAction[];
  caption?: string;
  voiceover?: string;
  soundCue?: string;
  transition?: ForgeSceneTransition;
}

export interface ForgeFinalAction {
  label: string;
  action:
    | "start_task"
    | "break_down_task"
    | "reform_plan"
    | "schedule_task"
    | "open_constellation_node"
    | "reflect";
  linkedTaskId?: string;
  linkedScheduleBlockId?: string;
  linkedConstellationNodeId?: string;
}

export interface ForgeEpisode {
  id: string;
  title: string;
  format: ForgeEpisodeFormat;
  tone: ForgeEpisodeTone;
  createdAt: string;
  durationSeconds: number;
  sourceContextSummary: string;
  scenes: ForgeScene[];
  finalAction: ForgeFinalAction;
}

export interface ForgeContextSnapshot {
  goal: { statement: string; why_it_matters: string } | null;
  todaySchedule: Array<{ id: string; title: string; start_time: string; end_time: string; status?: string }>;
  currentBlock: { id: string; title: string; start_time: string; end_time: string } | null;
  nextBlock: { id: string; title: string; start_time: string; end_time: string } | null;
  pendingTasks: Array<{ id: string; title: string; estimated_minutes?: number; priority?: string; due_date?: string; execution_feedback?: Array<{ feedback: string }> }>;
  completedTasksToday: Array<{ id: string; title: string; completed_at: string }>;
  missedTasksRecently: Array<{ id: string; title: string }>;
  rescheduledTasksRecently: Array<{ id: string; title: string; rescheduleCount: number }>;
  recentReflections: Array<{ id: string; date: string; content?: string }>;
  schedulePressure: "low" | "moderate" | "high" | "critical";
  alignmentState: { status: string; drift_score: number } | null;
  constellationDay: { decisive_move: string; current_bottleneck: string } | null;
  constellationWeek: unknown;
  constellationMonth: null;
}
