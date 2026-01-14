-- Add permissions column to profiles table to support per-user permission overrides
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS permissions text[] DEFAULT '{}';

-- Comment on column
COMMENT ON COLUMN profiles.permissions IS 'Array of specific permission strings that override or augment the role-based permissions';
