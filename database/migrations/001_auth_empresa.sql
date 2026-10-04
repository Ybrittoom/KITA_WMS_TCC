-- Execute manualmente no seu banco local antes de usar POST /api/auth/login.
-- Esta migração apenas adiciona os campos de autenticação da empresa.
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS senha_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_email_lower
  ON empresas (LOWER(email))
  WHERE email IS NOT NULL;
