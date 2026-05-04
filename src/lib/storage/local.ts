import type { MomentState } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";

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

/**
 * Cloud sync — best-effort, never blocks the UI.
 * The local copy is always authoritative on read; we hydrate from cloud on
 * boot only if no local copy exists, then mirror writes back asynchronously.
 */
async function pullFromCloud(deviceId: string): Promise<MomentState | null> {
  try {
    const { data, error } = await supabase
      .from("moment_state")
      .select("state")
      .eq("device_id", deviceId)
      .maybeSingle();
    if (error) {
      console.warn("[moment.cloud] pull error", error);
      return null;
    }
    return (data?.state as MomentState) ?? null;
  } catch (e) {
    console.warn("[moment.cloud] pull exception", e);
    return null;
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
function pushToCloud(deviceId: string, state: MomentState) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      const { error } = await supabase
        .from("moment_state")
        .upsert({ device_id: deviceId, state: state as any }, { onConflict: "device_id" });
      if (error) console.warn("[moment.cloud] push error", error);
    } catch (e) {
      console.warn("[moment.cloud] push exception", e);
    }
  }, 800);
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
  async getState(userId: string): Promise<MomentState | null> {
    const local = safeRead<MomentState>(KEY);
    if (local) return local;
    // No local copy — try cloud once.
    const cloud = await pullFromCloud(userId);
    if (cloud) safeWrite(KEY, cloud);
    return cloud;
  },
  saveState(userId: string, state: MomentState): Promise<void> {
    safeWrite(KEY, state);
    pushToCloud(userId, state);
    return Promise.resolve();
  },
};
