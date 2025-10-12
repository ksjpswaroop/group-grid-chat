-- Fix infinite recursion in channels RLS policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view public channels" ON public.channels;
DROP POLICY IF EXISTS "Admins can manage channels" ON public.channels;

-- Create fixed policies without recursion
CREATE POLICY "Users can view public channels"
ON public.channels FOR SELECT
USING (
  NOT is_private 
  OR EXISTS (
    SELECT 1 FROM public.channel_members cm
    WHERE cm.channel_id = channels.id 
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all channels"
ON public.channels FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'::app_role
  )
);

CREATE POLICY "Users can create channels"
ON public.channels FOR INSERT
WITH CHECK (
  created_by = auth.uid()
);

-- Add indexes to improve performance
CREATE INDEX IF NOT EXISTS idx_channels_is_private ON public.channels(is_private);
CREATE INDEX IF NOT EXISTS idx_messages_channel_parent ON public.messages(channel_id, parent_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_members_lookup ON public.channel_members(channel_id, user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_lookup ON public.message_reactions(message_id, user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_user_read ON public.mentions(mentioned_user_id, read_at) WHERE read_at IS NULL;