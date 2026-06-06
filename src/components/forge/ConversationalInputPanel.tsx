/**
 * ConversationalInputPanel — replaces the boring stacked-form input_panel
 * with a one-question-at-a-time card flow. Big prompt, big field, progress
 * dots, keyboard-driven (Enter to advance, Shift+Enter newline), animated
 * card transitions, and a final "all set" review state.
 */
import { useMemo, useState, useEffect, useRef } from "react";
import { ArrowRight, ArrowLeft, Check, SkipForward, Pencil } from "lucide-react";
import type { GuidebookInput } from "@/lib/types";

interface Props {
  inputs: GuidebookInput[];
  values: Record<string, string>;
  onChange: (id: string, val: string) => void;
}

export function ConversationalInputPanel({ inputs, values, onChange }: Props) {
  const [index, setIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [dir, setDir] = useState<1 | -1>(1);
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement | null>(null);

  const total = inputs.length;
  const current = inputs[index];
  const value = current ? values[current.id] ?? "" : "";

  const answeredCount = useMemo(
    () => inputs.filter((i) => (values[i.id] ?? "").trim().length > 0).length,
    [inputs, values],
  );

  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [index, reviewing]);

  if (total === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">No inputs required for this feature.</p>
    );
  }

  const canAdvance = !current?.required || value.trim().length > 0;

  function next() {
    if (!canAdvance) return;
    setDir(1);
    if (index < total - 1) setIndex(index + 1);
    else setReviewing(true);
  }
  function prev() {
    setDir(-1);
    if (reviewing) {
      setReviewing(false);
      setIndex(total - 1);
    } else if (index > 0) {
      setIndex(index - 1);
    }
  }
  function skip() {
    if (current?.required) return;
    setDir(1);
    if (index < total - 1) setIndex(index + 1);
    else setReviewing(true);
  }
  function jumpTo(i: number) {
    setDir(i > index ? 1 : -1);
    setReviewing(false);
    setIndex(i);
  }

  // ── REVIEW STATE ────────────────────────────────────────────────────────────
  if (reviewing) {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-emerald-400">
          <Check className="h-3.5 w-3.5" /> Ready · {answeredCount}/{total} answered
        </div>
        <div className="space-y-2">
          {inputs.map((inp, i) => {
            const v = (values[inp.id] ?? "").trim();
            return (
              <button
                key={inp.id}
                onClick={() => jumpTo(i)}
                className="group flex w-full items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:border-primary/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    {inp.label}{inp.required && !v && <span className="ml-1 text-destructive">required</span>}
                  </div>
                  <div className={`mt-0.5 truncate text-sm ${v ? "text-foreground" : "italic text-muted-foreground/60"}`}>
                    {v || "— skipped —"}
                  </div>
                </div>
                <Pencil className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/60 group-hover:text-foreground" />
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Tap any answer to edit. Then run a mode below.
        </p>
      </div>
    );
  }

  // ── QUESTION CARD ───────────────────────────────────────────────────────────
  const enterClass = dir === 1 ? "slide-in-from-right-4" : "slide-in-from-left-4";

  return (
    <div className="space-y-5">
      {/* Progress dots */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {inputs.map((_, i) => (
            <button
              key={i}
              onClick={() => jumpTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? "w-6 bg-primary"
                  : i < index || (values[inputs[i].id] ?? "").trim()
                  ? "w-1.5 bg-primary/60"
                  : "w-1.5 bg-border"
              }`}
              aria-label={`Question ${i + 1}`}
            />
          ))}
        </div>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {index + 1} / {total}
        </span>
      </div>

      <div
        key={`${index}-${current.id}`}
        className={`animate-in fade-in ${enterClass} duration-300`}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-mono text-primary/70">Q{index + 1}.</span>
          <h4 className="text-lg font-semibold leading-snug text-foreground text-balance">
            {current.label}
            {current.required && <span className="ml-1 text-destructive">*</span>}
          </h4>
        </div>
        {current.placeholder && (
          <p className="mt-1 text-xs text-muted-foreground">{current.placeholder}</p>
        )}

        <div className="mt-4">
          <FieldRenderer
            input={current}
            value={value}
            onChange={(v) => onChange(current.id, v)}
            onEnter={next}
            inputRef={ref as any}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          onClick={prev}
          disabled={index === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="flex items-center gap-2">
          {!current.required && (
            <button
              onClick={skip}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <SkipForward className="h-3.5 w-3.5" /> Skip
            </button>
          )}
          <button
            onClick={next}
            disabled={!canAdvance}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {index === total - 1 ? "Review" : "Next"} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="text-center text-[10px] text-muted-foreground/70">
        Press <kbd className="rounded border border-border bg-muted/40 px-1">Enter</kbd> to continue ·{" "}
        <kbd className="rounded border border-border bg-muted/40 px-1">Shift+Enter</kbd> for newline
      </p>
    </div>
  );
}

// ── Field renderer (large, immersive) ────────────────────────────────────────

function FieldRenderer({
  input,
  value,
  onChange,
  onEnter,
  inputRef,
}: {
  input: GuidebookInput;
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  inputRef: React.MutableRefObject<any>;
}) {
  const base =
    "w-full rounded-2xl border border-border bg-muted/30 px-4 py-4 text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:bg-muted/50 transition-colors";

  if (input.type === "textarea") {
    return (
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={input.placeholder ?? "Type your answer…"}
        rows={4}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onEnter();
          }
        }}
        className={`${base} resize-none min-h-[120px]`}
      />
    );
  }

  if (input.type === "select" && input.options) {
    return (
      <div className="flex flex-wrap gap-2">
        {input.options.map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              onClick={() => {
                onChange(opt);
                setTimeout(onEnter, 150);
              }}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  if (input.type === "scale") {
    const max = 10;
    const parsed = parseInt(value) || 0;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
            const active = parsed === n;
            return (
              <button
                key={n}
                onClick={() => onChange(String(n))}
                className={`h-11 w-11 rounded-xl border text-sm font-medium transition-all ${
                  active
                    ? "border-primary bg-primary text-primary-foreground scale-110"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          <span>Low</span><span>High</span>
        </div>
      </div>
    );
  }

  if (input.type === "number" || input.type === "date") {
    return (
      <input
        ref={inputRef}
        type={input.type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={input.placeholder}
        onKeyDown={(e) => { if (e.key === "Enter") onEnter(); }}
        className={base}
      />
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={input.placeholder ?? "Type your answer…"}
      onKeyDown={(e) => { if (e.key === "Enter") onEnter(); }}
      className={base}
    />
  );
}
