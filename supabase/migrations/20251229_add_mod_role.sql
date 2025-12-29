
-- Migration: Add 'mod' role to profiles table
-- Date: 2025-12-29

-- Drop existing constraint
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint with 'mod' role included
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'branch', 'auditor', 'mod'));
