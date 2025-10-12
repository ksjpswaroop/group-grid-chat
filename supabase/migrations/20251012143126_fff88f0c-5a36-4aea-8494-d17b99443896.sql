-- Create calls table
CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_name text UNIQUE NOT NULL,
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
  dm_conversation_id uuid REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  started_by uuid NOT NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  is_active boolean DEFAULT true,
  is_recording boolean DEFAULT false,
  recording_url text,
  call_type text CHECK (call_type IN ('audio', 'video')) DEFAULT 'video',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT call_destination_check CHECK (
    (channel_id IS NOT NULL AND dm_conversation_id IS NULL) OR
    (channel_id IS NULL AND dm_conversation_id IS NOT NULL)
  )
);

-- Create call participants table
CREATE TABLE public.call_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid REFERENCES public.calls(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  is_muted boolean DEFAULT false,
  is_video_enabled boolean DEFAULT true,
  is_screen_sharing boolean DEFAULT false,
  UNIQUE(call_id, user_id)
);

-- Create LiveKit configuration table (admin only)
CREATE TABLE public.livekit_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_url text NOT NULL,
  api_key text NOT NULL,
  api_secret text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livekit_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calls
CREATE POLICY "Users can view calls in accessible channels"
ON public.calls FOR SELECT
USING (
  (channel_id IN (
    SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid()
  )) OR
  (dm_conversation_id IN (
    SELECT dm_id FROM public.dm_participants WHERE user_id = auth.uid()
  ))
);

CREATE POLICY "Users can create calls"
ON public.calls FOR INSERT
WITH CHECK (
  started_by = auth.uid() AND (
    (channel_id IN (
      SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid()
    )) OR
    (dm_conversation_id IN (
      SELECT dm_id FROM public.dm_participants WHERE user_id = auth.uid()
    ))
  )
);

CREATE POLICY "Call hosts can update their calls"
ON public.calls FOR UPDATE
USING (started_by = auth.uid());

-- RLS Policies for call_participants
CREATE POLICY "Users can view call participants"
ON public.call_participants FOR SELECT
USING (
  call_id IN (
    SELECT id FROM public.calls WHERE
    channel_id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid()) OR
    dm_conversation_id IN (SELECT dm_id FROM public.dm_participants WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Users can manage own participation"
ON public.call_participants FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS Policies for livekit_config
CREATE POLICY "Admins can manage livekit config"
ON public.livekit_config FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes for performance
CREATE INDEX idx_calls_channel ON public.calls(channel_id) WHERE is_active = true;
CREATE INDEX idx_calls_dm ON public.calls(dm_conversation_id) WHERE is_active = true;
CREATE INDEX idx_calls_active ON public.calls(is_active) WHERE is_active = true;
CREATE INDEX idx_call_participants_call ON public.call_participants(call_id);
CREATE INDEX idx_call_participants_user ON public.call_participants(user_id);

-- Enable realtime for calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;