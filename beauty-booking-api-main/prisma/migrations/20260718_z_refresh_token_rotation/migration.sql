ALTER TABLE "user_sessions"
  ADD COLUMN IF NOT EXISTS "refresh_token_hash" TEXT;
