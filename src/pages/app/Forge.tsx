import { useState } from "react";
import { Hammer, Sparkles, Check, Loader2, Plus, Archive, Trash2, Pencil, Play } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { getForgeViewModel } from "@/lib/selectors/forge";
import { useAI } from "@/lib/ai/useAI";
import { AIInsight } from "@/components/app/AIInsight";
import type { FeatureCandidate, GeneratedModuleManifest, ModuleEntry } from "@/lib/types";

type AIModule = {
  name: string;
  description: string;
  module_type: string;
  why?: string;
  config?: any;
};

const Forge = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const ai = useAI<{ modules: AIModule[] }>("forge_modules");

  if (!state) return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;
  const vm = getForgeViewModel(state)!;
  const activeModules = vm.modules.filter((m) => m.status === "active");

  const setDraft = (key: string, val: string) => setDrafts((d) => ({ ...d, [key]: val }));
  const commitAnswer = (key: string, text: string) => {
    const a = vm.answers.find((x) => x.question_key === key);
    dispatch({
      type: "forge/answer",
      payload: { question_key: key, question_text: a?.question_text ?? key, answer_text: drafts[key] ?? text },
    });
  };

  const allAnswered = vm.answers.length > 0 && vm.answers.every((a) => (drafts[a.question_key] ?? a.answer_text).trim() !== "");

  async function runAI() {
    const answers = vm.answers.map((a) => ({ q: a.question_text, a: drafts[a.question_key] ?? a.answer_text }));
    const result = await ai.run({ answers });
    if (result?.modules?.length) {
      const candidates: FeatureCandidate[] = result.modules.map((m, i) => ({
        id: `ai_${Date.now()}_${i}`,
        name: m.name,
        description: m.description,
        problem_it_solves: m.why ?? "",
        leverage_score: 8, immediacy_score: 8, repeat_value_score: 8,
        complexity_score: 5, distinctiveness_score: 8,
        total_score: 37,
        rationale: m.why ?? "",
        module_type: m.module_type,
        config: m.config,
        why: m.why,
      }));
      dispatch({ type: "forge/set_ai_candidates", payload: { candidates } });
    } else {
      dispatch({ type: "forge/generate_candidates" });
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">/ forge</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Build your own system</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Forge proposes the most valuable features for your goal, vibe-codes them into
          live execution containers, and lets you edit them at any time.
        </p>
      </div>

      {/* ACTIVE MODULES — execution containers */}
      {activeModules.length > 0 && (
        <section className="space-y-3">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-400">
            active modules · {activeModules.length}
          </div>
          {activeModules.map((m) => (
            <ModuleContainer key={m.id} module={m} />
          ))}
        </section>
      )}

      {/* IDLE → start interview */}
      {vm.status === "idle" && activeModules.length === 0 && (
        <section className="rounded-2xl border border-border bg-card p-6 text-center">
          <Hammer className="mx-auto h-6 w-6 text-primary" />
          <h2 className="mt-3 text-lg font-semibold">Start the interview</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            5 quick questions. Then Forge proposes 3 features tailored to you.
          </p>
          <button
            onClick={() => dispatch({ type: "forge/start_interview" })}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Begin
          </button>
        </section>
      )}

      {vm.status === "idle" && activeModules.length > 0 && (
        <button
          onClick={() => dispatch({ type: "forge/start_interview" })}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:border-primary/40"
        >
          <Plus className="h-4 w-4" /> Forge another feature
        </button>
      )}

      {/* INTERVIEW */}
      {vm.status === "interviewing" && (
        <section className="space-y-3">
          {vm.answers.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="text-sm font-medium">{a.question_text}</div>
              <textarea
                value={drafts[a.question_key] ?? a.answer_text}
                onChange={(e) => setDraft(a.question_key, e.target.value)}
                onBlur={(e) => commitAnswer(a.question_key, e.target.value)}
                rows={2}
                placeholder="Type freely…"
                className="mt-2 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <button
              disabled={!allAnswered || ai.loading}
              onClick={runAI}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 inline-flex items-center gap-2"
            >
              {ai.loading && <Loader2 className="h-3 w-3 animate-spin" />}
              Generate features
            </button>
          </div>
          {ai.error && <div className="text-xs text-destructive">{ai.error}</div>}
        </section>
      )}

      {/* RANKING / SELECTION */}
      {(vm.status === "ranking" || vm.status === "instantiated") && vm.candidates.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-3 w-3" /> proposed features
          </div>
          {vm.candidates.map((c) => {
            const selected = vm.selected_features.some((f) => f.id === c.id);
            return (
              <button
                key={c.id}
                onClick={() => dispatch({ type: "forge/toggle_feature", payload: { id: c.id } })}
                className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                  selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                  selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}>
                  {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                      {c.module_type.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                  {c.why && <p className="mt-1 text-xs text-primary/80">{c.why}</p>}
                </div>
              </button>
            );
          })}

          <div className="flex justify-between">
            <button
              onClick={() => dispatch({ type: "forge/reset" })}
              className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Discard suggestions
            </button>
            <button
              onClick={() => dispatch({ type: "forge/instantiate" })}
              disabled={vm.selected_features.length === 0}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Build {vm.selected_features.length} feature{vm.selected_features.length === 1 ? "" : "s"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

/* ---------------- Execution Container ---------------- */

function ModuleContainer({ module: m }: { module: GeneratedModuleManifest }) {
  const dispatch = useStateStore((s) => s.dispatch);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(m.title);
  const [desc, setDesc] = useState(m.description);

  const saveEdit = () => {
    dispatch({ type: "forge/update_module", payload: { id: m.id, changes: { title, description: desc } } });
    setEditing(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4">
        <button onClick={() => setOpen((o) => !o)} className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{m.title}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
              {m.module_type.replace("_", " ")}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing((e) => !e)} className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => dispatch({ type: "forge/archive_module", payload: { id: m.id } })}
            className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Archive"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { if (confirm("Delete this module?")) dispatch({ type: "forge/delete_module", payload: { id: m.id } }); }}
            className="p-1.5 text-muted-foreground hover:text-destructive" aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {editing && (
        <div className="border-t border-border bg-background/50 p-4 space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground">Cancel</button>
            <button onClick={saveEdit} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Save</button>
          </div>
        </div>
      )}

      {open && (
        <div className="border-t border-border p-4">
          <ExecutionContainer module={m} />
        </div>
      )}
    </div>
  );
}

function ExecutionContainer({ module: m }: { module: GeneratedModuleManifest }) {
  const dispatch = useStateStore((s) => s.dispatch);
  const cfg: any = m.config ?? {};
  const entries = m.entries ?? [];
  const [data, setData] = useState<Record<string, string>>({});

  const logEntry = (payload: Record<string, unknown>, note?: string) => {
    const entry: ModuleEntry = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      data: payload,
      note,
    };
    dispatch({ type: "forge/log_entry", payload: { module_id: m.id, entry } });
    setData({});
  };

  // TRACKER / EVIDENCE_LOG → field-based logger
  if ((m.module_type === "tracker" || m.module_type === "evidence_log") && cfg.fields) {
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          {cfg.fields.map((f: any) => (
            <div key={f.key}>
              <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{f.label}</label>
              <input
                type={f.kind === "number" || f.kind === "rating" ? "number" : "text"}
                value={data[f.key] ?? ""}
                onChange={(e) => setData((d) => ({ ...d, [f.key]: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          ))}
          <button
            onClick={() => logEntry(data)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <Plus className="h-3 w-3" /> Log entry
          </button>
        </div>
        {entries.length > 0 && (
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">recent · {entries.length}</div>
            <ul className="mt-2 space-y-1.5">
              {entries.slice(-5).reverse().map((e) => (
                <li key={e.id} className="rounded-md border border-border bg-background/50 px-3 py-2 text-xs">
                  <div className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
                  <div>{Object.entries(e.data).map(([k, v]) => `${k}: ${v}`).join(" · ")}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // RESCUE PROTOCOL → checkable steps
  if (m.module_type === "rescue_protocol" && cfg.steps) {
    return (
      <div className="space-y-3">
        <ol className="space-y-2">
          {cfg.steps.map((s: string, i: number) => (
            <li key={i} className="flex gap-3 rounded-md border border-border bg-background/50 px-3 py-2 text-sm">
              <span className="text-xs text-muted-foreground">{i + 1}.</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <button
          onClick={() => logEntry({ ran: true })}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          <Play className="h-3 w-3" /> Mark run · {entries.length}
        </button>
      </div>
    );
  }

  // PRACTICE SYSTEM → drills
  if (m.module_type === "practice_system" && cfg.drills) {
    return (
      <div className="space-y-3">
        <ul className="space-y-2">
          {cfg.drills.map((d: any, i: number) => (
            <li key={i} className="flex items-center justify-between rounded-md border border-border bg-background/50 px-3 py-2 text-sm">
              <span>{d.name}</span>
              <span className="text-xs text-muted-foreground">{d.minutes}m</span>
            </li>
          ))}
        </ul>
        <button
          onClick={() => logEntry({ session: true, total_minutes: cfg.drills.reduce((a: number, d: any) => a + d.minutes, 0) })}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          <Play className="h-3 w-3" /> Log session · {entries.length}
        </button>
      </div>
    );
  }

  // PLANNER → slots
  if (m.module_type === "planner" && cfg.slots) {
    return (
      <ul className="space-y-2">
        {cfg.slots.map((s: any, i: number) => (
          <li key={i} className="flex items-center justify-between rounded-md border border-border bg-background/50 px-3 py-2 text-sm">
            <span>{s.label}</span>
            <span className="text-xs text-muted-foreground">{s.cadence}</span>
          </li>
        ))}
      </ul>
    );
  }

  return <div className="text-xs text-muted-foreground">{cfg.notes || "No runtime configured."}</div>;
}

export default Forge;
