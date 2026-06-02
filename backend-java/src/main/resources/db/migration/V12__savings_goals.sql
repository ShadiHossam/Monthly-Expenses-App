CREATE TABLE savings_goals (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_amount DECIMAL(12, 2) NOT NULL,
    target_date DATE NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#10b981',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_savings_goals_user ON savings_goals(user_id);
