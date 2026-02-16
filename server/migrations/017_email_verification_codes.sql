CREATE TABLE IF NOT EXISTS email_verification_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  send_ip TEXT,
  send_ua TEXT
);

CREATE INDEX IF NOT EXISTS email_verification_codes_expires_at_idx ON email_verification_codes (expires_at);
