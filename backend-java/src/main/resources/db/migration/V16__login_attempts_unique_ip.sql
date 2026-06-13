-- Deduplicate any existing duplicate-IP rows (keep the most recent per IP), then enforce uniqueness.
DELETE FROM login_attempts la
WHERE id NOT IN (
    SELECT DISTINCT ON (ip) id
    FROM login_attempts
    ORDER BY ip, window_start DESC
);

ALTER TABLE login_attempts ADD CONSTRAINT uq_login_attempts_ip UNIQUE (ip);
