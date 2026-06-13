-- NULL out any transactions that were assigned to a category literally named "Uncategorized"
-- (seeded as a system category in V4). Going forward, NULL category_id is the single
-- source of truth for uncategorized transactions.
UPDATE transactions t
SET category_id    = NULL,
    is_categorized = FALSE
WHERE t.category_id IN (
    SELECT id FROM categories WHERE name = 'Uncategorized' AND is_system = TRUE
);

-- Remove the "Uncategorized" system category for every user
DELETE FROM categories WHERE name = 'Uncategorized' AND is_system = TRUE;
