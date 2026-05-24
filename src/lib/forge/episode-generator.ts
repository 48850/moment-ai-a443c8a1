import type {
  ForgeEpisode,
  ForgeEpisodeFormat,
  ForgeEpisodeTone,
  ForgeScene,
  ForgeFinalAction,
  ForgeContextSnapshot,
} from "@/lib/types/forge-episode";

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

export function suggestFormatForContext(ctx: ForgeContextSnapshot): ForgeEpisodeFormat {
  const { rescheduledTasksRecently, pendingTasks, missedTasksRecently, schedulePressure, completedTasksToday, goal } = ctx;

  if (rescheduledTasksRecently.length > 0 && rescheduledTasksRecently[0].rescheduleCount >= 3) {
    return "courtroom_trial";
  }
  if (pendingTasks.length >= 8 || schedulePressure === "critical") {
    return "fake_news";
  }
  if (missedTasksRecently.length >= 3) {
    return "task_rescue";
  }
  if (goal && completedTasksToday.length === 0 && pendingTasks.length > 3) {
    return "villain_arc";
  }
  if (schedulePressure === "high") {
    return "context_roast";
  }
  if (goal && completedTasksToday.length > 0) {
    return "goal_trailer";
  }
  return "weekly_recap";
}

type Builder = (ctx: ForgeContextSnapshot, tone: ForgeEpisodeTone) => ForgeEpisode;

