-- Add password_change_required flag to profiles
ALTER TABLE public.profiles 
ADD COLUMN password_change_required boolean DEFAULT false;