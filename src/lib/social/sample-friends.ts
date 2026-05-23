import type { ProgressEvent } from "./select-progress-events";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export const DEMO_FRIEND_EVENTS: ProgressEvent[] = [
  {
    id: "demo_jerry_lesson",
    kind: "lesson_learned",
    actor: { name: "Jerry", username: "jerry", isYou: false, isDemo: true },
    title: "learned Plato's Allegory of the Cave",
    context: "Filed under Philosophy · 2 min reflection saved.",
    timestamp: hoursAgo(2),
  },
  {
    id: "demo_mia_review",
    kind: "review_saved",
    actor: { name: "Mia", username: "mia", isYou: false, isDemo: true },
    title: "saved a Biology review memory",
    context: "Mitochondria → respiration loop, flagged for spaced review.",
    timestamp: hoursAgo(5),
  },
  {
    id: "demo_alex_repair",
    kind: "plan_repaired",
    actor: { name: "Alex", username: "alex", isYou: false, isDemo: true },
    title: "repaired tonight's plan",
    context: "Moved deep work to 19:00 after late practice.",
    timestamp: hoursAgo(8),
  },
  {
    id: "demo_jerry_streak",
    kind: "streak_milestone",
    actor: { name: "Jerry", username: "jerry", isYou: false, isDemo: true },
    title: "and Bob hit a 100-day philosophy streak",
    timestamp: hoursAgo(20),
  },
  {
    id: "demo_sam_task",
    kind: "task_completed",
    actor: { name: "Sam", username: "sam", isYou: false, isDemo: true },
    title: "completed “Draft personal statement opener”",
    timestamp: hoursAgo(26),
  },
];
