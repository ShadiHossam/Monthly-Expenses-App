CREATE TABLE budget_breach_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    year INT NOT NULL,
    month INT NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, category_id, year, month)
);
