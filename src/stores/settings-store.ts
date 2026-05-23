import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Visibility = "private" | "friends" | "aligned";
export type DeviceMode = "auto" | "phone" | "computer";
export type CommentsMode = "off" | "friends";
export type ReactionKind = "nice" | "still_moving" | "good_reset" | "big_brain" | "review_saved" | "keep_going";

export interface ProfileSettings {
  display_name: string;
  username: string;
  bio: string;
  main_goal: string;
  school_stage: string;
  subjects: string[];
  star_hue: number; // 0-360
}

export interface PrivacySettings {
  profile_visibility: Visibility;
  progress_visibility: Visibility;
  allow_friend_requests: boolean;
  aligned_goal_discovery: boolean;
  comments_mode: CommentsMode;
  show_demo_friends: boolean;
}

export interface NotificationSettings {
  task_reminders: boolean;
  friend_checkins: boolean;
  streak_reminders: boolean;
  weekly_recap: boolean;
  forge_review_reminders: boolean;
}

export interface SettingsState {
  profile: ProfileSettings;
  privacy: PrivacySettings;
  device: { mode: DeviceMode };
  notifications: NotificationSettings;
  reactions: Record<string, ReactionKind[]>;
}

interface SettingsActions {
  updateProfile: (patch: Partial<ProfileSettings>) => void;
  updatePrivacy: (patch: Partial<PrivacySettings>) => void;
  setDeviceMode: (mode: DeviceMode) => void;
  updateNotifications: (patch: Partial<NotificationSettings>) => void;
  toggleReaction: (eventId: string, kind: ReactionKind) => void;
}

const DEFAULTS: SettingsState = {
  profile: {
    display_name: "",
    username: "",
    bio: "",
    main_goal: "",
    school_stage: "",
    subjects: [],
    star_hue: 0,
  },
  privacy: {
    profile_visibility: "private",
    progress_visibility: "private",
    allow_friend_requests: true,
    aligned_goal_discovery: false,
    comments_mode: "off",
    show_demo_friends: true,
  },
  device: { mode: "auto" },
  notifications: {
    task_reminders: true,
    friend_checkins: true,
    streak_reminders: true,
    weekly_recap: true,
    forge_review_reminders: true,
  },
  reactions: {},
};

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function validateUsername(u: string): string | null {
  const v = u.trim().toLowerCase();
  if (!v) return null;
  if (!USERNAME_RE.test(v)) return "3–20 chars, lowercase letters, numbers, underscore";
  return null;
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      updateProfile: (patch) =>
        set((s) => ({ profile: { ...s.profile, ...patch } })),
      updatePrivacy: (patch) =>
        set((s) => ({ privacy: { ...s.privacy, ...patch } })),
      setDeviceMode: (mode) => set({ device: { mode } }),
      updateNotifications: (patch) =>
        set((s) => ({ notifications: { ...s.notifications, ...patch } })),
      toggleReaction: (eventId, kind) =>
        set((s) => {
          const current = s.reactions[eventId] ?? [];
          const next = current.includes(kind)
            ? current.filter((k) => k !== kind)
            : [...current, kind];
          const reactions = { ...s.reactions, [eventId]: next };
          // simple cap
          const keys = Object.keys(reactions);
          if (keys.length > 500) {
            const trimmed: Record<string, ReactionKind[]> = {};
            keys.slice(-400).forEach((k) => (trimmed[k] = reactions[k]));
            return { reactions: trimmed };
          }
          return { reactions };
        }),
    }),
    {
      name: "moment.settings.v1",
      version: 1,
      partialize: (s) => ({
        profile: s.profile,
        privacy: s.privacy,
        device: s.device,
        notifications: s.notifications,
        reactions: s.reactions,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          ...p,
          profile: { ...DEFAULTS.profile, ...(p.profile ?? {}) },
          privacy: { ...DEFAULTS.privacy, ...(p.privacy ?? {}) },
          device: { ...DEFAULTS.device, ...(p.device ?? {}) },
          notifications: { ...DEFAULTS.notifications, ...(p.notifications ?? {}) },
          reactions: p.reactions ?? {},
        } as SettingsState & SettingsActions;
      },
    },
  ),
);

export function resolveSurface(deviceMode: DeviceMode): "mobile" | "desktop" {
  if (deviceMode === "phone") return "mobile";
  if (deviceMode === "computer") return "desktop";
  if (typeof window === "undefined") return "desktop";
  return window.matchMedia?.("(max-width: 768px)").matches ? "mobile" : "desktop";
}
