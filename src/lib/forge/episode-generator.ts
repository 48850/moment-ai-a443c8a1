import type {
  ForgeEpisode,
  ForgeEpisodeFormat,
  ForgeEpisodeTone,
  ForgeScene,
  ForgeFinalAction,
  ForgeContextSnapshot,
} from "@/lib/types/forge-episode";
import type { Task } from "@/lib/types";

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Tension detector ─────────────────────────────────────────────────────────

interface DetectedTension {
  kind:
    | "rescheduled_task"
    | "overloaded_schedule"
    | "missed_task"
    | "ambitious_goal_weak_plan"
    | "hard_to_start_task"
    | "no_tasks_done"
    | "generic";
  task?: Task;
  taskCount?: number;
  detail?: string;
}

function detectTension(ctx: ForgeContextSnapshot): DetectedTension {
  if (ctx.rescheduledTasksRecently.length > 0) {
    return { kind: "rescheduled_task", task: ctx.rescheduledTasksRecently[0] };
  }
  if (ctx.schedulePressure === "critical" && ctx.pendingTasks.length >= 6) {
    return { kind: "overloaded_schedule", taskCount: ctx.pendingTasks.length };
  }
  if (ctx.missedTasksRecently.length > 0) {
    return { kind: "missed_task", task: ctx.missedTasksRecently[0] };
  }
  if (
    ctx.goal?.statement &&
    ctx.completedTasksToday.length === 0 &&
    ctx.pendingTasks.length > 3
  ) {
    return { kind: "ambitious_goal_weak_plan", detail: ctx.goal.statement };
  }
  if (ctx.pendingTasks.length >= 8) {
    return { kind: "overloaded_schedule", taskCount: ctx.pendingTasks.length };
  }
  if (ctx.completedTasksToday.length === 0 && ctx.pendingTasks.length > 0) {
    return { kind: "no_tasks_done" };
  }
  return { kind: "generic" };
}

// ─── Auto-select best format for tension ─────────────────────────────────────

export function suggestFormatForContext(ctx: ForgeContextSnapshot): ForgeEpisodeFormat {
  const t = detectTension(ctx);
  if (t.kind === "rescheduled_task") return "courtroom_trial";
  if (t.kind === "overloaded_schedule") return "fake_news";
  if (t.kind === "missed_task") return "task_rescue";
  if (t.kind === "ambitious_goal_weak_plan") return "villain_arc";
  if (t.kind === "no_tasks_done") return "context_roast";
  return "mission_briefing";
}

// ─── Per-format scene builders ────────────────────────────────────────────────

function buildCourtroomTrial(
  ctx: ForgeContextSnapshot,
  tone: ForgeEpisodeTone
): { scenes: ForgeScene[]; finalAction: ForgeFinalAction; title: string; summary: string } {
  const task = ctx.rescheduledTasksRecently[0] ?? ctx.missedTasksRecently[0] ?? ctx.pendingTasks[0];
  const taskName = task?.title ?? "the unfinished task";
  const rescheduleCount = ctx.rescheduledTasksRecently.length;

  const title = `The ${taskName} Trial`;
  const summary = `${taskName} has been rescheduled ${rescheduleCount} time${rescheduleCount !== 1 ? "s" : ""}.`;

  const scenes: ForgeScene[] = [
    {
      id: uid(),
      durationSeconds: 5,
      setting: "tiny courtroom inside a glowing notebook",
      visualStyle: "dark premium cartoon, cinematic lighting",
      characters: [
        { id: "judge", name: "Judge Moment", role: "judge", appearance: "small glowing AI judge with a tiny gavel", expression: "unimpressed" },
        { id: "task", name: taskName, role: "task", appearance: "crumpled document with nervous eyes", expression: "haunted" },
      ],
      actions: [
        { actorId: "judge", action: "look_at_camera", timing: "start", text: "Court is now in session." },
        { actorId: "task", action: "shake", timing: "middle" },
      ],
      caption: `The People v. ${taskName}`,
      soundCue: "tiny gavel hit",
      transition: "smash_cut",
    },
    {
      id: uid(),
      durationSeconds: 6,
      setting: "courtroom evidence board with red string",
      visualStyle: "animated evidence wall",
      characters: [
        { id: "ai", name: "Moment", role: "moment_ai", appearance: "small floating orb", expression: "deadpan" },
      ],
      actions: [
        { actorId: "ai", action: "point", timing: "middle", text: `Rescheduled ${rescheduleCount} time${rescheduleCount !== 1 ? "s" : ""}. Exhibit A.` },
      ],
      caption:
        tone === "deadpan"
          ? `This task has been moved so many times it legally owns a suitcase.`
          : `Evidence suggests a pattern. The pattern's name is avoidance.`,
      transition: "cut",
    },
    {
      id: uid(),
      durationSeconds: 6,
      setting: "dramatic zoom on the unopened document",
      visualStyle: "cinematic close-up",
      characters: [
        { id: "task", name: taskName, role: "task", appearance: "document with tired eyes", expression: "tired" },
      ],
      actions: [
        { actorId: "task", action: "look_at_camera", timing: "middle", text: "I just want to be opened." },
      ],
      caption: "No one is asking for perfection. Just evidence of life.",
      transition: "zoom",
    },
    {
      id: uid(),
      durationSeconds: 7,
      setting: "desk at night, document glowing faintly",
      visualStyle: "quiet cinematic study scene",
      characters: [
        { id: "ai", name: "Moment", role: "moment_ai", appearance: "small glowing orb beside laptop", expression: "focused" },
      ],
      actions: [
        { actorId: "ai", action: "point", timing: "end", text: "Open it. Three minutes. Ugly first sentence." },
      ],
      caption: "Sentence: 3-minute launch step.",
      soundCue: "gavel final",
      transition: "fade",
    },
  ];

  return {
    title,
    summary,
    scenes,
    finalAction: {
      label: `Start the 3-minute launch`,
      action: "start_task",
      linkedTaskId: task?.id,
    },
  };
}

