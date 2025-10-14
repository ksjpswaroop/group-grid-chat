-- Drop the vulnerable public SELECT policy on invitations table
-- This policy allowed unauthenticated enumeration of all pending invitations
DROP POLICY IF EXISTS "Public can view their invitation" ON public.invitations;

-- All invitation validation now goes through edge functions which use service role
-- No legitimate application flow requires direct database access to invitations