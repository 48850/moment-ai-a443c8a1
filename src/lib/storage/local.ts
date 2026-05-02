import type { MomentState } from "@/lib/types";

const KEY = "moment.state.v1";
const SESSION_KEY = "moment.session.v1";

interface Session { userId: string; displayName: string; }

function safeRead<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / disabled — ignore */
  }
}

export const storage = {
  getSession(): Session | null {
    return safeRead<Session>(SESSION_KEY);
  },
  setSession(userId: string, displayName: string) {
    safeWrite(SESSION_KEY, { userId, displayName });
  },
  clearSession() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(KEY);
  },
  getState(_userId: string): Promise<MomentState | null> {
    return Promise.resolve(safeRead<MomentState>(KEY));
  },
  saveState(_userId: string, state: MomentState): Promise<void> {
    safeWrite(KEY, state);
    return Promise.resolve();
  },
};
