-- Phase 1: Fix infinite recursion in channel_members RLS policy

-- Create security definer function to check channel membership
CREATE OR REPLACE FUNCTION public.is_channel_member(_user_id uuid, _channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.channel_members
    WHERE user_id = _user_id AND channel_id = _channel_id
  )
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view channel members" ON public.channel_members;

-- Recreate with non-recursive logic using the security definer function
CREATE POLICY "Users can view channel members" ON public.channel_members
FOR SELECT
USING (
  -- User can see members of public channels
  EXISTS (
    SELECT 1 FROM public.channels 
    WHERE id = channel_id AND NOT is_private
  )
  OR
  -- User can see members of private channels they're in
  public.is_channel_member(auth.uid(), channel_id)
  OR
  -- Admins can see all
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Phase 2: Direct Messages setup

-- Create DM conversations table
CREATE TABLE IF NOT EXISTS public.dm_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;

-- Create DM participants junction table
CREATE TABLE IF NOT EXISTS public.dm_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dm_id uuid REFERENCES public.dm_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamp with time zone DEFAULT now(),
  UNIQUE(dm_id, user_id)
);

ALTER TABLE public.dm_participants ENABLE ROW LEVEL SECURITY;

-- Update direct_messages to reference conversations
ALTER TABLE public.direct_messages 
ADD COLUMN IF NOT EXISTS dm_id uuid REFERENCES public.dm_conversations(id) ON DELETE CASCADE;

-- RLS policies for DM conversations
CREATE POLICY "Users can view their DM conversations" ON public.dm_conversations
FOR SELECT
USING (
  id IN (
    SELECT dm_id FROM public.dm_participants 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create DM conversations" ON public.dm_conversations
FOR INSERT
WITH CHECK (true);

-- RLS policies for DM participants
CREATE POLICY "Users can view DM participants" ON public.dm_participants
FOR SELECT
USING (
  dm_id IN (
    SELECT dm_id FROM public.dm_participants 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can join DMs" ON public.dm_participants
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Update direct_messages RLS to use dm_id
DROP POLICY IF EXISTS "Users can view their direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can send direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can update their sent messages" ON public.direct_messages;

CREATE POLICY "Users can view their direct messages" ON public.direct_messages
FOR SELECT
USING (
  dm_id IN (
    SELECT dm_id FROM public.dm_participants 
    WHERE user_id = auth.uid()
  ) OR
  sender_id = auth.uid() OR 
  recipient_id = auth.uid()
);

CREATE POLICY "Users can send direct messages" ON public.direct_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND (
    dm_id IN (
      SELECT dm_id FROM public.dm_participants 
      WHERE user_id = auth.uid()
    ) OR
    recipient_id IS NOT NULL
  )
);

CREATE POLICY "Users can update their sent messages" ON public.direct_messages
FOR UPDATE
USING (sender_id = auth.uid());

-- Enable realtime for new DM tables only
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_participants;

-- Phase 3: Search setup

-- Create full-text search index on messages
CREATE INDEX IF NOT EXISTS messages_content_fts 
ON public.messages 
USING GIN(to_tsvector('english', content));

-- Create search function
CREATE OR REPLACE FUNCTION public.search_messages(
  search_query text,
  channel_filter uuid DEFAULT NULL,
  limit_count int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  content text,
  user_id uuid,
  channel_id uuid,
  created_at timestamp with time zone,
  rank real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    m.id,
    m.content,
    m.user_id,
    m.channel_id,
    m.created_at,
    ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', search_query)) as rank
  FROM public.messages m
  WHERE 
    to_tsvector('english', m.content) @@ plainto_tsquery('english', search_query)
    AND (channel_filter IS NULL OR m.channel_id = channel_filter)
    AND m.channel_id IN (
      SELECT channel_id FROM public.channel_members 
      WHERE user_id = auth.uid()
    )
  ORDER BY rank DESC, m.created_at DESC
  LIMIT limit_count;
$$;

-- Phase 4: Notifications setup

-- Create channel read status table FIRST
CREATE TABLE IF NOT EXISTS public.channel_read_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  last_read timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

ALTER TABLE public.channel_read_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own read status" ON public.channel_read_status
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
  setting text NOT NULL CHECK (setting IN ('all', 'mentions', 'none')) DEFAULT 'all',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notification preferences" ON public.notification_preferences
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- NOW create unread count function
CREATE OR REPLACE FUNCTION public.get_unread_count(_user_id uuid)
RETURNS TABLE (
  channel_id uuid,
  unread_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    m.channel_id,
    COUNT(*) as unread_count
  FROM public.messages m
  WHERE 
    m.channel_id IN (
      SELECT channel_id FROM public.channel_members 
      WHERE user_id = _user_id
    )
    AND m.created_at > COALESCE(
      (SELECT last_read FROM public.channel_read_status 
       WHERE user_id = _user_id AND channel_id = m.channel_id),
      '1970-01-01'::timestamp
    )
    AND m.user_id != _user_id
  GROUP BY m.channel_id;
$$;