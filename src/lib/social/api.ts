import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProgressEventRow = Database["public"]["Tables"]["progress_events"]["Row"];
export type FollowRow = Database["public"]["Tables"]["follows"]["Row"];
export type ReactionRow = Database["public"]["Tables"]["reactions"]["Row"];
export type EventKind = Database["public"]["Enums"]["event_kind"];
export type Visibility = Database["public"]["Enums"]["visibility_level"];

export type FeedItem = ProgressEventRow & { author: Pick<Profile, "id" | "display_name" | "handle" | "main_goal"> | null };

export async function fetchFriendsFeed(uid: string, limit = 50): Promise<FeedItem[]> {
  // accepted follows where I am follower
  const { data: follows } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", uid)
    .eq("status", "accepted");
  const ids = [uid, ...((follows ?? []).map((f) => f.followee_id))];
  const { data, error } = await supabase
    .from("progress_events")
    .select("*, author:profiles!progress_events_user_id_fkey(id,display_name,handle,main_goal)")
    .in("user_id", ids)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as FeedItem[];
}

export async function fetchAlignedFeed(limit = 50): Promise<FeedItem[]> {
  // RLS handles the filter (visibility=aligned + shared tags + opt-in).
  const { data, error } = await supabase
    .from("progress_events")
    .select("*, author:profiles!progress_events_user_id_fkey(id,display_name,handle,main_goal)")
    .eq("visibility", "aligned")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as FeedItem[];
}

export async function fetchAlignedPeople(uid: string, limit = 6): Promise<Profile[]> {
  const { data: me } = await supabase.from("profiles").select("goal_tags,subject_tags").eq("id", uid).maybeSingle();
  const tags = [...(me?.goal_tags ?? []), ...(me?.subject_tags ?? [])];
  if (tags.length === 0) {
    const { data } = await supabase.from("profiles").select("*").neq("id", uid).limit(limit);
    return (data ?? []) as Profile[];
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .neq("id", uid)
    .or(`goal_tags.ov.{${tags.join(",")}},subject_tags.ov.{${tags.join(",")}}`)
    .limit(limit);
  if (error) return [];
  return (data ?? []) as Profile[];
}

export async function followUser(uid: string, target: string) {
  return supabase.from("follows").insert({ follower_id: uid, followee_id: target, status: "pending" });
}

export async function acceptFollow(uid: string, follower: string) {
  return supabase
    .from("follows")
    .update({ status: "accepted" })
    .eq("follower_id", follower)
    .eq("followee_id", uid);
}

export async function unfollow(uid: string, target: string) {
  return supabase.from("follows").delete().eq("follower_id", uid).eq("followee_id", target);
}

export async function fetchMyFollowsMap(uid: string): Promise<Record<string, "pending" | "accepted">> {
  const { data } = await supabase
    .from("follows")
    .select("followee_id,status")
    .eq("follower_id", uid);
  const map: Record<string, "pending" | "accepted"> = {};
  (data ?? []).forEach((r) => (map[r.followee_id] = r.status as any));
  return map;
}

export async function insertProgressEvent(row: {
  user_id: string;
  kind: EventKind;
  title: string;
  context?: string | null;
  goal_tags?: string[];
  subject_tags?: string[];
  visibility?: Visibility;
  source_key?: string | null;
}) {
  return supabase.from("progress_events").upsert(
    {
      ...row,
      goal_tags: row.goal_tags ?? [],
      subject_tags: row.subject_tags ?? [],
      visibility: row.visibility ?? "friends",
    },
    { onConflict: "user_id,kind,source_key", ignoreDuplicates: true },
  );
}

export async function toggleReaction(uid: string, eventId: string, kind: string) {
  const { data } = await supabase
    .from("reactions")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", uid)
    .eq("kind", kind)
    .maybeSingle();
  if (data?.id) {
    await supabase.from("reactions").delete().eq("id", data.id);
    return false;
  }
  await supabase.from("reactions").insert({ event_id: eventId, user_id: uid, kind });
  return true;
}

export async function fetchReactionsForEvents(ids: string[]): Promise<Record<string, ReactionRow[]>> {
  if (ids.length === 0) return {};
  const { data } = await supabase.from("reactions").select("*").in("event_id", ids);
  const map: Record<string, ReactionRow[]> = {};
  (data ?? []).forEach((r) => {
    (map[r.event_id] = map[r.event_id] ?? []).push(r);
  });
  return map;
}