function buildFakeNews(
  ctx: ForgeContextSnapshot,
  _tone: ForgeEpisodeTone
): { scenes: ForgeScene[]; finalAction: ForgeFinalAction; title: string; summary: string } {
  const count = ctx.pendingTasks.length;
  const topTask = ctx.pendingTasks[0];
  const taskName = topTask?.title ?? "critical backlog";
  const totalMinutes = ctx.pendingTasks.reduce((s, t) => s + (t.estimated_minutes ?? 30), 0);

  const title = "BREAKING: Schedule Crisis";
  const summary = `${count} tasks, ${totalMinutes} minutes required, finite day.`;

  const scenes: ForgeScene[] = [
    {
      id: uid(),
      durationSeconds: 5,
      setting: "24-hour news studio, red BREAKING chyron",
      visualStyle: "news broadcast, high contrast, urgent",
      characters: [
        { id: "anchor", name: "Anchor Moment", role: "news_anchor", appearance: "serious AI news anchor in blazer", expression: "alarmed" },
      ],
      actions: [
        { actorId: "anchor", action: "look_at_camera", timing: "start", text: "We interrupt your plan with this breaking report." },
      ],
      caption: "BREAKING: Local Plan Contains More Tasks Than Hours",
      soundCue: "news jingle",
      transition: "smash_cut",
    },
    {
      id: uid(),
      durationSeconds: 6,
      setting: "news studio with task count graphic",
      visualStyle: "broadcast infographic",
      characters: [
        { id: "anchor", name: "Anchor Moment", role: "news_anchor", appearance: "pointing at graphic", expression: "concerned" },
      ],
      actions: [
        { actorId: "anchor", action: "point", timing: "middle", text: `${count} tasks. ${totalMinutes} minutes. One day.` },
      ],
      caption: `You scheduled ${count} tasks into ${totalMinutes} minutes. Moment has contacted basic arithmetic.`,
      transition: "cut",
    },
    {
      id: uid(),
      durationSeconds: 5,
      setting: "news desk, correspondent report",
      visualStyle: "live field report",
      characters: [
        { id: "ai", name: "Field Moment", role: "moment_ai", appearance: "orb with tiny microphone", expression: "deadpan" },
      ],
      actions: [
        { actorId: "ai", action: "look_at_camera", timing: "middle", text: `The most critical task: "${taskName}".` },
      ],
      caption: "Authorities recommend starting with the one thing that matters.",
      transition: "cut",
    },
    {
      id: uid(),
      durationSeconds: 7,
      setting: "news studio sign-off",
      visualStyle: "broadcast, calmer tone",
      characters: [
        { id: "anchor", name: "Anchor Moment", role: "news_anchor", appearance: "straightening papers", expression: "resolved" },
      ],
      actions: [
        { actorId: "anchor", action: "look_at_camera", timing: "end", text: "This is not a drill. Pick one. Start it." },
      ],
      caption: "One task. Not six. One.",
      soundCue: "broadcast sign-off tone",
      transition: "fade",
    },
  ];

  return {
    title,
    summary,
    scenes,
    finalAction: {
      label: "Reform the plan",
      action: "reform_plan",
    },
  };
}

