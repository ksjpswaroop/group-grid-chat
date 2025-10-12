-- Phase 7: Enhanced Collaboration Database Schema

-- 1. Message Edit History Table
CREATE TABLE IF NOT EXISTS public.message_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  edited_by UUID NOT NULL REFERENCES public.profiles(id),
  edited_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_edit_history_message ON public.message_edit_history(message_id, edited_at DESC);

ALTER TABLE public.message_edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view edit history in their channels"
ON public.message_edit_history FOR SELECT
USING (
  message_id IN (
    SELECT m.id FROM public.messages m
    WHERE m.channel_id IN (
      SELECT channel_id FROM public.channel_members 
      WHERE user_id = auth.uid()
    )
  )
);

-- Trigger to auto-save history on edit
CREATE OR REPLACE FUNCTION public.save_message_edit_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO public.message_edit_history (message_id, content, edited_by)
    VALUES (OLD.id, OLD.content, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER message_edit_history_trigger
BEFORE UPDATE ON public.messages
FOR EACH ROW
WHEN (OLD.content IS DISTINCT FROM NEW.content)
EXECUTE FUNCTION public.save_message_edit_history();

-- RPC function to get edit history
CREATE OR REPLACE FUNCTION public.get_message_edit_history(msg_id UUID)
RETURNS TABLE (
  id UUID,
  content TEXT,
  edited_by UUID,
  editor_name TEXT,
  edited_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    meh.id,
    meh.content,
    meh.edited_by,
    p.full_name as editor_name,
    meh.edited_at
  FROM public.message_edit_history meh
  JOIN public.profiles p ON p.id = meh.edited_by
  WHERE meh.message_id = msg_id
  ORDER BY meh.edited_at DESC;
$$;

-- 2. Scheduled Messages Table
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed'))
);

CREATE INDEX idx_scheduled_messages_pending ON public.scheduled_messages(scheduled_for)
WHERE status = 'pending' AND cancelled_at IS NULL;

ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own scheduled messages"
ON public.scheduled_messages FOR ALL
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid() AND
  channel_id IN (
    SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid()
  )
);

-- 3. Message Templates Table
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  usage_count INTEGER DEFAULT 0,
  CONSTRAINT unique_user_template_name UNIQUE (user_id, name)
);

CREATE INDEX idx_templates_user ON public.message_templates(user_id, is_shared);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own templates"
ON public.message_templates FOR ALL
USING (user_id = auth.uid() OR is_shared = true)
WITH CHECK (user_id = auth.uid());

-- 4. Channel Archives - Add columns to existing channels table
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_channels_archived ON public.channels(archived_at) 
WHERE archived_at IS NOT NULL;

-- Update channels RLS policy for archived channels
DROP POLICY IF EXISTS "Users can view channels" ON public.channels;
CREATE POLICY "Users can view channels"
ON public.channels FOR SELECT
USING (
  (NOT is_private AND archived_at IS NULL) OR 
  (id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid())) OR
  (has_role(auth.uid(), 'admin'::app_role))
);

-- 5. Advanced Search RPC Function
CREATE OR REPLACE FUNCTION public.advanced_search_messages(
  search_query TEXT,
  channel_filter UUID DEFAULT NULL,
  user_filter UUID DEFAULT NULL,
  has_attachments BOOLEAN DEFAULT NULL,
  date_from TIMESTAMPTZ DEFAULT NULL,
  date_to TIMESTAMPTZ DEFAULT NULL,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  user_id UUID,
  channel_id UUID,
  created_at TIMESTAMPTZ,
  rank REAL
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    m.id,
    m.content,
    m.user_id,
    m.channel_id,
    m.created_at,
    ts_rank(
      to_tsvector('english', m.content),
      plainto_tsquery('english', search_query)
    ) as rank
  FROM public.messages m
  WHERE 
    m.channel_id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid())
    AND (channel_filter IS NULL OR m.channel_id = channel_filter)
    AND (user_filter IS NULL OR m.user_id = user_filter)
    AND (date_from IS NULL OR m.created_at >= date_from)
    AND (date_to IS NULL OR m.created_at <= date_to)
    AND (has_attachments IS NULL OR 
         (has_attachments = true AND m.content ~ 'https?://[^\s]+') OR
         (has_attachments = false AND m.content !~ 'https?://[^\s]+'))
    AND to_tsvector('english', m.content) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, m.created_at DESC
  LIMIT limit_count;
$$;