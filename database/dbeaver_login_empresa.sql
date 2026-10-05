-- Copie e execute no DBeaver conectado ao seu banco local.
-- Este script altera somente a tabela empresas do banco selecionado.

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS senha_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_email_lower
  ON empresas (LOWER(email))
  WHERE email IS NOT NULL;

-- Antes do UPDATE abaixo, gere um hash bcrypt para a senha no terminal:
-- node --input-type=module -e "import bcrypt from 'bcryptjs'; console.log(await bcrypt.hash('SUA_SENHA', 12))"
-- Substitua os três valores de exemplo e execute o UPDATE separadamente.
-- Não salve a senha em texto puro em senha_hash.
-- UPDATE empresas
-- SET email = 'contato@empresa.com', senha_hash = 'COLE_AQUI_O_HASH_BCRYPT'
-- WHERE id = ID_DA_EMPRESA;