function buildVillainArc(
  ctx: ForgeContextSnapshot,
  _tone: ForgeEpisodeTone
): { scenes: ForgeScene[]; finalAction: ForgeFinalAction; title: string; summary: string } {
  const goalText = ctx.goal?.statement ?? "your goal";
  const avoidedTask = ctx.pendingTasks[0];
  const villainName = avoidedTask?.title ?? "The Avoided Task";

  const title = "The Villain Arc";
  const summary = `${villainName} has been avoided while ${goalText} waits.`;

  const scenes: ForgeScene[] = [
    {
      id: uid(),
      durationSeconds: 5,
      setting: "dark dramatic origin story backdrop",
      visualStyle: "cinematic villain origin, deep shadows",
      characters: [
        { id: "villain", name: villainName, role: "villain", appearance: "task document with dark edges and sinister glow", expression: "menacing" },
      ],
      actions: [
        { actorId: "villain", action: "dramatic_turn", timing: "start" },
      ],
      caption: `Every day you delay, ${villainName} gets stronger.`,
      soundCue: "dramatic horn sting",
      transition: "zoom",
    },
    {
      id: uid(),
      durationSeconds: 6,
      setting: "montage of missed sessions",
      visualStyle: "quick cuts, comic book panels",
      characters: [
        { id: "villain", name: villainName, role: "villain", appearance: "growing larger with each panel", expression: "triumphant" },
      ],
      actions: [
        { actorId: "villain", action: "float", timing: "middle" },
      ],
      caption: `Skipped Monday. Skipped Tuesday. At this point it has lore.`,
      transition: "smash_cut",
    },
    {
      id: uid(),
      durationSeconds: 5,
      setting: "dramatic confrontation moment",
      visualStyle: "face-off shot, high contrast",
      characters: [
        { id: "ai", name: "Moment", role: "moment_ai", appearance: "glowing orb standing firm", expression: "serious" },
        { id: "villain", name: villainName, role: "villain", appearance: "looming dark document", expression: "uncertain" },
      ],
      actions: [
        { actorId: "ai", action: "point", timing: "middle", text: "The arc ends today." },
        { actorId: "villain", action: "freeze", timing: "end" },
      ],
      caption: "The only way to defeat it: open it.",
      transition: "cut",
    },
    {
      id: uid(),
      durationSeconds: 7,
      setting: "resolution scene, task defeated",
      visualStyle: "calm cinematic, warm glow returning",
      characters: [
        { id: "ai", name: "Moment", role: "moment_ai", appearance: "steady glowing orb", expression: "focused" },
      ],
      actions: [
        { actorId: "ai", action: "look_at_camera", timing: "end", text: "Break it down. Three steps. First step now." },
      ],
      caption: `The goal was never impossible. The task just needed a plan.`,
      soundCue: "resolution chord",
      transition: "fade",
    },
  ];

  return {
    title,
    summary,
    scenes,
    finalAction: {
      label: "Break it down",
      action: "break_down_task",
      linkedTaskId: avoidedTask?.id,
    },
  };
}

