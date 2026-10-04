# KITA WMS TCC

## API de autenticação da empresa

O endpoint `POST /api/auth/login` autentica a empresa pelo e-mail e senha próprios dela. Em caso de sucesso, retorna um JWT com a identificação da empresa.

### Preparar o banco local

A tabela `empresas` do esquema atual ainda não contém e-mail nem senha. Execute manualmente no seu banco local o arquivo [`database/migrations/001_auth_empresa.sql`](database/migrations/001_auth_empresa.sql) pelo DBeaver. A API não cria bancos nem executa migrações.

Depois, preencha `empresas.email` e `empresas.senha_hash` para a empresa que fará login. Armazene apenas o hash bcrypt da senha, nunca a senha em texto puro. Para gerar o hash localmente:

```sh
node --input-type=module -e "import bcrypt from 'bcryptjs'; console.log(await bcrypt.hash('SUA_SENHA', 12))"
```

Use o hash retornado em um `UPDATE empresas SET email = 'contato@empresa.com', senha_hash = '<hash>' WHERE id = <id>;` executado por você no DBeaver.

### Configuração e execução

Crie seu `.env` local com base em `.env.example`, preenchendo os dados do seu PostgreSQL local e definindo um `JWT_SECRET` aleatório e longo. Não compartilhe nem versione esse arquivo.

```sh
npm install
npm run dev
```

### Requisição

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "contato@empresa.com",
  "senha": "senha da empresa"
}
```

Credenciais válidas retornam HTTP 200 com `token` e os dados da `empresa`. Credenciais inválidas retornam HTTP 401; campos ausentes retornam HTTP 400.
