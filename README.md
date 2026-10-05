# KITA WMS TCC

## Login da empresa

O servidor disponibiliza a tela em `/` e `/login`. Ela envia o e-mail e a senha para `POST /api/auth/login`, mostra o resultado e guarda o JWT recebido no armazenamento da sessão. Se a opção "Lembrar deste dispositivo" estiver marcada, o token fica no armazenamento local do navegador.

A API autentica a empresa pelo e-mail e senha próprios dela e retorna um JWT com a identificação da empresa. A senha é armazenada no banco como hash bcrypt; para uso fora do desenvolvimento local, sirva a aplicação por HTTPS para proteger as credenciais durante o envio.

A implementação está separada por responsabilidade:

- `src/routes/authRoutes.js`: mapeia a rota.
- `src/controller/authController.js`: valida a requisição e monta a resposta HTTP.
- `src/service/authService.js`: autentica a empresa e cria o JWT.
- `src/model/empresaModel.js`: consulta a empresa no PostgreSQL.

## Preparar o banco local pelo DBeaver

Abra [database/dbeaver_login_empresa.sql](database/dbeaver_login_empresa.sql), conecte o DBeaver ao seu banco local e execute o SQL manualmente. O arquivo adiciona `email` e `senha_hash` à tabela `empresas` e cria um índice único para o e-mail. Ele não cria nem conecta a API a outro banco.

Gere o hash bcrypt da senha localmente com:

```sh
node --input-type=module -e "import bcrypt from 'bcryptjs'; console.log(await bcrypt.hash('SUA_SENHA', 12))"
```

No arquivo SQL, descomente o `UPDATE`, substitua os valores de exemplo pelo e-mail, hash e ID da sua empresa, e execute essa instrução no DBeaver. Não armazene a senha em texto puro.

Como seu esquema ativa RLS, o usuário PostgreSQL que roda a API precisa ter permissão para consultar a linha da empresa em `empresas`. Sem uma política RLS aplicável, o banco pode ocultar a linha durante o login.

## Configuração e execução

Crie `.env` com base em `.env.example`, preenchendo os dados do seu PostgreSQL local e definindo um `JWT_SECRET` longo e aleatório. Não compartilhe nem versione esse arquivo.

```sh
npm install
npm run dev
```

## Requisição

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "contato@empresa.com",
  "senha": "senha da empresa"
}
```

Credenciais válidas retornam HTTP 200 com `token` e os dados da empresa. Credenciais inválidas retornam HTTP 401; campos ausentes retornam HTTP 400.
