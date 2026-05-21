import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Sparkles, Loader2, Film, Flame, Award, Target, History, Stars, Mic2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildContextPacket } from "@/lib/ai/context-packet";
import { useStateStore } from "@/stores/state-store";
import { StoryboardPlayer } from "@/components/app/forge/StoryboardPlayer";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type Format = "pov" | "roast" | "trailer" | "recap" | "mission_briefing" | "mockumentary" | "motivational_edit";

const CARDS: Array<{ format: Format; title: string; subtitle: string; icon: any; bg: string }> = [
  { format: "pov", title: "Make a funny video about today", subtitle: "POV: your day, as the AI sees it", icon: Film, bg: "from-fuchsia-500/20 to-purple-700/10" },
  { format: "roast", title: "Roast my procrastination", subtitle: "Playful — roasts behaviour, never you", icon: Flame, bg: "from-orange-500/25 to-red-700/10" },
  { format: "trailer", title: "Cinematic goal trailer", subtitle: "Your long-term anchor, dramatised", icon: Stars, bg: "from-amber-400/20 to-yellow-700/10" },
  { format: "mission_briefing", title: "Mission briefing", subtitle: "Pre-block briefing for your next move", icon: Target, bg: "from-emerald-500/20 to-teal-700/10" },
  { format: "recap", title: "Weekly recap", subtitle: "Real numbers, one upgrade for next week", icon: Award, bg: "from-sky-500/20 to-indigo-700/10" },
  { format: "mockumentary", title: "Mockumentary clip", subtitle: "Deadpan narrator observes your week", icon: History, bg: "from-slate-500/20 to-zinc-700/10" },
];

export default function ForgeVideoStudio() {
  const state = useStateStore((s) => s.state);
  const applyPatch = useStateStore((s) => s.applyPatch);
  const navigate = useNavigate();
  const [generating, setGenerating] = useState<Format | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [activeVideo, setActiveVideo] = useState<any | null>(null);
  const recent: any[] = state?.forge_state?.forge_videos ?? [];

  async function generate(format: Format) {
    if (!state) return;
    setGenerating(format);
    setActiveVideo(null);
    try {
      const snapshot = buildContextPacket(state);
      const { data, error } = await supabase.functions.invoke("forge-context-video", {
        body: { snapshot, format, with_voiceover: false },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const video = data?.result;
      if (!video) throw new Error("Empty response");
      setActiveVideo(video);
      // persist to state (cap to last 10)
      const list = [video, ...(state.forge_state?.forge_videos ?? [])].slice(0, 10);
      applyPatch({ forge_state: { ...(state.forge_state as any), forge_videos: list } });
    } catch (e) {
      console.error(e);
      toast({ title: "Couldn't generate video", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  }

  async function addVoiceover() {
    if (!activeVideo || activeVideo.has_voiceover) return;
    setVoiceLoading(true);
    try {
      const snapshot = buildContextPacket(state);
      // Re-call with voiceover for the same format — fresh take with audio
      const { data, error } = await supabase.functions.invoke("forge-context-video", {
        body: { snapshot, format: activeVideo.format, with_voiceover: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const video = data?.result;
      setActiveVideo(video);
      const list = [video, ...(state?.forge_state?.forge_videos ?? [])].slice(0, 10);
      applyPatch({ forge_state: { ...(state?.forge_state as any), forge_videos: list } });
    } catch (e) {
      console.error(e);
      toast({ title: "Voiceover failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setVoiceLoading(false);
    }
  }

  function handleCta(cta: any) {
    switch (cta.kind) {
      case "start_task":
      case "break_down":
        navigate("/app/tasks");
        break;
      case "reform_plan":
      case "schedule":
        navigate("/app/plan");
        break;
      case "reflect":
        navigate("/app/reflect");
        break;
      case "rescue":
        navigate("/app/rescue");
        break;
      case "open_node":
        navigate("/app/mission");
        break;
      default:
        navigate("/app");
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/app/forge" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Forge
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Context Video Studio
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Turn your week into a video.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Moment reads your goal, today, your tasks, what you skipped, and the pattern across the week — and renders it as a short, personalised piece. Every video ends in one tappable next move.
        </p>
      </div>

      {/* Active video */}
      {activeVideo && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Now playing</div>
            <div className="flex gap-2">
              {!activeVideo.has_voiceover && (
                <Button size="sm" variant="outline" onClick={addVoiceover} disabled={voiceLoading}>
                  {voiceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mic2 className="h-4 w-4 mr-1" /> Add voiceover</>}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setActiveVideo(null)}>Close</Button>
            </div>
          </div>
          <div className="text-xl font-semibold">{activeVideo.title}</div>
          <StoryboardPlayer video={activeVideo} onCta={handleCta} />
        </div>
      )}

      {/* Generator cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {CARDS.map((c) => {
          const Icon = c.icon;
          const isLoading = generating === c.format;
          return (
            <button
              key={c.format}
              disabled={generating !== null}
              onClick={() => generate(c.format)}
              className={`group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${c.bg} p-5 text-left transition hover:border-primary/50 disabled:opacity-50`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-xl bg-background/60 p-2">
                  <Icon className="h-5 w-5" />
                </div>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Sparkles className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                )}
              </div>
              <div className="mt-4 text-base font-semibold">{c.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{c.subtitle}</div>
            </button>
          );
        })}
      </div>

      {/* Recent */}
      {recent.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Recent videos</div>
          <div className="flex flex-wrap gap-2">
            {recent.slice(0, 6).map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveVideo(v)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:border-primary/50"
              >
                {v.title}{v.has_voiceover ? " 🔊" : ""}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
