import { FEEDBACK_OPTIONS } from "@/lib/state/schema";

export type FeedbackKey = (typeof FEEDBACK_OPTIONS)[number];

export const FEEDBACK_LABELS: Record<FeedbackKey, string> = {
  hard_to_start: "Hard to start",
  too_long: "Took too long",
  distracted: "Got distracted",
  felt_pointless: "Felt pointless",
  useful: "Useful",
  easy: "Easy",
  hard: "Hard",
  too_vague: "Too vague",
  too_big: "Too big",
  too_small: "Too small",
  valuable: "Valuable",
  not_relevant: "Not relevant",
  need_help: "Need help",
  do_differently: "Do differently",
  tired: "I'm tired",
  overwhelmed: "Overwhelmed",
  dont_understand: "Don't understand",
  feels_unrealistic: "Feels unrealistic",
  wrong_time: "Wrong time",
  too_much_today: "Too much today",
  make_simpler: "Make it simpler",
  make_more_ambitious: "More ambitious",
  be_more_direct: "Be more direct",
  be_gentler: "Be gentler",
};

/** Calm, non-shaming response after each tap. Always plan-blaming, not user-blaming. */
export const FEEDBACK_RESPONSE: Record<FeedbackKey, string> = {
  hard_to_start: "Got it — I'll shrink the next move so it's easy to begin.",
  too_long: "Noted — I'll cut the next one shorter.",
  distracted: "Okay — I'll make the next step sharper and smaller.",
  felt_pointless: "Useful signal — I'll re-check whether this move still fits.",
  useful: "Good — I'll lean into this kind of move.",
  easy: "Noted — I'll nudge the next one a touch harder.",
  hard: "Got it. Useful signal — I'll lower the activation cost next time.",
  too_vague: "Thanks. I'll define the first concrete action more clearly.",
  too_big: "We're not cancelling the goal — I'll size the next step smaller.",
  too_small: "Okay, I'll give you a bit more to bite into.",
  valuable: "Good — this kind of move seems to land. I'll lean into it.",
  not_relevant: "Useful — I'll re-check whether this pathway still fits.",
  need_help: "Okay. I'll bring more scaffolding next time.",
  do_differently: "Heard. I'll change the shape of the next one.",
  tired: "Okay. We'll preserve one meaningful action and move heavy work later.",
  overwhelmed: "Understood. I'll shrink today's plan to what protects the goal.",
  dont_understand: "On it — I'll explain the why and the first step more plainly.",
  feels_unrealistic: "Useful signal. We'll adjust the plan, not the goal.",
  wrong_time: "Got it — I'll stop placing heavy work in this window.",
  too_much_today: "Okay. I'll trim today and protect tomorrow.",
  make_simpler: "Understood — simpler shapes from here.",
  make_more_ambitious: "Good — I'll raise the bar on the next move.",
  be_more_direct: "Heard. Less cushion, clearer next step.",
  be_gentler: "Of course. Softer pace, same direction.",
};

/** Compact tone groups used for the chip palette. */
export const FEEDBACK_GROUPS: { id: string; label: string; keys: FeedbackKey[] }[] = [
  { id: "fit",    label: "Fit",    keys: ["too_big", "too_small", "too_vague", "make_simpler", "make_more_ambitious"] },
  { id: "value",  label: "Signal", keys: ["valuable", "not_relevant", "need_help", "do_differently"] },
  { id: "energy", label: "Today",  keys: ["tired", "overwhelmed", "too_much_today", "wrong_time", "feels_unrealistic", "dont_understand"] },
  { id: "tone",   label: "Tone",   keys: ["be_gentler", "be_more_direct"] },
];
