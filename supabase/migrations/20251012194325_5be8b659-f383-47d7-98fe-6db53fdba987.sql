-- Password reset tracking
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS password_reset_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS password_reset_by UUID REFERENCES profiles(id);

-- Audio messages support
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS audio_duration INTEGER; -- in seconds

CREATE INDEX IF NOT EXISTS idx_messages_audio ON messages(audio_url) WHERE audio_url IS NOT NULL;

-- File download tracking
ALTER TABLE file_uploads
ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;

-- Function to increment download count
CREATE OR REPLACE FUNCTION increment_download_count(file_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE file_uploads 
  SET download_count = download_count + 1 
  WHERE id = file_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policy for admins to manage channel members
CREATE POLICY "Admins can manage all channel members"
ON channel_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Function to get non-channel members for autocomplete
CREATE OR REPLACE FUNCTION get_non_channel_members(p_channel_id UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name, au.email, p.avatar_url
  FROM profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE p.id NOT IN (
    SELECT user_id FROM channel_members 
    WHERE channel_id = p_channel_id
  )
  AND au.deleted_at IS NULL
  ORDER BY p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update channels RLS policy to handle archived channels
DROP POLICY IF EXISTS "Users can view their channels" ON channels;

CREATE POLICY "Users can view their channels" ON channels
FOR SELECT USING (
  -- Regular users only see non-archived channels they're members of
  (archived_at IS NULL AND id IN (
    SELECT channel_id FROM channel_members WHERE user_id = auth.uid()
  ))
  OR
  -- Admins see all channels (including archived)
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the job to send scheduled messages every minute
SELECT cron.schedule(
  'send-scheduled-messages',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wksgvhktytkkgzarbwmc.supabase.co/functions/v1/send-scheduled-messages',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);