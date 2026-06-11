-- Add Gmail OAuth fields to users
ALTER TABLE users
    ADD COLUMN gmail_refresh_token TEXT,
    ADD COLUMN gmail_email         VARCHAR(255),
    ADD COLUMN gmail_sync_days     VARCHAR(100) DEFAULT '1,2,3,28,29,30,31';

-- Short-lived OAuth state nonces (CSRF protection — 10-min TTL, cleaned up by scheduler)
CREATE TABLE gmail_oauth_states (
    state      VARCHAR(36)  PRIMARY KEY,   -- random UUID
    user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ  NOT NULL
);

-- Sender whitelist per user
CREATE TABLE gmail_filter_senders (
    id           BIGSERIAL    PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_email VARCHAR(255) NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, sender_email)
);
CREATE INDEX ix_gmail_filter_senders_user ON gmail_filter_senders(user_id);

-- Processed message IDs to prevent re-import
CREATE TABLE gmail_processed_messages (
    id                BIGSERIAL    PRIMARY KEY,
    user_id           BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gmail_message_id  VARCHAR(255) NOT NULL,
    processed_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, gmail_message_id)
);
CREATE INDEX ix_gmail_processed_user ON gmail_processed_messages(user_id);
