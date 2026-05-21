// Forge Context Video Generator
// Body: { snapshot, format, tone?, with_voiceover?: boolean, voice_id? }
// Returns: { result: ContextVideo } — scenes optionally include audio_base64 if with_voiceover=true.
import { MOMENT_AI_DOCTRINE } from "../_shared/moment-ai-doctrine.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-3-flash-preview";
const DEFAULT_VOICE_ID = "IKne3meq5aSn9XLyUdCD"; // Charlie

type Snapshot = Record<string, any>;

function renderPortfolio(p: any): string {
  if (!p) return "(no portfolio yet)";
  const s = p.lifetime_stats ?? {};
  const completed = (p.completed_work ?? []).slice(-8).map((c: any) => `• ${c.title}${c.proof ? ` (${c.proof})` : ""}`).join("\n");
  const lessons = (p.mini_lessons_learned ?? []).slice(-5).map((l: any) => `• ${l.title}: ${l.body}`).join("\n");
  const struggles = (p.recurring_patterns?.common_struggles ?? []).slice(0, 5).join(", ");
  const wins = (p.recurring_patterns?.common_wins ?? []).slice(0, 5).join(", ");
  const feedback = (p.recurring_patterns?.common_feedback ?? []).slice(0, 5).map((f: any) => `${f.label}×${f.count}`).join(", ");
  return [
    `Lifetime: ${s.tasks_completed ?? 0}/${s.tasks_total ?? 0} tasks · streak ${s.streak_days ?? 0}d · ${s.notes_written ?? 0} notes · ${s.reflections_logged ?? 0} reflections.`,
    completed && `Recent completed:\n${completed}`,
    lessons && `Mini-lessons taught (DO NOT RE-TEACH):\n${lessons}`,
    struggles && `Recurring struggles: ${struggles}`,
    wins && `Recurring wins: ${wins}`,
    feedback && `Feedback pattern: ${feedback}`,
  ].filter(Boolean).join("\n");
}

function renderNotes(snap: Snapshot): string {
  const list = snap?.signals?.task_notes_context ?? [];
  if (!list.length) return "(no notes yet)";
  return list.slice(-8).map((t: any) => {
    const notes = (t.notes ?? []).map((n: any) => `   - ${String(n.content).slice(0, 280)}`).join("\n");
    const review = t.latest_review
      ? `\n   Prior review: ${t.latest_review.headline}${t.latest_review.mini_lesson?.title ? ` · lesson "${t.latest_review.mini_lesson.title}"` : ""}`
      : "";
    return `• "${t.task_title}" (${t.task_status})${review}\n${notes || "   (no note bodies)"}`;
  }).join("\n");
}

function renderContext(snap: Snapshot, format?: string): string {
  const u = snap?.user ?? {};
  const g = snap?.active_goal ?? {};
  const r = snap?.current_reality ?? {};
  const pending = (snap?.signals?.task_notes_context ?? []).map((t: any) => `- "${t.task_title}" (${t.task_status})`).slice(0, 8).join("\n");
  const notesBlock = format === "review"
    ? `\nNOTES TO CONSOLIDATE (verbatim — use real phrases from these):\n${renderNotes(snap)}\n`
    : "";
  return `
USER: ${u.display_name ?? "the user"} · age ${u.age ?? "?"} · ${u.school_year ?? ""} · ${u.academic_context ?? ""}.

GOAL TRIO:
- Long-term anchor: ${g.long_term_goal || g.statement || "(unset)"}
- Medium-term milestone: ${g.medium_term_goal || "(unset)"}
- Short-term proof: ${g.short_term_goal || "(unset)"}
Why it matters: ${g.why_it_matters || "(unset)"}
Identity: ${g.desired_identity || "(unset)"} · Current stage: ${g.current_stage || "(unset)"} → target: ${g.target_stage || "(unset)"}
Reality gap: ${g.reality_gap || "(unset)"}

TODAY: energy ${r.today_energy ?? "?"} · ${r.available_study_minutes ?? 0} study minutes available · ${r.pending_tasks_count ?? 0} pending tasks.
Stall pattern: ${r.stall_pattern?.label ?? "none"} (${(r.stall_pattern?.evidence_chips ?? []).join(", ")})
First high-priority pending: ${r.first_pending_high_priority ? `"${r.first_pending_high_priority.title}" (${r.first_pending_high_priority.estimated_minutes}min, id=${r.first_pending_high_priority.id})` : "none"}

TASK SIGNALS:
${pending || "(none)"}
${notesBlock}
LEARNING PORTFOLIO:
${renderPortfolio(snap?.learning_portfolio)}
`.trim();
}

