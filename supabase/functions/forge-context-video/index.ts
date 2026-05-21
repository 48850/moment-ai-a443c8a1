// Forge Context Reel — celebrity-podcast style two-host clip about the user's day.
// Body: { snapshot, format, tone?, with_voiceover?: boolean (default true) }
// Returns: { result: ContextReel }
import { MOMENT_AI_DOCTRINE } from "../_shared/moment-ai-doctrine.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-3-flash-preview";

// Two hosts — energetic male hype friend + warm female co-host.
const HOSTS = {
  A: { name: "Bridge",  voice_id: "nPczCjzI2devNBz1zQrb", role: "hype-friend, loud, gassed-up, calls the plays" }, // Brian
  B: { name: "Sasha",   voice_id: "EXAVITQu4vr4xnSDxMaL", role: "warm co-host, dry-funny, lands the real talk gently" }, // Sarah
} as const;

type Snapshot = Record<string, any>;

function renderPortfolio(p: any): string {
  if (!p) return "(no portfolio yet)";
  const s = p.lifetime_stats ?? {};
  const completed = (p.completed_work ?? []).slice(-6).map((c: any) => `• ${c.title}`).join("\n");
  const struggles = (p.recurring_patterns?.common_struggles ?? []).slice(0, 4).join(", ");
  const wins = (p.recurring_patterns?.common_wins ?? []).slice(0, 4).join(", ");
  return [
    `Lifetime: ${s.tasks_completed ?? 0}/${s.tasks_total ?? 0} tasks · streak ${s.streak_days ?? 0}d.`,
    completed && `Recent wins:\n${completed}`,
    struggles && `Recurring struggles: ${struggles}`,
    wins && `Recurring wins: ${wins}`,
  ].filter(Boolean).join("\n");
}

function renderContext(snap: Snapshot): string {
  const u = snap?.user ?? {};
  const g = snap?.active_goal ?? {};
  const r = snap?.current_reality ?? {};
  const pending = (snap?.signals?.task_notes_context ?? []).map((t: any) => `- "${t.task_title}" (${t.task_status})`).slice(0, 6).join("\n");
  return `
USER: ${u.display_name ?? "the user"} · age ${u.age ?? "?"} · ${u.school_year ?? ""}.
GOAL: ${g.long_term_goal || g.statement || "(unset)"} → milestone: ${g.medium_term_goal || "(unset)"} → proof: ${g.short_term_goal || "(unset)"}
Why: ${g.why_it_matters || "(unset)"}  Identity: ${g.desired_identity || "(unset)"}
TODAY: energy ${r.today_energy ?? "?"} · ${r.available_study_minutes ?? 0} min available · ${r.pending_tasks_count ?? 0} pending.
Stall pattern: ${r.stall_pattern?.label ?? "none"}
NEXT MOVE CANDIDATE: ${r.first_pending_high_priority ? `"${r.first_pending_high_priority.title}" (${r.first_pending_high_priority.estimated_minutes}min, id=${r.first_pending_high_priority.id})` : "none"}
PENDING:
${pending || "(none)"}
PORTFOLIO:
${renderPortfolio(snap?.learning_portfolio)}
`.trim();
}

const FORMAT_BRIEFS: Record<string, string> = {
  pov:                "POV podcast clip — two hosts react to the user's day so far like sports commentators calling a game. Hype, specific, observational. End by hyping the next move.",
  roast:              "Roast-the-CALENDAR clip — two hosts roast the AVOIDANCE (Spotify, scrolling, the 11pm self-pep-talk) as if it's a character that keeps stealing time. The user is the hero being ambushed. NEVER roast the user. End by gassing them up for the comeback move.",
  trailer:            "Movie-trailer podcast cold open — Host A does cinematic narration about the long-term goal, Host B grounds it with the actual next move. Big stakes, real action.",
  recap:              "Weekly recap podcast — two hosts review the user's week with real numbers, give them a 'play of the week', and tee up next week's first move.",
  mission_briefing:   "Mission control podcast briefing — Host A is mission commander, Host B is co-pilot. Name the target, the obstacle, the 3-minute launch step.",
  mockumentary:       "Mockumentary podcast — deadpan narrators observing the user's habits with affection. Funny, never mean. End on the next move.",
  motivational_edit:  "Hype-edit podcast — pure 'let's GO' energy. Two hosts pump up the user for ONE specific action right now.",
};