function buildTaskRescue(
  ctx: ForgeContextSnapshot,
  _tone: ForgeEpisodeTone
): { scenes: ForgeScene[]; finalAction: ForgeFinalAction; title: string; summary: string } {
  const task = ctx.missedTasksRecently[0] ?? ctx.pendingTasks[0];
  const taskName = task?.title ?? "the stuck task";

  const title = `Task Rescue: ${taskName}`;
  const summary = `${taskName} is stuck. Time to extract it.`;

  const scenes: ForgeScene[] = [
    {
      id: uid(),
      durationSeconds: 5,
      setting: "distress signal in a dark digital void",
      visualStyle: "sci-fi rescue mission, amber emergency lights",
      characters: [
        { id: "task", name: taskName, role: "task", appearance: "document trapped in amber glow, waving faintly", expression: "desperate" },
      ],
      actions: [
        { actorId: "task", action: "shake", timing: "start" },
      ],
      caption: `${taskName} has been waiting.`,
      soundCue: "distant SOS beep",
      transition: "zoom",
    },
    {
      id: uid(),
      durationSeconds: 5,
      setting: "mission control briefing room",
      visualStyle: "tactical, focused, low light",
      characters: [
        { id: "ai", name: "Mission Moment", role: "moment_ai", appearance: "orb with tactical display", expression: "determined" },
      ],
      actions: [
        { actorId: "ai", action: "point", timing: "middle", text: "Objective: extract task. Method: start ugly." },
      ],
      caption: "It does not need to be good. It needs to exist.",
      transition: "cut",
    },
    {
      id: uid(),
      durationSeconds: 6,
      setting: "countdown to launch",
      visualStyle: "cinematic timer, dramatic close-ups",
      characters: [
        { id: "ai", name: "Mission Moment", role: "moment_ai", appearance: "orb steady at centre", expression: "calm" },
        { id: "task", name: taskName, role: "task", appearance: "document beginning to glow", expression: "hopeful" },
      ],
      actions: [
        { actorId: "ai", action: "look_at_camera", timing: "end", text: "Three minutes. Ugly first sentence. Mission starts now." },
        { actorId: "task", action: "float", timing: "end" },
      ],
      caption: "The rescue window is open.",
      soundCue: "launch countdown",
      transition: "fade",
    },
  ];

  return {
    title,
    summary,
    scenes,
    finalAction: {
      label: `Start ${taskName}`,
      action: "start_task",
      linkedTaskId: task?.id,
    },
  };
}

function buildMissionBriefing(
  ctx: ForgeContextSnapshot,
  _tone: ForgeEpisodeTone
): { scenes: ForgeScene[]; finalAction: ForgeFinalAction; title: string; summary: string } {
  const nextBlock = ctx.nextBlock ?? ctx.currentBlock;
  const blockTitle = nextBlock?.title ?? "your next block";
  const goalText = ctx.goal?.statement ?? "your goal";
  const topTask = ctx.pendingTasks[0];
  const taskName = topTask?.title ?? "the critical task";

  const title = "Mission Briefing";
  const summary = `Tactical briefing before ${blockTitle}.`;

  const scenes: ForgeScene[] = [
    {
      id: uid(),
      durationSeconds: 5,
      setting: "underground mission control, glowing screens",
      visualStyle: "cinematic teal and amber, tactical overlay",
      characters: [
        { id: "ai", name: "Commander Moment", role: "moment_ai", appearance: "commanding glowing orb at tactical screen", expression: "serious" },
      ],
      actions: [
        { actorId: "ai", action: "look_at_camera", timing: "start", text: "Attention. This is not a drill." },
      ],
      caption: `Incoming: ${blockTitle}`,
      soundCue: "mission alert tone",
      transition: "smash_cut",
    },
    {
      id: uid(),
      durationSeconds: 6,
      setting: "tactical display with goal and task overlay",
      visualStyle: "HUD overlay, mission parameters",
      characters: [
        { id: "ai", name: "Commander Moment", role: "moment_ai", appearance: "pointing at tactical map", expression: "focused" },
      ],
      actions: [
        { actorId: "ai", action: "point", timing: "middle", text: `Primary objective: ${taskName}.` },
      ],
      caption: `Goal confirmed: ${goalText.slice(0, 60)}${goalText.length > 60 ? "…" : ""}`,
      transition: "cut",
    },
    {
      id: uid(),
      durationSeconds: 7,
      setting: "mission launch corridor",
      visualStyle: "cinematic countdown, focused energy",
      characters: [
        { id: "ai", name: "Commander Moment", role: "moment_ai", appearance: "steady orb at corridor entrance", expression: "ready" },
      ],
      actions: [
        { actorId: "ai", action: "dramatic_turn", timing: "start" },
        { actorId: "ai", action: "look_at_camera", timing: "end", text: "Move out. The block is live." },
      ],
      caption: "This is the move. Make it.",
      soundCue: "mission theme",
      transition: "fade",
    },
  ];

  return {
    title,
    summary,
    scenes,
    finalAction: {
      label: `Go to ${blockTitle}`,
      action: ctx.nextBlock ? "schedule_task" : "reform_plan",
      linkedScheduleBlockId: nextBlock?.id,
    },
  };
}

