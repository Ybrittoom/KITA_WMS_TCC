-- Execute no DBeaver depois de rodar database/schema_simples.sql.
-- Cadastra uma empresa que entra diretamente na tela de login.
-- Troque todos os valores de exemplo antes de executar.
-- A senha e armazenada como hash bcrypt, nunca em texto puro.
-- Nao salve este comando com a senha real no Git ou no historico do DBeaver.

INSERT INTO public.empresas (nome, cnpj, email, senha_hash)
VALUES (
  'NOME DA EMPRESA',
  'CNPJ DA EMPRESA',
  lower('email@empresa.com'),
  extensions.crypt('SENHA_TEMPORARIA_FORTE', extensions.gen_salt('bf', 12))
);

-- Confirme o cadastro sem consultar ou exibir o hash:
SELECT id, nome, cnpj, email
FROM public.empresas
WHERE lower(email) = lower('email@empresa.com');

-- Para trocar a senha, execute separadamente:
-- UPDATE public.empresas
-- SET senha_hash = extensions.crypt('NOVA_SENHA_FORTE', extensions.gen_salt('bf', 12))
-- WHERE lower(email) = lower('email@empresa.com');