const FORMAT_BRIEFS: Record<string, string> = {
  pov: "Short POV mini-story (4-6 scenes, 3-5s each). Funny, observational, teen-native. Caption like a TikTok. Each scene names something the user actually did or didn't do today.",
  roast: "Playful roast (4-5 scenes, 3-5s each). Roast the BEHAVIOUR (avoidance, rescheduling, opening Spotify) — NEVER the user's intelligence, body, identity, family, mental health, or worth. End warm with a tiny launch step.",
  trailer: "Cinematic goal trailer (5-6 scenes, 4-7s each). Dramatic VO. Connect the goal trio. Treat their long-term anchor as the destination, medium milestone as the rising stake, short-term proof as the next move. Stylised, not corny.",
  recap: "Weekly recap (5-6 scenes, 4-6s each). Real numbers from the portfolio. Name one win, one escape, one pattern, one upgrade for next week.",
  mission_briefing: "Pre-block mission briefing (4-5 scenes, 3-5s each). Agent-style. Name the enemy (avoidance / specific task / time pressure), the weakness (starting), the first move (3-minute launch step).",
  mockumentary: "Mockumentary documentary clip (5-6 scenes, 4-6s each). Deadpan narrator observing the user's habits in third person. Subtle humour, ends with the next concrete move.",
  motivational_edit: "Short motivational edit (4-5 scenes, 3-5s each). Crisp, not cringe. No 'follow your dreams'. Concrete, identity-grounded.",
  review: "Study-review consolidation clip (5-6 scenes, 4-6s each). Calm, teacherly, focused. Scene 1: name the topic/task being reviewed (use real task title). Scenes 2-4: each consolidates ONE key idea from the user's actual notes — quote or paraphrase a real phrase from their notes in the voiceover, then compress it into a sharp 1-line takeaway as on_screen_text. Scene 5: name the gap or weakest link to revisit (from notes or prior review gaps). Final scene: one concrete next action — re-do a problem, teach it back out loud, or schedule a recall block. Palette: warm paper / deep ink / single saturated accent — feels like a study flashcard, not a TikTok. If there are no notes, return a single-scene clip telling the user to capture notes first and CTA kind=reflect.",
};

function buildVideoPrompt(snap: Snapshot, format: string, tone?: string): string {
  const brief = FORMAT_BRIEFS[format] ?? FORMAT_BRIEFS.pov;
  return `${renderContext(snap)}

GENERATION BRIEF
Format: ${format}
Tone: ${tone || "playful, teen-native, specific"}
Spec: ${brief}

OUTPUT — return ONLY this JSON shape, no prose:
{
  "title": "Short cinematic title (≤8 words)",
  "format": "${format}",
  "tone": "string",
  "hook": "One-line hook the video opens on",
  "scenes": [
    {
      "scene_number": 1,
      "visual_prompt": "Vivid one-sentence visual description (will be rendered as typography + animated gradient — keep it about mood, colour, and motion)",
      "voiceover": "What the narrator says (one sentence per scene, max 18 words)",
      "on_screen_text": "BIG on-screen text (≤8 words, kinetic-typography style)",
      "duration_seconds": 5,
      "palette": { "bg": "#hex", "fg": "#hex", "accent": "#hex" }
    }
  ],
  "caption": "TikTok-style caption with 1-2 emojis",
  "call_to_action": {
    "kind": "start_task | break_down | reform_plan | schedule | reflect | open_node | rescue",
    "label": "Tappable button label (≤4 words)",
    "task_id": "REQUIRED if kind is start_task or break_down — must be a real task id from the snapshot if available",
    "prompt": "REQUIRED if kind is reflect — a one-line reflection prompt"
  }
}

HARD RULES:
- ALWAYS use real specifics from the snapshot above (real task titles, real numbers, real stall pattern). No generic productivity talk.
- Each scene's palette must be coherent with the format (roast = warm orange/red, trailer = cinematic deep blue/gold, recap = soft pastels, mission_briefing = high-contrast black/yellow, pov = whatever fits the moment).
- 4-6 scenes total. Total duration 15-30s.
- call_to_action is MANDATORY. Prefer start_task on the first_pending_high_priority task if it exists.
- NEVER attack the user's intelligence, body, identity, family, mental health, or worth — roast behaviour only.
- Never include "as an AI", "stay motivated", "follow your dreams", "SMART goals", or "just be consistent".`;
}