function buildContextRoast(
  ctx: ForgeContextSnapshot,
  _tone: ForgeEpisodeTone
): { scenes: ForgeScene[]; finalAction: ForgeFinalAction; title: string; summary: string } {
  const pending = ctx.pendingTasks.length;
  const done = ctx.completedTasksToday.length;
  const topTask = ctx.pendingTasks[0];
  const taskName = topTask?.title ?? "your oldest task";
  const pressure = ctx.schedulePressure;

  const title = "Today, Reviewed";
  const summary = `${pending} tasks pending. ${done} done. The situation speaks for itself.`;

  const scenes: ForgeScene[] = [
    {
      id: uid(),
      durationSeconds: 5,
      setting: "comedy roast stage, single spotlight",
      visualStyle: "warm amber stage light, dark background",
      characters: [
        { id: "ai", name: "Moment", role: "moment_ai", appearance: "orb at a tiny microphone stand", expression: "deadpan" },
      ],
      actions: [
        { actorId: "ai", action: "look_at_camera", timing: "start", text: "Good evening. Let's talk about today." },
      ],
      caption: `${pending} tasks. ${done} done. The math is watching.`,
      soundCue: "light applause",
      transition: "cut",
    },
    {
      id: uid(),
      durationSeconds: 6,
      setting: "roast stage with evidence slides",
      visualStyle: "comedy roast, dry delivery",
      characters: [
        { id: "ai", name: "Moment", role: "moment_ai", appearance: "orb gesturing at slide", expression: "amused" },
        { id: "future", name: "Future You", role: "future_self", appearance: "golden silhouette watching from the audience", expression: "concerned" },
      ],
      actions: [
        { actorId: "ai", action: "point", timing: "middle", text: `Schedule pressure: ${pressure}. Context: filed under 'ambitious planning.'` },
        { actorId: "future", action: "react", timing: "end" },
      ],
      caption:
        pressure === "critical"
          ? "The plan technically fits if you skip sleep. Moment does not recommend this."
          : `The plan is survivable. ${taskName} disagrees.`,
      transition: "cut",
    },
    {
      id: uid(),
      durationSeconds: 7,
      setting: "end of roast, sincere moment",
      visualStyle: "warmer light, genuine tone",
      characters: [
        { id: "ai", name: "Moment", role: "moment_ai", appearance: "orb leaning slightly toward camera", expression: "honest" },
      ],
      actions: [
        { actorId: "ai", action: "look_at_camera", timing: "middle", text: "No speech. One task. Now." },
      ],
      caption: `Start with ${taskName}. Everything else follows.`,
      soundCue: "mic drop",
      transition: "fade",
    },
  ];

  return {
    title,
    summary,
    scenes,
    finalAction: {
      label: `Start: ${taskName}`,
      action: "start_task",
      linkedTaskId: topTask?.id,
    },
  };
}

function buildGoalTrailer(
  ctx: ForgeContextSnapshot,
  _tone: ForgeEpisodeTone
): { scenes: ForgeScene[]; finalAction: ForgeFinalAction; title: string; summary: string } {
  const goalText = ctx.goal?.statement ?? "your goal";
  const topTask = ctx.pendingTasks[0];
  const taskName = topTask?.title ?? "the next step";

  const title = "The Goal Trailer";
  const summary = `A cinematic bridge from ${taskName} to ${goalText.slice(0, 40)}.`;

  const scenes: ForgeScene[] = [
    {
      id: uid(),
      durationSeconds: 6,
      setting: "vast cinematic landscape, distant horizon",
      visualStyle: "widescreen cinematic, golden hour light",
      characters: [
        { id: "future", name: "Future You", role: "future_self", appearance: "golden silhouette standing at horizon", expression: "purposeful" },
      ],
      actions: [
        { actorId: "future", action: "dramatic_turn", timing: "start" },
      ],
      caption: goalText.slice(0, 80),
      soundCue: "cinematic swell",
      transition: "zoom",
    },
    {
      id: uid(),
      durationSeconds: 5,
      setting: "bridge between now and horizon",
      visualStyle: "montage cut, present and future contrast",
      characters: [
        { id: "ai", name: "Moment", role: "moment_ai", appearance: "small glowing guide orb", expression: "focused" },
      ],
      actions: [
        { actorId: "ai", action: "point", timing: "middle", text: `The gap closes today. Step one: ${taskName}.` },
      ],
      caption: "Every goal is just a series of small stupid steps done consistently.",
      transition: "cut",
    },
    {
      id: uid(),
      durationSeconds: 7,
      setting: "cinematic close-up, decision moment",
      visualStyle: "close-up, shallow depth of field",
      characters: [
        { id: "ai", name: "Moment", role: "moment_ai", appearance: "orb at eye level", expression: "direct" },
      ],
      actions: [
        { actorId: "ai", action: "look_at_camera", timing: "end", text: "The trailer is over. This is the part where you actually do it." },
      ],
      caption: `${taskName} is today's move.`,
      soundCue: "trailer end sting",
      transition: "fade",
    },
  ];

  return {
    title,
    summary,
    scenes,
    finalAction: {
      label: "Make the move",
      action: "start_task",
      linkedTaskId: topTask?.id,
    },
  };
}

