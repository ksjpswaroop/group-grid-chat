-- Fix infinite recursion between channels and channel_members RLS policies
-- The issue: channels policy queries channel_members, and channel_members policy queries channels

-- Drop and recreate the channel_members SELECT policy without the circular reference
DROP POLICY IF EXISTS "Users can view channel members" ON public.channel_members;

CREATE POLICY "Users can view channel members"
ON public.channel_members
FOR SELECT
USING (
  -- Users can see members of channels they belong to
  is_channel_member(auth.uid(), channel_id)
  OR 
  -- Admins can see all members
  has_role(auth.uid(), 'admin'::app_role)
);