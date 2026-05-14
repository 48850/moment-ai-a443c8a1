import { useEffect, useState, useCallback } from "react";
import { GitBranch, GitMerge, GitPullRequest, ExternalLink, RefreshCw, Settings2, AlertCircle, CheckCircle2 } from "lucide-react";

type CompareStatus = "identical" | "ahead" | "behind" | "diverged";
type PRState = "open" | "closed";

type PR = {
  number: number;
  title: string;
  html_url: string;
  state: PRState;
  merged_at: string | null;
  draft: boolean;
};

type Result = {
  status: CompareStatus;
  ahead_by: number;
  behind_by: number;
  base_sha: string;
  head_sha: string;
  prs: PR[];
  /** True if any PR with head=forgebranch->base=main is merged. */
  merged: boolean;
};

const LS_KEY = "moment.gh.repo";
const DEFAULT_BASE = "main";
const DEFAULT_HEAD = "forgebranch";

async function gh<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 160)}` : ""}`);
  }
  return res.json() as Promise<T>;
}

export function GitHubBranchStatus({
  defaultRepo = "",
  base = DEFAULT_BASE,
  head = DEFAULT_HEAD,
}: {
  defaultRepo?: string;
  base?: string;
  head?: string;
}) {
  const [repo, setRepo] = useState<string>(() => {
    if (typeof window === "undefined") return defaultRepo;
    return localStorage.getItem(LS_KEY) ?? defaultRepo;
  });
  const [editing, setEditing] = useState(!repo);
  const [draft, setDraft] = useState(repo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const load = useCallback(async () => {
    if (!repo) return;
    setLoading(true);
    setError(null);
    try {
      const [owner, name] = repo.split("/");
      if (!owner || !name) throw new Error("Repo must be in `owner/name` format.");
      const [cmp, prs] = await Promise.all([
        gh<{ status: CompareStatus; ahead_by: number; behind_by: number; base_commit: { sha: string }; merge_base_commit: { sha: string }; commits: Array<{ sha: string }> }>(
          `https://api.github.com/repos/${owner}/${name}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
        ),
        gh<PR[]>(
          `https://api.github.com/repos/${owner}/${name}/pulls?state=all&head=${owner}:${encodeURIComponent(head)}&base=${encodeURIComponent(base)}&per_page=10`,
        ),
      ]);
      const merged = prs.some((p) => p.merged_at);
      const headSha = cmp.commits.at(-1)?.sha ?? "";
      setResult({
        status: cmp.status,
        ahead_by: cmp.ahead_by,
        behind_by: cmp.behind_by,
        base_sha: cmp.base_commit.sha,
        head_sha: headSha,
        prs,
        merged,
      });
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [repo, base, head]);

  useEffect(() => {
    if (repo) void load();
  }, [repo, load]);

  const save = () => {
    const v = draft.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
    if (!v.includes("/")) {
      setError("Repo must be in `owner/name` format.");
      return;
    }
    localStorage.setItem(LS_KEY, v);
    setRepo(v);
    setEditing(false);
  };

  const openPR = result?.prs.find((p) => p.state === "open" && !p.merged_at);
  const mergedPR = result?.prs.find((p) => p.merged_at);
  const latestPR = openPR ?? mergedPR ?? result?.prs[0];

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span>
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{head}</code>
            <span className="mx-1 text-muted-foreground">→</span>
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{base}</code>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => void load()}
            disabled={!repo || loading}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={() => { setDraft(repo); setEditing((v) => !v); }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            <Settings2 className="h-3.5 w-3.5" /> {repo || "Set repo"}
          </button>
        </div>
      </div>

      {editing && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="owner/name"
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <button onClick={save} className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground hover:opacity-90">
            Save
          </button>
        </div>
      )}

      {!repo && !editing && (
        <p className="text-xs text-muted-foreground">Set a GitHub repo to check whether <code>{head}</code> has been merged into <code>{base}</code>.</p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            {result.merged || result.status === "behind" || result.status === "identical" ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>
                  {result.merged
                    ? <><b>Merged.</b> A PR from <code>{head}</code> into <code>{base}</code> has been merged.</>
                    : result.status === "identical"
                      ? <><b>In sync.</b> <code>{head}</code> and <code>{base}</code> point at the same commit.</>
                      : <><b>Already in <code>{base}</code>.</b> <code>{head}</code> is {result.behind_by} commit(s) behind and 0 ahead.</>}
                </span>
              </>
            ) : (
              <>
                <GitMerge className="h-4 w-4 text-amber-500" />
                <span>
                  <b>Not merged.</b> <code>{head}</code> is {result.ahead_by} ahead, {result.behind_by} behind <code>{base}</code>{" "}
                  ({result.status}).
                </span>
              </>
            )}
          </div>

          {latestPR ? (
            <a
              href={latestPR.html_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted"
            >
              <GitPullRequest className={`h-3.5 w-3.5 ${latestPR.merged_at ? "text-purple-500" : latestPR.state === "open" ? "text-emerald-500" : "text-muted-foreground"}`} />
              <span className="font-medium">#{latestPR.number}</span>
              <span className="truncate max-w-[28ch]">{latestPR.title}</span>
              <span className="text-muted-foreground">
                · {latestPR.merged_at ? "merged" : latestPR.draft ? "draft" : latestPR.state}
              </span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          ) : (
            repo && (
              <a
                href={`https://github.com/${repo}/compare/${base}...${head}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted"
              >
                <GitPullRequest className="h-3.5 w-3.5 text-muted-foreground" />
                No PR yet — open one
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            )
          )}

          {result.prs.length > 1 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">All PRs ({result.prs.length})</summary>
              <ul className="mt-1 space-y-1">
                {result.prs.map((p) => (
                  <li key={p.number}>
                    <a className="hover:underline" href={p.html_url} target="_blank" rel="noreferrer">
                      #{p.number} · {p.merged_at ? "merged" : p.state} · {p.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default GitHubBranchStatus;
