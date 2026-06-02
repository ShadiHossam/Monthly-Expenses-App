CREATE TABLE login_attempts (
    id BIGSERIAL PRIMARY KEY,
    ip VARCHAR(45) NOT NULL,
    attempt_count INT NOT NULL DEFAULT 1,
    window_start TIMESTAMP NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMP
);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip);
