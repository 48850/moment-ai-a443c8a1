
-- 1. follows: enforce status='pending' on insert
DROP POLICY IF EXISTS "follows self insert" ON public.follows;
CREATE POLICY "follows self insert" ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id AND status = 'pending');

-- 2. comments: mirror progress_events visibility
DROP POLICY IF EXISTS "comments read with event" ON public.comments;
CREATE POLICY "comments read with event" ON public.comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.progress_events e
      WHERE e.id = comments.event_id
        AND (
          e.user_id = auth.uid()
          OR e.visibility = 'public'
          OR (e.visibility = 'friends' AND public.is_accepted_follower(auth.uid(), e.user_id))
          OR (e.visibility = 'aligned' AND public.viewer_aligned_opt_in(auth.uid()) AND public.shares_goal_tag(auth.uid(), e.user_id))
        )
    )
  );

-- 3. reactions: mirror progress_events visibility
DROP POLICY IF EXISTS "reactions read with event" ON public.reactions;
CREATE POLICY "reactions read with event" ON public.reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.progress_events e
      WHERE e.id = reactions.event_id
        AND (
          e.user_id = auth.uid()
          OR e.visibility = 'public'
          OR (e.visibility = 'friends' AND public.is_accepted_follower(auth.uid(), e.user_id))
          OR (e.visibility = 'aligned' AND public.viewer_aligned_opt_in(auth.uid()) AND public.shares_goal_tag(auth.uid(), e.user_id))
        )
    )
  );

-- 4. Lock down SECURITY DEFINER helpers — they are for use inside RLS, not direct API calls.
REVOKE EXECUTE ON FUNCTION public.is_accepted_follower(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_mutual(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.viewer_aligned_opt_in(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shares_goal_tag(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
