-- Fix infinite recursion in profiles RLS policy with dm_participants
-- The issue: profiles policy queries dm_participants, which triggers its own policy recursively

-- Create a security definer function to check if two users share any context
CREATE OR REPLACE FUNCTION public.users_share_context(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if users share any channels
  SELECT EXISTS (
    SELECT 1
    FROM channel_members cm1
    JOIN channel_members cm2 ON cm1.channel_id = cm2.channel_id
    WHERE cm1.user_id = user_a AND cm2.user_id = user_b
  )
  OR
  -- Check if users share any DM conversations
  EXISTS (
    SELECT 1
    FROM dm_participants dp1
    JOIN dm_participants dp2 ON dp1.dm_id = dp2.dm_id
    WHERE dp1.user_id = user_a AND dp2.user_id = user_b
  )
$$;

-- Drop and recreate the profiles SELECT policy without circular reference
DROP POLICY IF EXISTS "Users can view profiles in shared context" ON public.profiles;

CREATE POLICY "Users can view profiles in shared context"
ON public.profiles
FOR SELECT
USING (
  -- Users can see their own profile
  id = auth.uid()
  OR
  -- Users can see profiles of users they share context with
  users_share_context(auth.uid(), id)
  OR
  -- Admins can see all profiles
  has_role(auth.uid(), 'admin'::app_role)
);