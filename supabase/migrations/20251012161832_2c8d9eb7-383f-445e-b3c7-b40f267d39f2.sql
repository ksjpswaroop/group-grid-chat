-- Fix infinite recursion in channels RLS policy (proper fix)
-- Drop the problematic policy and function
DROP POLICY IF EXISTS "Users can view accessible channels" ON public.channels;
DROP FUNCTION IF EXISTS public.can_view_channel;

-- Create a simpler policy that avoids recursion by not referencing channels table
CREATE POLICY "Users can view channels" ON public.channels
FOR SELECT USING (
  NOT is_private
  OR id IN (
    SELECT channel_id 
    FROM public.channel_members 
    WHERE user_id = auth.uid()
  )
);