const builders: Record<ForgeEpisodeFormat, Builder> = {
  courtroom_trial(ctx, tone) {
    const accused = ctx.rescheduledTasksRecently[0] ?? ctx.pendingTasks[0];
    const taskName = accused ? truncate(accused.title, 32) : "your longest pending task";
    const count = accused && "rescheduleCount" in accused ? (accused as { rescheduleCount: number }).rescheduleCount : 2;
    const scenes: ForgeScene[] = [
      {
        id: uid(),
        durationSeconds: 5,
        setting: "courtroom",
        visualStyle: "dramatic",
        characters: [
          { id: "judge", name: "The Deadline", role: "judge", expression: "unimpressed" },
          { id: "task", name: taskName, role: "task", expression: "haunted" },
        ],
        actions: [
          { actorId: "judge", action: "look_at_camera", timing: "start" },
          { actorId: "task", action: "shake", timing: "middle" },
        ],
        caption: "The Case of the Perpetually Rescheduled Task",
        soundCue: "gavel",
        transition: "smash_cut",
      },
      {
        id: uid(),
        durationSeconds: 5,
        setting: "witness_stand",
        visualStyle: "spotlight",
        characters: [
          { id: "judge", name: "The Deadline", role: "judge", expression: "unimpressed" },
          { id: "task", name: taskName, role: "task", expression: "tired" },
        ],
        actions: [
          { actorId: "judge", action: "point", timing: "start", text: `"${taskName}" — rescheduled ${count} times.` },
          { actorId: "task", action: "collapse", timing: "middle" },
        ],
        caption: `Rescheduled ${count}× and still not done.`,
        transition: "cut",
      },
      {
        id: uid(),
        durationSeconds: 5,
        setting: "verdict",
        visualStyle: "dramatic",
        characters: [
          { id: "ai", name: "Moment AI", role: "moment_ai", expression: "neutral" },
          { id: "task", name: taskName, role: "task", expression: "alarmed" },
        ],
        actions: [
          { actorId: "ai", action: "float", timing: "start", text: "Break it down or schedule it. Right now." },
          { actorId: "task", action: "dramatic_turn", timing: "end" },
        ],
        caption: "The verdict: start small or it's gone.",
        transition: "fade",
      },
    ];
    return {
      id: uid(),
      title: `Trial of "${taskName}"`,
      format: "courtroom_trial",
      tone,
      createdAt: new Date().toISOString(),
      durationSeconds: scenes.reduce((s, sc) => s + sc.durationSeconds, 0),
      sourceContextSummary: `Task rescheduled ${count}× with no completion`,
      scenes,
      finalAction: {
        label: "Break it down now",
        action: "break_down_task",
        linkedTaskId: accused?.id,
      },
    };
  },

  fake_news(ctx, tone) {
    const pending = ctx.pendingTasks.length;
    const topTask = ctx.pendingTasks[0];
    const scenes: ForgeScene[] = [
      {
        id: uid(),
        durationSeconds: 4,
        setting: "news_studio",
        visualStyle: "breaking_news",
        characters: [{ id: "anchor", name: "Breaking News", role: "news_anchor", expression: "alarmed" }],
        actions: [{ actorId: "anchor", action: "look_at_camera", timing: "start", text: "BREAKING: Local student has " + pending + " tasks." }],
        caption: `BREAKING: ${pending} tasks, not enough hours.`,
        soundCue: "news_jingle",
        transition: "smash_cut",
      },
      {
        id: uid(),
        durationSeconds: 5,
        setting: "field_report",
        visualStyle: "chaos",
        characters: [
          { id: "anchor", name: "Reporter", role: "news_anchor", expression: "alarmed" },
          { id: "task", name: topTask ? truncate(topTask.title, 28) : "Top Task", role: "task", expression: "haunted" },
        ],
        actions: [
          { actorId: "task", action: "panic", timing: "start" },
          { actorId: "anchor", action: "point", timing: "middle", text: `The most pressing: "${topTask ? truncate(topTask.title, 28) : "your top task"}"` },
        ],
        caption: "Sources confirm the plan is overfull.",
        transition: "cut",
      },
      {
        id: uid(),
        durationSeconds: 5,
        setting: "studio_outro",
        visualStyle: "calm",
        characters: [{ id: "ai", name: "Moment AI", role: "moment_ai", expression: "neutral" }],
        actions: [{ actorId: "ai", action: "float", timing: "middle", text: "Pick ONE. Do it. Reform the rest." }],
        caption: "The plan is: one task, then reassess.",
        transition: "fade",
      },
    ];
    return {
      id: uid(),
      title: `${pending} Tasks — A Crisis Unfolds`,
      format: "fake_news",
      tone,
      createdAt: new Date().toISOString(),
      durationSeconds: scenes.reduce((s, sc) => s + sc.durationSeconds, 0),
      sourceContextSummary: `${pending} pending tasks, ${ctx.schedulePressure} pressure`,
      scenes,
      finalAction: { label: "Reform the plan", action: "reform_plan" },
    };
  },

  villain_arc(ctx, tone) {
    const topPending = ctx.pendingTasks[0];
    const taskName = topPending ? truncate(topPending.title, 32) : "the task you keep avoiding";
    const goal = ctx.goal?.statement ? truncate(ctx.goal.statement, 36) : "your goal";
    const scenes: ForgeScene[] = [
      {
        id: uid(),
        durationSeconds: 5,
        setting: "lair",
        visualStyle: "dark_glitch",
        characters: [{ id: "villain", name: taskName, role: "villain", expression: "neutral" }],
        actions: [{ actorId: "villain", action: "dramatic_turn", timing: "start" }],
        caption: `"${taskName}" has gone unchecked for too long.`,
        transition: "glitch",
      },
      {
        id: uid(),
        durationSeconds: 5,
        setting: "backstory",
        visualStyle: "cinematic",
        characters: [
          { id: "villain", name: taskName, role: "villain", expression: "neutral" },
          { id: "goal", name: goal, role: "constellation_node", expression: "neutral" },
        ],
        actions: [
          { actorId: "villain", action: "float", timing: "start", text: "Every day you don't start me, I grow." },
          { actorId: "goal", action: "shake", timing: "middle" },
        ],
        caption: `The goal "${goal}" waits. Nothing is moving.`,
        transition: "fade",
      },
      {
        id: uid(),
        durationSeconds: 5,
        setting: "redemption",
        visualStyle: "bright",
        characters: [{ id: "ai", name: "Moment AI", role: "moment_ai", expression: "neutral" }],
        actions: [{ actorId: "ai", action: "look_at_camera", timing: "middle", text: "Start with 15 minutes. Break the pattern." }],
        caption: "The comeback arc starts with one task.",
        transition: "fade",
      },
    ];
    return {
      id: uid(),
      title: `The Rise of "${taskName}"`,
      format: "villain_arc",
      tone,
      createdAt: new Date().toISOString(),
      durationSeconds: scenes.reduce((s, sc) => s + sc.durationSeconds, 0),
      sourceContextSummary: `Goal set but ${ctx.pendingTasks.length} tasks untouched today`,
      scenes,
      finalAction: { label: "Start the task", action: "start_task", linkedTaskId: topPending?.id },
    };
  },

  mission_briefing(ctx, tone) {
    const goal = ctx.goal?.statement ? truncate(ctx.goal.statement, 40) : "your mission";
    const decisiveMove = ctx.constellationDay?.decisive_move || (ctx.pendingTasks[0]?.title ?? "your next task");
    const scenes: ForgeScene[] = [
      {
        id: uid(),
        durationSeconds: 5,
        setting: "mission_control",
        visualStyle: "cinematic",
        characters: [{ id: "ai", name: "Mission Control", role: "moment_ai", expression: "neutral" }],
        actions: [{ actorId: "ai", action: "look_at_camera", timing: "start", text: "Attention. Your mission briefing." }],
        caption: `MISSION: ${goal}`,
        soundCue: "dramatic_music",
        transition: "fade",
      },
      {
        id: uid(),
        durationSeconds: 5,
        setting: "tactical_map",
        visualStyle: "hud",
        characters: [
          { id: "ai", name: "Mission Control", role: "moment_ai" },
          { id: "task", name: truncate(decisiveMove, 28), role: "constellation_node" },
        ],
        actions: [
          { actorId: "task", action: "float", timing: "start" },
          { actorId: "ai", action: "point", timing: "middle", text: `Primary objective: "${truncate(decisiveMove, 28)}"` },
        ],
        caption: `${ctx.completedTasksToday.length} completed. ${ctx.pendingTasks.length} remaining.`,
        transition: "zoom",
      },
      {
        id: uid(),
        durationSeconds: 4,
        setting: "launch",
        visualStyle: "dramatic",
        characters: [{ id: "ai", name: "Mission Control", role: "moment_ai" }],
        actions: [{ actorId: "ai", action: "dramatic_turn", timing: "end", text: "Move." }],
        caption: "Mission is live. Execute.",
        transition: "smash_cut",
      },
    ];
    return {
      id: uid(),
      title: "Mission Briefing",
      format: "mission_briefing",
      tone,
      createdAt: new Date().toISOString(),
      durationSeconds: scenes.reduce((s, sc) => s + sc.durationSeconds, 0),
      sourceContextSummary: `Goal: ${goal}. Today's move: ${truncate(decisiveMove, 24)}`,
      scenes,
      finalAction: { label: "Start the mission", action: "start_task" },
    };
  },

  context_roast(ctx, tone) {
    const patterns: string[] = [];
    if (ctx.schedulePressure === "critical") patterns.push(`${ctx.pendingTasks.length} tasks, zero margin`);
    if (ctx.missedTasksRecently.length > 0) patterns.push(`${ctx.missedTasksRecently.length} tasks missed recently`);
    if (ctx.rescheduledTasksRecently.length > 0) patterns.push(`"${truncate(ctx.rescheduledTasksRecently[0].title, 24)}" rescheduled ${ctx.rescheduledTasksRecently[0].rescheduleCount}×`);
    if (patterns.length === 0) patterns.push("no clear priority today");

    const scenes: ForgeScene[] = [
      {
        id: uid(),
        durationSeconds: 5,
        setting: "roast_stage",
        visualStyle: "spotlight",
        characters: [
          { id: "ai", name: "Moment AI", role: "moment_ai", expression: "neutral" },
          { id: "user", name: "You", role: "user_proxy", expression: "confused" },
        ],
        actions: [
          { actorId: "ai", action: "look_at_camera", timing: "start", text: "Let's review what's actually happening here." },
          { actorId: "user", action: "shake", timing: "middle" },
        ],
        caption: `Pattern detected: ${patterns[0]}`,
        transition: "cut",
      },
      {
        id: uid(),
        durationSeconds: 5,
        setting: "evidence_board",
        visualStyle: "detective",
        characters: [
          { id: "ai", name: "Moment AI", role: "moment_ai" },
          { id: "future", name: "Future You", role: "future_self" },
        ],
        actions: [
          { actorId: "ai", action: "point", timing: "start", text: patterns[1] ?? "The plan vs reality gap is showing." },
          { actorId: "future", action: "float", timing: "middle", text: "I can see this from here." },
        ],
        caption: `${ctx.completedTasksToday.length} done. ${ctx.pendingTasks.length} pending.`,
        transition: "fade",
      },
      {
        id: uid(),
        durationSeconds: 5,
        setting: "resolution",
        visualStyle: "calm",
        characters: [{ id: "ai", name: "Moment AI", role: "moment_ai" }],
        actions: [{ actorId: "ai", action: "float", timing: "middle", text: "One real move. Not three. One." }],
        caption: "The fix: one task, fully done.",
        transition: "fade",
      },
    ];
    return {
      id: uid(),
      title: "Your Plan, Honestly",
      format: "context_roast",
      tone,
      createdAt: new Date().toISOString(),
      durationSeconds: scenes.reduce((s, sc) => s + sc.durationSeconds, 0),
      sourceContextSummary: patterns.join("; "),
      scenes,
      finalAction: { label: "Reform the plan", action: "reform_plan" },
    };
  },

  goal_trailer(ctx, tone) {
    const goal = ctx.goal?.statement ? truncate(ctx.goal.statement, 40) : "your goal";
    const done = ctx.completedTasksToday[0];
    const next = ctx.pendingTasks[0];
    const scenes: ForgeScene[] = [
      {
        id: uid(),
        durationSeconds: 5,
        setting: "cinematic_landscape",
        visualStyle: "epic",
        characters: [{ id: "goal", name: goal, role: "constellation_node" }],
        actions: [{ actorId: "goal", action: "float", timing: "start" }],
        caption: goal,
        soundCue: "cinematic_swell",
        transition: "fade",
      },
      {
        id: uid(),
        durationSeconds: 5,
        setting: "progress_montage",
        visualStyle: "highlight_reel",
        characters: [
          { id: "goal", name: goal, role: "constellation_node" },
          { id: "task", name: done ? truncate(done.title, 28) : "today's work", role: "task", expression: "proud" },
        ],
        actions: [
          { actorId: "task", action: "look_at_camera", timing: "start", text: done ? `"${truncate(done.title, 28)}" — done.` : "Work in progress." },
          { actorId: "goal", action: "float", timing: "middle" },
        ],
        caption: done ? `Completed: "${truncate(done.title, 28)}"` : "The path is building.",
        transition: "zoom",
      },
      {
        id: uid(),
        durationSeconds: 4,
        setting: "call_to_action",
        visualStyle: "dramatic",
        characters: [{ id: "ai", name: "Moment AI", role: "moment_ai" }],
        actions: [{ actorId: "ai", action: "dramatic_turn", timing: "end", text: next ? `Next: "${truncate(next.title, 28)}"` : "Keep moving." }],
        caption: "The story continues.",
        transition: "smash_cut",
      },
    ];
    return {
      id: uid(),
      title: `The ${goal} Story`,
      format: "goal_trailer",
      tone,
      createdAt: new Date().toISOString(),
      durationSeconds: scenes.reduce((s, sc) => s + sc.durationSeconds, 0),
      sourceContextSummary: `Goal: ${goal}. ${ctx.completedTasksToday.length} done today.`,
      scenes,
      finalAction: {
        label: next ? "Do the next task" : "Review the plan",
        action: next ? "start_task" : "reform_plan",
        linkedTaskId: next?.id,
      },
    };
  },

  weekly_recap(ctx, tone) {
    const doneCount = ctx.completedTasksToday.length;
    const missedCount = ctx.missedTasksRecently.length;
    const scenes: ForgeScene[] = [
      {
        id: uid(),
        durationSeconds: 5,
        setting: "recap_studio",
        visualStyle: "news",
        characters: [{ id: "anchor", name: "Weekly Recap", role: "news_anchor" }],
        actions: [{ actorId: "anchor", action: "look_at_camera", timing: "start", text: "Here's what happened this week." }],
        caption: `${doneCount} done · ${missedCount} missed`,
        transition: "cut",
      },
      {
        id: uid(),
        durationSeconds: 5,
        setting: "stat_board",
        visualStyle: "clean",
        characters: [
          { id: "anchor", name: "Recap Host", role: "news_anchor" },
          { id: "ai", name: "Moment AI", role: "moment_ai" },
        ],
        actions: [
          { actorId: "ai", action: "float", timing: "start", text: ctx.constellationDay?.current_bottleneck ? `Main bottleneck: "${truncate(ctx.constellationDay.current_bottleneck, 28)}"` : "Pattern: tasks started but not finished." },
          { actorId: "anchor", action: "react", timing: "middle" },
        ],
        caption: `Pressure: ${ctx.schedulePressure}. Alignment: ${ctx.alignmentState?.status ?? "unknown"}.`,
        transition: "fade",
      },
      {
        id: uid(),
        durationSeconds: 4,
        setting: "next_week",
        visualStyle: "calm",
        characters: [{ id: "ai", name: "Moment AI", role: "moment_ai" }],
        actions: [{ actorId: "ai", action: "look_at_camera", timing: "end", text: "One change next week. Make it real." }],
        caption: "One adjustment. That's all.",
        transition: "fade",
      },
    ];
    return {
      id: uid(),
      title: "Weekly Recap",
      format: "weekly_recap",
      tone,
      createdAt: new Date().toISOString(),
      durationSeconds: scenes.reduce((s, sc) => s + sc.durationSeconds, 0),
      sourceContextSummary: `${doneCount} done, ${missedCount} missed, ${ctx.schedulePressure} pressure`,
      scenes,
      finalAction: { label: "Reflect on the week", action: "reflect" },
    };
  },

  task_rescue(ctx, tone) {
    const stuck = ctx.missedTasksRecently[0] ?? ctx.rescheduledTasksRecently[0] ?? ctx.pendingTasks[0];
    const taskName = stuck ? truncate(stuck.title, 32) : "the task you're avoiding";
    const scenes: ForgeScene[] = [
      {
        id: uid(),
        durationSeconds: 5,
        setting: "distress_signal",
        visualStyle: "dramatic",
        characters: [{ id: "task", name: taskName, role: "task", expression: "haunted" }],
        actions: [{ actorId: "task", action: "shake", timing: "start", text: "I've been waiting…" }],
        caption: `"${taskName}" has been stuck.`,
        soundCue: "alert",
        transition: "smash_cut",
      },
      {
        id: uid(),
        durationSeconds: 5,
        setting: "rescue_mission",
        visualStyle: "action",
        characters: [
          { id: "ai", name: "Moment AI", role: "moment_ai" },
          { id: "task", name: taskName, role: "task", expression: "tired" },
        ],
        actions: [
          { actorId: "ai", action: "enter", timing: "start", text: "What's actually blocking this?" },
          { actorId: "task", action: "react", timing: "middle" },
        ],
        caption: "The block is usually: too big, or unclear first step.",
        transition: "cut",
      },
      {
        id: uid(),
        durationSeconds: 5,
        setting: "resolution",
        visualStyle: "calm",
        characters: [
          { id: "ai", name: "Moment AI", role: "moment_ai" },
          { id: "task", name: taskName, role: "task", expression: "neutral" },
        ],
        actions: [
          { actorId: "ai", action: "float", timing: "middle", text: "Break it to 15 minutes. Just start." },
          { actorId: "task", action: "float", timing: "end" },
        ],
        caption: "Rescue complete. Start small.",
        transition: "fade",
      },
    ];
    return {
      id: uid(),
      title: `Rescue: "${taskName}"`,
      format: "task_rescue",
      tone,
      createdAt: new Date().toISOString(),
      durationSeconds: scenes.reduce((s, sc) => s + sc.durationSeconds, 0),
      sourceContextSummary: `Stuck task: ${taskName}`,
      scenes,
      finalAction: {
        label: "Break it down",
        action: "break_down_task",
        linkedTaskId: stuck?.id,
      },
    };
  },
};

export function generateForgeEpisode({
  format,
  tone,
  context,
}: {
  format: ForgeEpisodeFormat;
  tone: ForgeEpisodeTone;
  context: ForgeContextSnapshot;
}): ForgeEpisode {
  const builder = builders[format];
  return builder(context, tone);
}
