-- Fill placeholder email for existing accounts with no email
UPDATE users SET email = username || '@noemail.local'
WHERE email IS NULL OR email = '';

-- Add NOT NULL constraint
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
