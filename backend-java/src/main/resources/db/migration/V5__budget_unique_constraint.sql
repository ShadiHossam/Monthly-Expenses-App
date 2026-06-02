-- Prevent duplicate budget alerts for the same category per user
ALTER TABLE budget_alerts
    ADD CONSTRAINT uq_budget_user_category UNIQUE (user_id, category_id);
