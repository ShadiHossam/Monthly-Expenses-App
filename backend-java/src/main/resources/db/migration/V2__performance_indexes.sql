-- Composite index for category breakdown and budget queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_txn_user_category_date
    ON transactions(user_id, category_id, txn_date);

-- Index for merchant aggregation and recurring detection
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_txn_user_merchant_date
    ON transactions(user_id, merchant_name, txn_date);

-- Index for statement period overlap detection
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_statements_period
    ON statements(user_id, period_start, period_end);

-- Index for billing / subscription lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_subscriptions_user_plan
    ON subscriptions(user_id, plan);

-- Index for deduplication query (user + date + amount + description + type)
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_txn_dedup
    ON transactions(user_id, txn_date, amount, txn_type);
