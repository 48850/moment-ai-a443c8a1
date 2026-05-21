import type { Task, ScheduleBlock, AlignmentState, Reflection } from "@/lib/types";

export type ForgeEpisodeFormat =
  | "context_roast"
  | "courtroom_trial"
  | "fake_news"
  | "villain_arc"
  | "mission_briefing"
  | "goal_trailer"
  | "weekly_recap"
  | "task_rescue";

export type ForgeEpisodeTone =
  | "deadpan"
  | "chaotic"
  | "savage"
  | "cinematic"
  | "dry"
  | "wholesome";

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
  transition?: "cut" | "zoom" | "smash_cut" | "fade" | "glitch" | "swipe";
}

export interface ForgeCharacter {
  id: string;
  name: string;
  role:
    | "user_proxy"
    | "task"
    | "moment_ai"
    | "future_self"
    | "villain"
    | "judge"
    | "news_anchor"
    | "constellation_node";
  appearance: string;
  expression?: string;
}

export interface ForgeSceneAction {
  actorId: string;
  action:
    | "enter"
    | "look_at_camera"
    | "panic"
    | "freeze"
    | "point"
    | "collapse"
    | "dramatic_turn"
    | "float"
    | "shake"
    | "walk"
    | "react";
  timing: "start" | "middle" | "end";
  text?: string;
}

export interface ForgeFinalAction {
  label: string;
  action:
    | "start_task"
    | "reform_plan"
    | "break_down_task"
    | "schedule_task"
    | "open_constellation_node"
    | "reflect";
  linkedTaskId?: string;
  linkedScheduleBlockId?: string;
  linkedConstellationNodeId?: string;
}

export interface ForgeContextSnapshot {
  goal: { statement?: string; phase?: string; status?: string } | null;
  todaySchedule: ScheduleBlock[];
  currentBlock: ScheduleBlock | null;
  nextBlock: ScheduleBlock | null;
  pendingTasks: Task[];
  completedTasksToday: Task[];
  missedTasksRecently: Task[];
  rescheduledTasksRecently: Task[];
  recentReflections: Reflection[];
  schedulePressure: "low" | "moderate" | "high" | "critical";
  alignmentState: AlignmentState | null;
  constellationDay: unknown;
  constellationWeek: unknown;
  constellationMonth: null;
}
