-- Remove admin role from the hardcoded dev account added in V18.
-- In a fresh production database this is a no-op.
-- In development databases it revokes accidental admin from the 's' account.
UPDATE users SET role = 'user' WHERE username = 's' AND role = 'admin';
