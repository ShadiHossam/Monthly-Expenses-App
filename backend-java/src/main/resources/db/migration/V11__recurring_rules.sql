CREATE TABLE recurring_rules (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    merchant_pattern VARCHAR(200),
    expected_amount DECIMAL(12, 2),
    frequency_days INT NOT NULL DEFAULT 30,
    next_expected_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_recurring_rules_user ON recurring_rules(user_id);
