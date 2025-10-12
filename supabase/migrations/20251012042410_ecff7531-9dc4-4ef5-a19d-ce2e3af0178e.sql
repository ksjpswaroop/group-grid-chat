-- Add threading and pinning columns to messages table
ALTER TABLE public.messages 
ADD COLUMN parent_message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
ADD COLUMN is_pinned boolean DEFAULT false,
ADD COLUMN pinned_at timestamp with time zone,
ADD COLUMN pinned_by uuid;

CREATE INDEX idx_messages_parent ON public.messages(parent_message_id) WHERE parent_message_id IS NOT NULL;
CREATE INDEX idx_messages_pinned ON public.messages(channel_id, is_pinned) WHERE is_pinned = true;

-- Message reactions table
CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX idx_reactions_message ON public.message_reactions(message_id);
CREATE INDEX idx_reactions_user ON public.message_reactions(user_id);

-- RLS for reactions
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can add reactions to messages in their channels"
ON public.message_reactions FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  message_id IN (
    SELECT m.id FROM public.messages m
    WHERE m.channel_id IN (
      SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can remove own reactions"
ON public.message_reactions FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY "Users can view reactions in their channels"
ON public.message_reactions FOR SELECT
USING (
  message_id IN (
    SELECT m.id FROM public.messages m
    WHERE m.channel_id IN (
      SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid()
    )
  )
);

-- Mentions table
CREATE TABLE public.mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  mentioned_user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  read_at timestamp with time zone,
  UNIQUE(message_id, mentioned_user_id)
);

CREATE INDEX idx_mentions_user ON public.mentions(mentioned_user_id, read_at);
CREATE INDEX idx_mentions_message ON public.mentions(message_id);

-- RLS for mentions
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mentions"
ON public.mentions FOR SELECT
USING (mentioned_user_id = auth.uid());

CREATE POLICY "Users can update their mention read status"
ON public.mentions FOR UPDATE
USING (mentioned_user_id = auth.uid());

CREATE POLICY "System can create mentions"
ON public.mentions FOR INSERT
WITH CHECK (
  message_id IN (
    SELECT m.id FROM public.messages m
    WHERE m.channel_id IN (
      SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid()
    )
  )
);

-- Thread followers table
CREATE TABLE public.thread_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(thread_id, user_id)
);

CREATE INDEX idx_thread_followers_thread ON public.thread_followers(thread_id);
CREATE INDEX idx_thread_followers_user ON public.thread_followers(user_id);

-- RLS for thread followers
ALTER TABLE public.thread_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own thread follows"
ON public.thread_followers FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mentions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_followers;

-- Helper functions
CREATE OR REPLACE FUNCTION public.get_thread_reply_count(parent_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM public.messages
  WHERE parent_message_id = parent_id;
$$;

CREATE OR REPLACE FUNCTION public.get_message_reactions_summary(msg_id uuid)
RETURNS TABLE(emoji text, count bigint, user_ids uuid[], current_user_reacted boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    emoji,
    COUNT(*)::bigint,
    array_agg(user_id) as user_ids,
    bool_or(user_id = auth.uid()) as current_user_reacted
  FROM public.message_reactions
  WHERE message_id = msg_id
  GROUP BY emoji
  ORDER BY COUNT(*) DESC;
$$;