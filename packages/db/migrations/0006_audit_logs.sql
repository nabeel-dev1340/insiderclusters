-- Audit logging table for security and compliance tracking
-- Tracks all sensitive operations: login, logout, settings changes, etc.

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  action TEXT NOT NULL, -- e.g., 'auth_magic_link_requested', 'user_signed_in', 'email_alerts_toggled'
  resource_id TEXT, -- e.g., ticker, watchlist ID if applicable
  resource_type TEXT, -- e.g., 'watchlist', 'alert'
  details JSONB, -- Additional context, e.g., { "enabled": true } for toggle events
  ip_address INET, -- Client IP address
  user_agent TEXT, -- Browser/client user agent
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_email ON audit_logs(email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);
