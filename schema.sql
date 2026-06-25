-- schema.sql — run this once against your Postgres database
-- (Neon / Supabase / Vercel Postgres console all let you run raw SQL)

CREATE TABLE IF NOT EXISTS users (
  id                    SERIAL PRIMARY KEY,
  email                 TEXT UNIQUE NOT NULL,
  password_hash         TEXT NOT NULL,
  name                  TEXT,
  plan                  TEXT DEFAULT 'free',
  stripe_customer_id    TEXT,
  subscription_active   BOOLEAN DEFAULT FALSE,
  subscription_tier     TEXT,
  subscription_expires  TIMESTAMPTZ,
  usage_used            INTEGER DEFAULT 0,
  usage_limit           INTEGER DEFAULT 30,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users (stripe_customer_id);
