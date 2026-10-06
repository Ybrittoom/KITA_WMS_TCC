# KITA WMS TCC

Aplicacao Node.js/Express com login de empresa e banco PostgreSQL multiempresa. O Supabase hospeda o PostgreSQL; o DBeaver e usado para administrar e executar SQL. O Render hospeda a aplicacao Node.

## Modelo de login

Cada empresa tem um e-mail e hash de senha em `public.empresas`. A empresa entra com esse e-mail e senha. O cadastro e a troca de senha sao feitos pelo administrador no DBeaver; nao existe cadastro publico no site. `public.usuarios` representa funcionarios para relacionar pedidos e movimentacoes, nao contas de login.

O backend verifica a senha com bcrypt e emite um JWT. Nunca grave senha em texto puro. A senha fica como hash bcrypt (`senha_hash`).

## Banco do zero

Para comecar de forma simples, crie um projeto novo no Supabase; assim os dados atuais ficam intocados. DBeaver nao cria nem hospeda um servidor PostgreSQL: ele apenas conecta a um servidor existente. Neste caminho, crie o projeto Supabase primeiro e use o DBeaver para executar o script nele.

1. No Supabase, crie o projeto e anote a senha do PostgreSQL.
2. Abra **Connect** no projeto e use os dados PostgreSQL (host, porta, database, usuario e senha). Habilite SSL no DBeaver. O nome do banco normalmente aparece como `postgres`; copie o que o painel mostrar.
3. Baixe o certificado CA em **Database → SSL Configuration** para a conexao segura do Node.
4. No DBeaver, conecte ao banco Supabase vazio, abra `database/schema_simples.sql` e execute o arquivo inteiro uma unica vez.
5. Abra `database/dbeaver_cadastro_empresa.sql`, substitua os exemplos e execute para criar cada conta de empresa. Rode novamente com outros dados para adicionar mais empresas.

O script cria as tabelas do WMS e ativa RLS sem politicas para impedir acesso anonimo pelo Data API do Supabase. A API Node acessa o banco pelo PostgreSQL e deve filtrar consultas de negocio por `empresa_id`. O script nao apaga tabelas existentes; use um banco novo e nao execute sobre o banco antigo.

Para conferir as contas sem mostrar hashes:

```sql
SELECT id, nome, cnpj, email FROM public.empresas ORDER BY id;
```

## Configurar o `.env` local

Copie os valores PostgreSQL de **Connect** do mesmo projeto onde executou o script. O `.env` deve conter:

```dotenv
PORT=3000
DB_HOST=host-do-supabase
DB_PORT=5432
DB_NAME=postgres
DB_USER=usuario-do-supabase
DB_PASSWORD=senha-do-postgres
DB_SSL=true
DB_SSL_CA=C:/caminho/para/prod-ca-2021.crt
JWT_SECRET=segredo-aleatorio-com-pelo-menos-32-caracteres
JWT_EXPIRES_IN=8h
```

`DB_SSL_CA` deve apontar para o arquivo CA baixado do painel. Gere um segredo JWT aleatorio com:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Este fluxo nao usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` nem Supabase Auth. Nunca compartilhe ou publique `DB_PASSWORD` ou `JWT_SECRET`.

## Rodar e testar

```powershell
npm install
npm run dev
```

Abra `http://localhost:3000/login` e use o e-mail e a senha cadastrados para uma empresa. `POST /api/auth/login` recebe `{ "email": "...", "senha": "..." }`. `GET /api/auth/me` exige `Authorization: Bearer <token>`.

O script `npm test` ainda e um placeholder sem suite automatizada. O login depende de o banco estar acessivel, o script SQL ter sido aplicado, a empresa ter sido cadastrada e o `.env` estar correto.

## Publicar no Render

1. Envie o projeto ao GitHub e crie um **Web Service** no Render.
2. Use Build Command `npm install` e Start Command `npm start`.
3. No painel Environment do Render, configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL=true`, `DB_SSL_CA`, `JWT_SECRET` e `JWT_EXPIRES_IN`. O Render fornece `PORT`.
4. O certificado CA e publico e pode ser incluido no repositorio (por exemplo `database/prod-ca-2021.crt`); nesse caso, configure `DB_SSL_CA=database/prod-ca-2021.crt`. Nunca inclua `.env`, senha do banco ou segredo JWT no Git.
5. Publique e abra a URL do servico Render.

## Limites atuais

O projeto tem tela e endpoint de login, `/api/auth/me` e tabelas do WMS. Nao implementa cadastro de empresa pelo site, recuperacao de senha, logout, renovacao de JWT ou endpoints completos para clientes, estoque, pedidos e produtos. Cada empresa compartilha uma conta de login; futuramente, se varios funcionarios precisarem entrar individualmente, sera necessario adicionar contas de usuario.