function buildWeeklyRecap(
  ctx: ForgeContextSnapshot,
  _tone: ForgeEpisodeTone
): { scenes: ForgeScene[]; finalAction: ForgeFinalAction; title: string; summary: string } {
  const done = ctx.completedTasksToday.length;
  const missed = ctx.missedTasksRecently.length;
  const pending = ctx.pendingTasks.length;
  const goalText = ctx.goal?.statement ?? "your goal";

  const title = "Weekly Recap";
  const summary = `${done} done. ${missed} missed. ${pending} still pending.`;

  const scenes: ForgeScene[] = [
    {
      id: uid(),
      durationSeconds: 5,
      setting: "sports recap desk, highlights reel",
      visualStyle: "sports broadcast aesthetic, dynamic",
      characters: [
        { id: "anchor", name: "Recap Moment", role: "news_anchor", appearance: "energetic broadcast anchor", expression: "animated" },
      ],
      actions: [
        { actorId: "anchor", action: "look_at_camera", timing: "start", text: "What a week. Let's go to the tape." },
      ],
      caption: "The Week In Review: An Honest Assessment",
      soundCue: "sports theme riff",
      transition: "smash_cut",
    },
    {
      id: uid(),
      durationSeconds: 6,
      setting: "highlight reel with stats overlay",
      visualStyle: "stats graphic, broadcast",
      characters: [
        { id: "anchor", name: "Recap Moment", role: "news_anchor", appearance: "pointing at stats board", expression: "analytical" },
      ],
      actions: [
        { actorId: "anchor", action: "point", timing: "middle", text: `${done} completed. ${missed} slipped. ${pending} in queue.` },
      ],
      caption:
        done > missed
          ? "The win column has more entries than the loss column. This is called progress."
          : "The loss column has notes. The notes say: try again.",
      transition: "cut",
    },
    {
      id: uid(),
      durationSeconds: 7,
      setting: "post-game analysis, quiet studio",
      visualStyle: "reflective, warmer tone",
      characters: [
        { id: "ai", name: "Moment", role: "moment_ai", appearance: "orb in analyst chair", expression: "honest" },
      ],
      actions: [
        { actorId: "ai", action: "look_at_camera", timing: "end", text: `Goal: ${goalText.slice(0, 50)}. Still in play.` },
      ],
      caption: "The game isn't over. Reflect. Then go again.",
      soundCue: "closing theme",
      transition: "fade",
    },
  ];

  return {
    title,
    summary,
    scenes,
    finalAction: {
      label: "Reflect on the week",
      action: "reflect",
    },
  };
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateForgeEpisode({
  format,
  tone,
  context,
}: {
  format: ForgeEpisodeFormat;
  tone: ForgeEpisodeTone;
  context: ForgeContextSnapshot;
}): ForgeEpisode {
  let result: { scenes: ForgeScene[]; finalAction: ForgeFinalAction; title: string; summary: string };

  switch (format) {
    case "courtroom_trial":
      result = buildCourtroomTrial(context, tone);
      break;
    case "fake_news":
      result = buildFakeNews(context, tone);
      break;
    case "villain_arc":
      result = buildVillainArc(context, tone);
      break;
    case "task_rescue":
      result = buildTaskRescue(context, tone);
      break;
    case "mission_briefing":
      result = buildMissionBriefing(context, tone);
      break;
    case "context_roast":
      result = buildContextRoast(context, tone);
      break;
    case "goal_trailer":
      result = buildGoalTrailer(context, tone);
      break;
    case "weekly_recap":
      result = buildWeeklyRecap(context, tone);
      break;
    default:
      result = buildContextRoast(context, tone);
  }

  const durationSeconds = result.scenes.reduce((s, sc) => s + sc.durationSeconds, 0);

  return {
    id: uid(),
    title: result.title,
    format,
    tone,
    createdAt: new Date().toISOString(),
    durationSeconds,
    sourceContextSummary: result.summary,
    scenes: result.scenes,
    finalAction: result.finalAction,
  };
}
