-- Create a default free subscription for any existing user who doesn't have one
INSERT INTO subscriptions (user_id, plan, pages_used, pages_limit, status, overage_enabled)
SELECT u.id, 'free', 0, 15, 'active', false
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM subscriptions s WHERE s.user_id = u.id
);
