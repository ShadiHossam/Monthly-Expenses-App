-- Support account-level lockout after repeated failed logins
ALTER TABLE users
    ADD COLUMN login_fail_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN locked_until     TIMESTAMPTZ;
