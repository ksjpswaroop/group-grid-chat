-- Fix search_path for security definer functions to prevent search path manipulation attacks

-- Update increment_download_count function with proper search_path
CREATE OR REPLACE FUNCTION increment_download_count(file_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE file_uploads 
  SET download_count = download_count + 1 
  WHERE id = file_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update get_non_channel_members function with proper search_path
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;