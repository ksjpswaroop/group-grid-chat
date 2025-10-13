-- Drop the overly permissive profiles policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create restrictive policy that only allows viewing profiles in shared context
CREATE POLICY "Users can view profiles in shared context"
ON public.profiles FOR SELECT
USING (
  -- Users can always view their own profile
  id = auth.uid()
  OR
  -- Users can view profiles of people in their channels
  id IN (
    SELECT DISTINCT cm.user_id
    FROM public.channel_members cm
    WHERE cm.channel_id IN (
      SELECT channel_id 
      FROM public.channel_members 
      WHERE user_id = auth.uid()
    )
  )
  OR
  -- Users can view profiles of DM participants
  id IN (
    SELECT DISTINCT dp.user_id
    FROM public.dm_participants dp
    WHERE dp.dm_id IN (
      SELECT dm_id 
      FROM public.dm_participants 
      WHERE user_id = auth.uid()
    )
  )
  OR
  -- Admins can view all profiles for user management
  public.has_role(auth.uid(), 'admin'::app_role)
);