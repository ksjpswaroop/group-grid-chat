-- Fix security warning: Set search_path for invitation validation function
CREATE OR REPLACE FUNCTION validate_invitation_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Invitation expiry must be in the future';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;