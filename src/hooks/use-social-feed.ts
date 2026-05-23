import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAlignedFeed, fetchFriendsFeed, type FeedItem } from "@/lib/social/api";

export function useSocialFeed(uid: string | null, tab: "friends" | "aligned") {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = tab === "friends" ? await fetchFriendsFeed(uid) : await fetchAlignedFeed();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [uid, tab]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`feed-${tab}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "progress_events" }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid, tab, refresh]);

  return { items, loading, refresh };
}