function buildPrompt(snap: Snapshot, format: string, tone?: string): string {
  const brief = FORMAT_BRIEFS[format] ?? FORMAT_BRIEFS.pov;
  return `${renderContext(snap)}

GENERATION BRIEF
You are scripting a short PODCAST REEL — like a viral 30-second clip of two podcast hosts talking about the user's actual day. Conversational, fast, overlapping energy. The two hosts have NAMES and ALTERNATE turns naturally.

HOSTS:
- Host A — "${HOSTS.A.name}" — ${HOSTS.A.role}
- Host B — "${HOSTS.B.name}" — ${HOSTS.B.role}

Format: ${format}
Tone: ${tone || "hype friend / coach"}
Spec: ${brief}

OUTPUT — return ONLY this JSON, no prose:
{
  "title": "Episode title (≤8 words, podcast-style)",
  "format": "${format}",
  "show_name": "Moment Daily — short tagline",
  "hook": "Cold-open line Host A says first (≤12 words)",
  "segments": [
    {
      "host": "A" | "B",
      "line": "What this host actually says — natural, spoken, one short sentence, max 22 words. References REAL things from the snapshot (real task title, real number, real pattern).",
      "emotion": "hype | deadpan | warm | mock-shock | conspiratorial | celebrating"
    }
  ],
  "caption": "TikTok caption with 1-2 emojis",
  "palette": { "bg": "#hex (deep, podcasty)", "fg": "#hex (text)", "accent": "#hex (bold)" },
  "call_to_action": {
    "kind": "start_task | break_down | reform_plan | schedule | reflect | open_node | rescue",
    "label": "Tappable button label (≤4 words)",
    "task_id": "REQUIRED if start_task or break_down — use a real id from the snapshot",
    "prompt": "REQUIRED if reflect — one-line reflection"
  }
}

HARD RULES:
- 6–10 segments total. Hosts alternate but can do 2 in a row for comedic timing. Aim for ~25–40s spoken.
- Each line MUST sound spoken aloud — contractions, interjections ("yo", "okay listen", "no but-"), natural rhythm. NOT written.
- ALWAYS use real specifics from the snapshot (real task titles, real numbers, real stall pattern).
- HYPE THE USER. Roast the avoidance / calendar / 11pm self, NEVER the user.
- NEVER reference the user's intelligence, body, identity, family, mental health, neurotype, or worth.
- call_to_action is MANDATORY. Prefer start_task on the first_pending_high_priority if it exists.
- Last 1–2 segments must directly tee up the CTA (e.g. "...so the play is: 6 minutes, right now, on that biology essay.").
- Never include "as an AI", "stay motivated", "follow your dreams", "SMART goals", "just be consistent".`;
}

async function generateScript(snap: Snapshot, format: string, tone?: string) {
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
        { role: "user", content: buildPrompt(snap, format, tone) },
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

  parsed.id = crypto.randomUUID();
  parsed.created_at = new Date().toISOString();
  parsed.format = format;
  parsed.show_name = parsed.show_name || "Moment Daily";
  parsed.hosts = {
    A: { name: HOSTS.A.name },
    B: { name: HOSTS.B.name },
  };
  parsed.palette = {
    bg: parsed.palette?.bg ?? "#0a0a14",
    fg: parsed.palette?.fg ?? "#ffffff",
    accent: parsed.palette?.accent ?? "#ff5a36",
  };
  parsed.segments = (parsed.segments ?? []).map((s: any, i: number) => ({
    idx: i,
    host: (s.host === "B" ? "B" : "A") as "A" | "B",
    line: String(s.line ?? "").trim(),
    emotion: s.emotion ?? "hype",
  })).filter((s: any) => s.line);

  if (!parsed.call_to_action?.kind) {
    parsed.call_to_action = {
      kind: snap?.current_reality?.first_pending_high_priority ? "start_task" : "reform_plan",
      label: snap?.current_reality?.first_pending_high_priority ? "Start it now" : "Reform the plan",
      task_id: snap?.current_reality?.first_pending_high_priority?.id,
    };
  }
  parsed.has_voiceover = false;
  return parsed;
}

async function tts(text: string, voiceId: string, prev?: string, next?: string): Promise<string> {
  const KEY = Deno.env.get("ELEVENLABS_API_KEY");
  if (!KEY) throw new Error("ELEVENLABS_API_KEY not configured");
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
        voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.55, use_speaker_boost: true, speed: 1.05 },
      }),
    },
  );
  if (!resp.ok) {
    const t = await resp.text();
    console.error("elevenlabs", resp.status, t);
    throw new Error(`Voiceover failed (${resp.status})`);
  }
  const buf = await resp.arrayBuffer();
  return base64Encode(new Uint8Array(buf));
}

async function attachVoiceover(segments: any[]) {
  // Generate audio in parallel for speed (capped to 8 concurrent).
  const results = await Promise.all(
    segments.map((s, i) => {
      const voiceId = s.host === "B" ? HOSTS.B.voice_id : HOSTS.A.voice_id;
      const prev = segments[i - 1]?.host === s.host ? segments[i - 1]?.line : undefined;
      const next = segments[i + 1]?.host === s.host ? segments[i + 1]?.line : undefined;
      return tts(s.line, voiceId, prev, next).then((audio_base64) => ({ ...s, audio_base64 }));
    }),
  );
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { snapshot = {}, format = "pov", tone, with_voiceover = true } = body ?? {};
    if (!Object.keys(FORMAT_BRIEFS).includes(format)) {
      return new Response(JSON.stringify({ error: "Unknown format" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const reel = await generateScript(snapshot, format, tone);
    if (with_voiceover && reel.segments?.length) {
      reel.segments = await attachVoiceover(reel.segments);
      reel.has_voiceover = true;
    }

    return new Response(JSON.stringify({ result: reel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("forge-context-video error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
