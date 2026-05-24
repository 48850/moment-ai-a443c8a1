import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MomentStar } from "@/components/app/Mote";
import { useAuth } from "@/hooks/use-auth";

export default function Auth() {
  const { uid, loading } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign_in" | "sign_up">(params.get("mode") === "sign_up" ? "sign_up" : "sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && uid) navigate(params.get("next") || "/app/social", { replace: true });
  }, [uid, loading, navigate, params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "sign_up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app/social`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        setInfo("Check your email to confirm your account, then sign in.");
        setMode("sign_in");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      setErr(e.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-4 py-16 text-foreground">
      <div className="mx-auto w-full max-w-sm rounded-3xl border border-white/10 bg-card/70 p-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <MomentStar size={48} mood="focused" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">moment</p>
            <h1 className="text-xl font-semibold">{mode === "sign_up" ? "Create your account" : "Welcome back"}</h1>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
          {mode === "sign_up" && (
            <input
              type="text"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
            />
          )}
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Password (8+ chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
          />
          {err && <p className="text-xs text-rose-300">{err}</p>}
          {info && <p className="text-xs text-emerald-300">{info}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-1 rounded-full bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-200 disabled:opacity-60"
          >
            {busy ? "…" : mode === "sign_up" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "sign_up" ? "sign_in" : "sign_up")}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "sign_up" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
