import { useState } from "react";
import { Hammer, Sparkles, Check, Loader2 } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { getForgeViewModel } from "@/lib/selectors/forge";
import { useAI } from "@/lib/ai/useAI";
import { AIInsight } from "@/components/app/AIInsight";

const Forge = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const ai = useAI<{ modules: Array<{ name: string; description: string; module_type: string; why?: string }> }>("forge_modules");

  if (!state) return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;
  const vm = getForgeViewModel(state)!;

  const setDraft = (key: string, val: string) => setDrafts((d) => ({ ...d, [key]: val }));
  const commitAnswer = (key: string, text: string) => {
    const a = vm.answers.find((x) => x.question_key === key);
    dispatch({ type: "forge/answer", payload: { question_key: key, question_text: a?.question_text ?? key, answer_text: drafts[key] ?? text } });
  };

  const allAnswered = vm.answers.length > 0 && vm.answers.every((a) => (drafts[a.question_key] ?? a.answer_text).trim() !== "");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">/ forge</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Build your own system</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Forge picks the features you actually need, based on what you're chasing.
        </p>
      </div>

      {vm.status === "idle" && (
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
              onClick={async () => {
                const answers = vm.answers.map(a => ({ q: a.question_text, a: drafts[a.question_key] ?? a.answer_text }));
                await ai.run({ answers });
                dispatch({ type: "forge/generate_candidates" });
              }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 inline-flex items-center gap-2"
            >
              {ai.loading && <Loader2 className="h-3 w-3 animate-spin" />}
              Generate features
            </button>
          </div>
          {ai.result?.modules?.length ? (
            <AIInsight label="ai-shaped suggestions">
              <ul className="space-y-1.5 text-sm">
                {ai.result.modules.map((m, i) => (
                  <li key={i}>
                    <span className="font-medium">{m.name}</span>
                    <span className="text-muted-foreground"> · {m.description}</span>
                    {m.why && <div className="text-xs text-muted-foreground">{m.why}</div>}
                  </li>
                ))}
              </ul>
            </AIInsight>
          ) : null}
        </section>
      )}

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
                      score {c.total_score}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Solves: {c.problem_it_solves}</p>
                </div>
              </button>
            );
          })}

          <div className="flex justify-between">
            <button
              onClick={() => dispatch({ type: "forge/reset" })}
              className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Start over
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

      {vm.status === "instantiated" && vm.modules.length > 0 && (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-400">active modules</div>
          <ul className="mt-3 space-y-2">
            {vm.modules.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
                <div>
                  <div className="font-medium">{m.title}</div>
                  <div className="text-xs text-muted-foreground">{m.description}</div>
                </div>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                  {m.module_type.replace("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default Forge;
