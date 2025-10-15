-- Fix infinite recursion in channels RLS policies
-- Drop the duplicate and problematic SELECT policies
DROP POLICY IF EXISTS "Users can view channels" ON public.channels;
DROP POLICY IF EXISTS "Users can view their channels" ON public.channels;

-- Create a single, clean SELECT policy using the security definer function
CREATE POLICY "Users can view accessible channels"
ON public.channels
FOR SELECT
USING (
  (NOT is_private AND archived_at IS NULL) 
  OR 
  (id IN (
    SELECT channel_id 
    FROM public.channel_members 
    WHERE user_id = auth.uid()
  ))
  OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Also simplify the admin policy to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage all channels" ON public.channels;

CREATE POLICY "Admins can manage channels"
ON public.channels
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));