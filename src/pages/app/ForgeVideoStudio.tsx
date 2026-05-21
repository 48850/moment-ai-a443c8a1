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
  { format: "pov", title: "Today's episode about you", subtitle: "Two hosts react to your day — live", icon: Film, bg: "from-fuchsia-500/20 to-purple-700/10" },
  { format: "roast", title: "Roast my calendar", subtitle: "We roast the avoidance, never you", icon: Flame, bg: "from-orange-500/25 to-red-700/10" },
  { format: "trailer", title: "Cinematic goal trailer", subtitle: "Movie-trailer cold open about your goal", icon: Stars, bg: "from-amber-400/20 to-yellow-700/10" },
  { format: "mission_briefing", title: "Mission briefing", subtitle: "Mission control hypes your next block", icon: Target, bg: "from-emerald-500/20 to-teal-700/10" },
  { format: "recap", title: "Weekly recap show", subtitle: "Hosts review the week, name the play", icon: Award, bg: "from-sky-500/20 to-indigo-700/10" },
  { format: "mockumentary", title: "Mockumentary clip", subtitle: "Affectionate, observational, never mean", icon: History, bg: "from-slate-500/20 to-zinc-700/10" },
];

export default function ForgeVideoStudio() {
  const state = useStateStore((s) => s.state);
  const applyPatch = useStateStore((s) => s.applyPatch);
  const navigate = useNavigate();
  const [generating, setGenerating] = useState<Format | null>(null);
  const [activeVideo, setActiveVideo] = useState<any | null>(null);
  const recent: any[] = state?.forge_state?.forge_videos ?? [];

  async function generate(format: Format) {
    if (!state) return;
    setGenerating(format);
    setActiveVideo(null);
    try {
      const snapshot = buildContextPacket(state);
      const { data, error } = await supabase.functions.invoke("forge-context-video", {
        body: { snapshot, format, with_voiceover: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const video = data?.result;
      if (!video) throw new Error("Empty response");
      setActiveVideo(video);
      const list = [video, ...(state.forge_state?.forge_videos ?? [])].slice(0, 10);
      applyPatch({ forge_state: { ...(state.forge_state as any), forge_videos: list } });
    } catch (e) {
      console.error(e);
      toast({ title: "Couldn't generate clip", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setGenerating(null);
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
    <div className="mx-auto max-w-3xl p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/app/forge" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Forge
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Mic2 className="h-3.5 w-3.5" /> Context Reels
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your day, as a podcast clip.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Two AI hosts read your real goal, your real tasks, and your real avoidance, then hype you straight into the next move. Voiceover, no slides.
        </p>
      </div>

      {/* Active video */}
      {activeVideo && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Now playing</div>
            <Button size="sm" variant="ghost" onClick={() => setActiveVideo(null)}>Close</Button>
          </div>
          <div className="text-xl font-semibold">{activeVideo.title}</div>
          <StoryboardPlayer video={activeVideo} onCta={handleCta} />
        </div>
      )}

      {/* Loading state */}
      {generating && !activeVideo && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <div className="text-sm text-muted-foreground">Recording your episode… (writing script, then voicing both hosts)</div>
          <div className="text-xs text-muted-foreground/70">~15–25 seconds</div>
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
