/**
 * Portfolio — the new primary surface.
 * Sections rendered from the Evidence Vault + Memory.
 * Pure read; no AI calls; no jargon.
 */
import { Link } from "react-router-dom";
import { useStateStore } from "@/stores/state-store";
import { buildEvidenceVault } from "@/lib/portfolio/build-evidence-vault";
import { buildMomentMemory } from "@/lib/memory/build-moment-memory";
import { selectReviewSuggestions } from "@/lib/decisions/select-review-suggestion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, BookOpenText, AlertCircle, Sparkles, Hammer, Heart, TrendingUp, Lightbulb } from "lucide-react";

function fmtAgo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function Portfolio() {
  const state = useStateStore((s) => s.state);
  const vault = buildEvidenceVault(state);
  const memory = buildMomentMemory(state);
  const reviewSuggestions = selectReviewSuggestions(state);

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Hero */}
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Portfolio</p>
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">Your evidence is growing.</h1>
        <p className="text-sm text-muted-foreground">{vault.summary.headline}</p>
      </header>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Proof this week" value={vault.summary.proof_this_week} />
        <StatCard icon={<BookOpenText className="h-4 w-4" />} label="Memories saved" value={vault.summary.memories_saved} />
        <StatCard icon={<Hammer className="h-4 w-4" />} label="Artifacts" value={vault.summary.artifacts_created} />
        <StatCard icon={<Heart className="h-4 w-4" />} label="Recoveries" value={vault.summary.recoveries} />
      </div>

      {/* This week's proof */}
      <Section title="This week's proof" icon={<CheckCircle2 className="h-4 w-4" />} empty={vault.this_week_proof.length === 0} emptyHint="Finish one thing and it lands here.">
        <ul className="space-y-2">
          {vault.this_week_proof.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{p.title}</div>
                {p.proof_of_completion && <div className="mt-0.5 truncate text-xs text-muted-foreground">{p.proof_of_completion}</div>}
              </div>
              <div className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">{fmtAgo(p.completed_at)}</div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Learning memories */}
      <Section title="Learning memories" icon={<BookOpenText className="h-4 w-4" />} empty={vault.learning_memories.length === 0} emptyHint="Save a note review on a task — it becomes a memory.">
        <ul className="space-y-2">
          {vault.learning_memories.slice(0, 5).map((m) => (
            <li key={m.id} className="rounded-lg border border-border/60 bg-card/40 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-sm font-medium">{m.title}</div>
                <div className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">{fmtAgo(m.created_at)}</div>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{m.key_lesson}</p>
              {m.confusion_gap && <p className="mt-1 text-[11px] italic text-amber-600 dark:text-amber-400">Gap: {m.confusion_gap}</p>}
            </li>
          ))}
        </ul>
      </Section>

      {/* Review soon */}
      <Section title="Review soon" icon={<Sparkles className="h-4 w-4" />} empty={reviewSuggestions.length === 0} emptyHint="When you save lessons, they show up here for spaced review.">
        <ul className="space-y-2">
          {reviewSuggestions.map((r, idx) => (
            <li key={`${r.source}_${idx}`} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{r.title}</div>
                <p className="line-clamp-1 text-xs text-muted-foreground">{r.hint}</p>
              </div>
              {typeof r.days_since === "number" && <Badge variant="outline" className="shrink-0 text-[10px]">{r.days_since}d</Badge>}
            </li>
          ))}
        </ul>
      </Section>

      {/* Skills forming */}
      <Section title="Skills forming" icon={<TrendingUp className="h-4 w-4" />} empty={vault.skills_forming.length === 0} emptyHint="Skills appear as your goal model develops.">
        <div className="flex flex-wrap gap-2">
          {vault.skills_forming.map((s) => (
            <Badge key={s.name} variant="secondary" className="text-xs">{s.name} · {s.status}</Badge>
          ))}
        </div>
      </Section>

      {/* Open loops */}
      <Section title="Open loops" icon={<AlertCircle className="h-4 w-4" />} empty={vault.open_loops.length === 0} emptyHint="No stuck high-priority tasks. Nice.">
        <ul className="space-y-2">
          {vault.open_loops.map((l) => (
            <li key={l.task_id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-sm">
              <span className="truncate">{l.title}</span>
              <Badge variant="outline" className="text-[10px]">{l.days_open}d open</Badge>
            </li>
          ))}
        </ul>
      </Section>

      {/* Patterns noticed */}
      <Section title="Patterns noticed" icon={<Lightbulb className="h-4 w-4" />} empty={memory.current_patterns.length === 0} emptyHint="Patterns appear once enough signals are in.">
        <ul className="space-y-2">
          {memory.current_patterns.map((p) => (
            <li key={p.id} className="rounded-lg border border-border/60 bg-card/40 px-3 py-2">
              <p className="text-sm">{p.message}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">→ {p.suggested_adjustment}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Artifacts */}
      <Section title="Artifacts created" icon={<Hammer className="h-4 w-4" />} empty={vault.artifacts.length === 0} emptyHint="Build one in Forge to turn portfolio gaps into practice.">
        <ul className="space-y-2">
          {vault.artifacts.slice(0, 5).map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-sm">
              <span className="truncate">{a.feature}</span>
              <Link to="/app/forge" className="text-xs text-primary hover:underline">open</Link>
            </li>
          ))}
        </ul>
        <div className="mt-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/app/forge">Open Forge</Link>
          </Button>
        </div>
      </Section>

      {/* Recovery moments */}
      <Section title="Recovery moments" icon={<Heart className="h-4 w-4" />} empty={vault.recovery_moments.length === 0} emptyHint="No rescues recently. Steady.">
        <ul className="space-y-2">
          {vault.recovery_moments.slice(0, 5).map((r) => (
            <li key={r.id} className="rounded-lg border border-border/60 bg-card/40 px-3 py-2">
              <div className="text-sm font-medium">{r.title}</div>
              <p className="mt-1 text-xs text-muted-foreground">{r.reframe}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex flex-col gap-1 p-3">
        <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[10px] uppercase tracking-wider">{label}</span></div>
        <div className="font-display text-2xl tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function Section({
  title, icon, children, empty, emptyHint,
}: { title: string; icon: React.ReactNode; children: React.ReactNode; empty: boolean; emptyHint: string }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? <p className="text-xs text-muted-foreground">{emptyHint}</p> : children}
      </CardContent>
    </Card>
  );
}
