INSERT INTO categories (user_id, name, color, icon, is_system)
SELECT u.id, cat.name, cat.color, cat.icon, true
FROM users u
CROSS JOIN (VALUES
    ('Groceries',     '#10b981', 'shopping-cart'),
    ('Dining',        '#f59e0b', 'utensils'),
    ('Transport',     '#3b82f6', 'car'),
    ('Utilities',     '#8b5cf6', 'zap'),
    ('Healthcare',    '#ef4444', 'heart'),
    ('Entertainment', '#ec4899', 'music'),
    ('Shopping',      '#f97316', 'bag'),
    ('Income',        '#22c55e', 'arrow-down'),
    ('Transfer',      '#6b7280', 'arrows'),
    ('Subscriptions', '#14b8a6', 'refresh'),
    ('Uncategorized', '#9ca3af', 'tag')
) AS cat(name, color, icon)
WHERE NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.user_id = u.id
);
