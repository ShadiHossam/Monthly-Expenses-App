INSERT INTO categories (user_id, name, color, icon, is_system)
SELECT u.id, 'Cashback', '#f59e0b', 'redeem', true
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.user_id = u.id AND c.name = 'Cashback' AND c.is_system = TRUE
);
