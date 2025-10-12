-- Fix infinite recursion in channels RLS policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view public channels" ON public.channels;

-- Create a security definer function to check if user can view channel
CREATE OR REPLACE FUNCTION public.can_view_channel(_user_id uuid, _channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.channels c
    WHERE c.id = _channel_id
    AND (
      c.is_private = false
      OR EXISTS (
        SELECT 1 FROM public.channel_members cm
        WHERE cm.channel_id = _channel_id AND cm.user_id = _user_id
      )
    )
  )
$$;

-- Recreate the policy using the function
CREATE POLICY "Users can view accessible channels" ON public.channels
FOR SELECT USING (
  can_view_channel(auth.uid(), id)
);