async function generateConcept(snap: Snapshot, format: string, tone?: string) {
  const KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!KEY) throw new Error("LOVABLE_API_KEY not configured");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: MOMENT_AI_DOCTRINE },
        { role: "user", content: buildVideoPrompt(snap, format, tone) },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("ai gateway", resp.status, text);
    throw new Error(resp.status === 429 ? "Rate limited" : resp.status === 402 ? "Out of AI credits" : "AI gateway error");
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const cleaned = String(content).trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  const parsed = JSON.parse(cleaned);

  // Normalise / defaults
  parsed.id = crypto.randomUUID();
  parsed.created_at = new Date().toISOString();
  parsed.format = format;
  parsed.scenes = (parsed.scenes ?? []).map((s: any, i: number) => ({
    scene_number: s.scene_number ?? i + 1,
    visual_prompt: s.visual_prompt ?? "",
    voiceover: s.voiceover ?? "",
    on_screen_text: s.on_screen_text ?? "",
    duration_seconds: Math.max(2, Math.min(10, Number(s.duration_seconds) || 5)),
    palette: {
      bg: s.palette?.bg ?? "#0a0a14",
      fg: s.palette?.fg ?? "#ffffff",
      accent: s.palette?.accent ?? "#ff5a36",
    },
  }));
  parsed.has_voiceover = false;

  if (!parsed.call_to_action || !parsed.call_to_action.kind) {
    parsed.call_to_action = {
      kind: snap?.current_reality?.first_pending_high_priority ? "start_task" : "reform_plan",
      label: snap?.current_reality?.first_pending_high_priority ? "Start it now" : "Reform the plan",
      task_id: snap?.current_reality?.first_pending_high_priority?.id,
    };
  }

  return parsed;
}

async function generateVoiceover(scenes: any[], voiceId: string) {
  const KEY = Deno.env.get("ELEVENLABS_API_KEY");
  if (!KEY) throw new Error("ELEVENLABS_API_KEY not configured");

  const out: any[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const text = (s.voiceover || s.on_screen_text || "").trim();
    if (!text) { out.push({ ...s }); continue; }
    const prev = scenes[i - 1]?.voiceover;
    const next = scenes[i + 1]?.voiceover;

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          previous_text: prev,
          next_text: next,
          voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true, speed: 1.0 },
        }),
      },
    );
    if (!resp.ok) {
      const errText = await resp.text();
      console.error("elevenlabs", resp.status, errText);
      throw new Error(`Voiceover failed (${resp.status})`);
    }
    const buf = await resp.arrayBuffer();
    out.push({ ...s, audio_base64: base64Encode(new Uint8Array(buf)) });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { snapshot = {}, format = "pov", tone, with_voiceover = false, voice_id = DEFAULT_VOICE_ID } = body ?? {};
    if (!["pov", "roast", "trailer", "recap", "mission_briefing", "mockumentary", "motivational_edit"].includes(format)) {
      return new Response(JSON.stringify({ error: "Unknown format" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const concept = await generateConcept(snapshot, format, tone);
    if (with_voiceover) {
      concept.scenes = await generateVoiceover(concept.scenes, voice_id);
      concept.has_voiceover = true;
    }

    return new Response(JSON.stringify({ result: concept }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("forge-context-video error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
