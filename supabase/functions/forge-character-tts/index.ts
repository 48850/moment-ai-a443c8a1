// Per-character ElevenLabs TTS for the storyboard player.
// When the user swaps a host for a custom character, the frontend calls this
// to get a real (non-robotic) voice instead of browser speechSynthesis.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const ALLOWED_VOICES = new Set([
  "CwhRBWXzGAHq8TQ4Fs17","EXAVITQu4vr4xnSDxMaL","FGY2WhTYpPnrIDTdsKH5","IKne3meq5aSn9XLyUdCD",
  "JBFqnCBsd6RMkjVDRZzb","N2lVS1w4EtoT3dr4eOWO","SAz9YHcvj6GT2YYXdXww","TX3LPaxmHKxFdv7VOQHJ",
  "Xb7hH8MSUJpSbSDYk0k2","XrExE9yKIg1WjnnlVkGX","bIHbv24MWmeRgasZH58o","cgSgspJ2msm6clMCkdW9",
  "cjVigY5qzO86Huf0OWal","iP95p4xoKVk53GoZ742B","nPczCjzI2devNBz1zQrb","onwK4e9ZLuTAKqWW03F9",
  "pFZP5JQG7iQjIQuC4Bku","pqHfZKP75CvOlQylNhV4",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { text, voiceId, stability, similarity_boost, style, speed } = await req.json();
    if (typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof voiceId !== "string" || !ALLOWED_VOICES.has(voiceId)) {
      return new Response(JSON.stringify({ error: "invalid voiceId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.slice(0, 1200),
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: stability ?? 0.45,
            similarity_boost: similarity_boost ?? 0.78,
            style: style ?? 0.45,
            use_speaker_boost: true,
            speed: speed ?? 1.0,
          },
        }),
      },
    );
    if (!resp.ok) {
      const errTxt = await resp.text();
      return new Response(JSON.stringify({ error: `elevenlabs ${resp.status}`, detail: errTxt.slice(0, 400) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const buf = new Uint8Array(await resp.arrayBuffer());
    const audio_base64 = base64Encode(buf);
    return new Response(JSON.stringify({ audio_base64 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
