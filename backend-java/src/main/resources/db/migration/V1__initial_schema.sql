-- Users
CREATE TABLE users (
    id                    BIGSERIAL    PRIMARY KEY,
    username              VARCHAR(255) NOT NULL UNIQUE,
    email                 VARCHAR(255) UNIQUE,
    password_hash         VARCHAR(255) NOT NULL,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    groq_api_key          VARCHAR(500),
    openrouter_api_key    VARCHAR(500),
    anthropic_api_key     VARCHAR(500),
    ai_provider           VARCHAR(50)  NOT NULL DEFAULT 'auto',
    concurrent_processing INTEGER      NOT NULL DEFAULT 2
);
CREATE INDEX ix_users_username ON users(username);

-- Categories
CREATE TABLE categories (
    id         BIGSERIAL    PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(255) NOT NULL,
    color      VARCHAR(20)  NOT NULL DEFAULT '#6b7280',
    icon       VARCHAR(100) NOT NULL DEFAULT 'tag',
    is_system  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_categories_user_id ON categories(user_id);

-- Merchant rules
CREATE TABLE merchant_rules (
    id           BIGSERIAL    PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pattern      VARCHAR(500) NOT NULL,
    pattern_type VARCHAR(50)  NOT NULL DEFAULT 'contains',
    category_id  BIGINT       NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    priority     INTEGER      NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_merchant_rules_user_id ON merchant_rules(user_id);

-- Merchant aliases
CREATE TABLE merchant_aliases (
    id           BIGSERIAL    PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    raw_name     VARCHAR(500) NOT NULL,
    display_name VARCHAR(500) NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_merchant_aliases_user_id ON merchant_aliases(user_id);

-- Statements
CREATE TABLE statements (
    id              BIGSERIAL     PRIMARY KEY,
    user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename        VARCHAR(500),
    image_path      VARCHAR(1000),
    period_start    DATE,
    period_end      DATE,
    opening_balance DECIMAL(12,2),
    closing_balance DECIMAL(12,2),
    verify_status   VARCHAR(50)   NOT NULL DEFAULT 'pending',
    verify_errors   JSONB,
    confidence      FLOAT,
    ocr_engine      VARCHAR(50)   NOT NULL DEFAULT 'vision-ai',
    raw_ocr_text    TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_statements_user_id ON statements(user_id);

-- Transactions
CREATE TABLE transactions (
    id             BIGSERIAL     PRIMARY KEY,
    user_id        BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    statement_id   BIGINT        NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
    txn_date       DATE          NOT NULL,
    ref_number     VARCHAR(255),
    description    VARCHAR(1000) NOT NULL,
    merchant_name  VARCHAR(500),
    amount         DECIMAL(12,2) NOT NULL,
    txn_type       VARCHAR(10)   NOT NULL CHECK (txn_type IN ('debit', 'credit')),
    balance_after  DECIMAL(12,2),
    category_id    BIGINT        REFERENCES categories(id) ON DELETE SET NULL,
    is_categorized BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_txn_user_date ON transactions(user_id, txn_date);
CREATE INDEX ix_txn_merchant  ON transactions(user_id, merchant_name);
CREATE INDEX ix_txn_category  ON transactions(user_id, category_id);

-- Subscriptions (one per user)
CREATE TABLE subscriptions (
    id                     BIGSERIAL   PRIMARY KEY,
    user_id                BIGINT      NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    plan                   VARCHAR(50) NOT NULL DEFAULT 'free',
    stripe_customer_id     VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    pages_used             INTEGER     NOT NULL DEFAULT 0,
    pages_limit            INTEGER     NOT NULL DEFAULT 15,
    current_period_start   TIMESTAMPTZ,
    current_period_end     TIMESTAMPTZ,
    status                 VARCHAR(50) NOT NULL DEFAULT 'active',
    overage_enabled        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

-- Budget alerts
CREATE TABLE budget_alerts (
    id            BIGSERIAL     PRIMARY KEY,
    user_id       BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id   BIGINT        NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    monthly_limit DECIMAL(12,2) NOT NULL,
    enabled       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_budget_alerts_user_id ON budget_alerts(user_id);

-- Saved reports
CREATE TABLE saved_reports (
    id         BIGSERIAL    PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(500) NOT NULL,
    from_date  DATE         NOT NULL,
    to_date    DATE         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_saved_reports_user_id ON saved_reports(user_id);

-- Usage logs
CREATE TABLE usage_logs (
    id             BIGSERIAL   PRIMARY KEY,
    user_id        BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    statement_id   BIGINT      REFERENCES statements(id) ON DELETE SET NULL,
    pages_consumed INTEGER     NOT NULL DEFAULT 1,
    action         VARCHAR(50) NOT NULL DEFAULT 'upload',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_usage_logs_user_id ON usage_logs(user_id);
