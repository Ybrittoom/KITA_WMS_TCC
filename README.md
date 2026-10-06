# KITA WMS TCC

API Express e tela de login para o KITA WMS. A autenticação de e-mail e senha é feita pelo Supabase Auth. Depois do login, a API usa o UUID autenticado para localizar o registro correspondente em `public.usuarios` e descobrir a empresa em `public.empresas`.

## Fluxo implementado

1. A tela envia e-mail e senha para `POST /api/auth/login`.
2. O servidor pede ao Supabase Auth para autenticar a conta e recebe um access token.
3. O servidor procura `usuarios.auth_id` igual ao UUID do usuário autenticado.
4. A empresa é obtida por `usuarios.empresa_id`.
5. A tela guarda o token na sessão do navegador. As futuras requisições protegidas devem enviá-lo como `Authorization: Bearer <token>`.

O script atualizado não guarda e-mail nem senha em `empresas`. A senha pertence à conta do Supabase Auth; o relacionamento do usuário com a empresa fica em `usuarios.auth_id`. O Supabase Auth armazena senhas com hash bcrypt; a aplicação não precisa comparar ou gravar hashes manualmente. [Documentação de segurança de senha do Supabase](https://supabase.com/docs/guides/auth/password-security).

## O que está implementado

- Tela de login servida em `/` e `/login`.
- `POST /api/auth/login`: autentica com Supabase Auth e retorna access token, empresa e usuário.
- `GET /api/auth/me`: exemplo de rota protegida; valida o token no Supabase e retorna a associação empresa/usuário.
- MVC com pastas de rotas, controllers, serviços e models, além de middleware e configuração.
- Conexão PostgreSQL do servidor com SSL para hosts remotos (como o Supabase).
- Esquema Supabase recebido em `database/schema_supabase.sql` e arquivo de apoio para vincular usuários Auth.

Ainda não há cadastro de usuários no site, logout, renovação de sessão, painel após login nem endpoints para estoque, pedidos ou produtos. O link "Esqueceu a senha?" apenas informa que a recuperação ainda não está disponível.

## Estrutura

| Caminho | Responsabilidade |
| --- | --- |
| `src/server.js` | Inicializa Express, serve a tela e registra as rotas. |
| `src/config/database.js` | Pool PostgreSQL e SSL. |
| `src/config/supabase.js` | Cliente do Supabase Auth sem sessão compartilhada no servidor. |
| `src/view/login.html` | Formulário de login. |
| `src/public/css/login.css` | Estilos da tela. |
| `src/public/js/login.js` | Envio do formulário, mensagens e armazenamento do access token. |
| `src/routes/authRoutes.js` | Rotas `/login` e `/me`. |
| `src/controller/authController.js` | Validação HTTP do login e respostas. |
| `src/service/authService.js` | Login via Supabase Auth e busca do vínculo da empresa. |
| `src/model/empresaModel.js` | Consulta `usuarios` e `empresas` no PostgreSQL. |
| `src/middleware/autenticarEmpresa.js` | Valida o access token e resolve a empresa do usuário. |
| `database/dbeaver_login_empresa.sql` | Instruções SQL para associar `auth.users` com `public.usuarios`. |

## Configuração local

Requisitos: Node.js, npm e um projeto Supabase com o esquema atualizado.

Instale dependências e crie `.env` se ainda não existir:

```powershell
npm install
# Configure o arquivo .env local com os valores do Supabase
```

No Supabase Dashboard, abra **Project Settings → API** para obter o Project URL e a chave pública `anon` (ou `publishable`). Em **Connect**, copie host, porta, nome do banco e usuário de conexão PostgreSQL. Preencha `.env`:

```dotenv
PORT=3000
DB_HOST=host-copiado-do-Supabase
DB_PORT=5432
DB_NAME=postgres
DB_USER=usuario-copiado-do-Supabase
DB_PASSWORD=senha-do-banco
DB_SSL=true
SUPABASE_URL=https://seu-project-ref.supabase.co
SUPABASE_ANON_KEY=sua-chave-publica-anon-ou-publishable
```

Use exatamente os valores exibidos em **Connect**. A conexão somente de leitura usada nesta adaptação confirmou que o banco selecionado pelo `.env` se chama `kita_wms_tcc`; mantive esse nome no exemplo. Se o painel **Connect** exibir outro nome ou projeto, use os valores do painel. Os exemplos padrão do Supabase costumam usar `/postgres`, então confira a URI do seu projeto. Para rede IPv4 ou conexão persistente local, use a connection string apropriada do Session Pooler se a conexão direta não estiver disponível. [Guia oficial de conexão PostgreSQL do Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

`SUPABASE_ANON_KEY` deve conter uma chave pública `anon`/`publishable`, nunca a `service_role` ou uma chave secreta. A connection password e a chave pública são usadas somente pelo servidor, no `.env` ignorado pelo Git. Não coloque esses valores no JavaScript do navegador nem os publique em commits.

`DB_SSL=true` exige conexão SSL e valida o certificado. Se o certificado do banco não estiver nas autoridades confiáveis da máquina, baixe o CA em **Database Settings → SSL Configuration** e defina `DB_SSL_CA` com o caminho local do arquivo. Não desative a validação SSL para contornar esse erro.

O projeto anterior usava `JWT_SECRET` para emitir tokens próprios. Esse segredo não é mais usado: agora a assinatura e a validade do token são responsabilidade do Supabase Auth. O prazo do access token é configurado no Supabase.

## Preparar um login de usuário

O esquema recebido está salvo em `database/schema_supabase.sql`. Ele precisa estar aplicado no mesmo projeto Supabase usado pela aplicação e `public.usuarios.auth_id` deve existir. **Não execute novamente às cegas**: confira primeiro se as tabelas já estão no projeto correto.

Para cada pessoa que fará login:

1. No Supabase Dashboard, crie a conta em **Authentication → Users** com o e-mail e senha da pessoa.
2. Copie o UUID da conta Auth criada.
3. Abra `database/dbeaver_login_empresa.sql`, conecte ao mesmo banco no DBeaver e use o `INSERT` ou `UPDATE` comentado para gravar o UUID em `public.usuarios.auth_id` da pessoa correta.
4. Execute a consulta de conferência comentada e confirme que aparece a empresa esperada.

`auth_id` liga uma conta Supabase a uma linha de usuário; `empresa_id` dessa linha define a empresa. Se uma conta Auth não estiver vinculada, o login recebe HTTP 403. O esquema define `auth_id` como único, então uma conta só pode estar associada a um usuário.

### RLS e acesso ao banco

O esquema ativa RLS, mas não define políticas. O model desta aplicação usa o pool PostgreSQL do servidor para consultar o vínculo por `auth_id`. A role de banco em `.env` precisa conseguir fazer essa consulta. Para futuras rotas de dados, filtre toda consulta pelo `empresa_id` resolvido a partir do token; nunca confie em um `empresa_id` enviado pelo navegador. Se a role usada não puder ler devido ao RLS, será necessário aprovar e configurar políticas adequadas no Supabase.

## Executar

```powershell
npm run dev
```

`nodemon` reinicia a API ao salvar arquivos JavaScript. Se o PowerShell bloquear `npm.ps1`, use `npm.cmd run dev`. Para iniciar sem nodemon, execute `npm start`.

Abra `http://localhost:3000/` ou `http://localhost:3000/login`.

## API

### `POST /api/auth/login`

Requisição:

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "senha": "senha configurada no Supabase Auth"
}
```

Sucesso (HTTP 200):

```json
{
  "mensagem": "Login realizado com sucesso.",
  "token": "SUPABASE_ACCESS_TOKEN",
  "tokenExpiresAt": 1790000000,
  "empresa": { "id": "1", "nome": "Minha Empresa" },
  "usuario": {
    "id": "3",
    "nome": "Nome do usuário",
    "authId": "uuid-do-supabase-auth",
    "email": "usuario@empresa.com"
  }
}
```

| HTTP | Significado |
| --- | --- |
| 400 | Campos ausentes ou grandes demais, ou JSON inválido. |
| 401 | E-mail/senha rejeitados pelo Supabase Auth. |
| 403 | A conta autenticou, mas não tem vínculo em `public.usuarios`. |
| 500 | Variáveis do Supabase ausentes, erro de banco ou erro interno. |
| 503 | Supabase Auth temporariamente indisponível. |

### `GET /api/auth/me`

Rota protegida de exemplo. O token é validado com Supabase Auth; depois, o UUID autenticado é usado para buscar a empresa:

```http
GET /api/auth/me
Authorization: Bearer SUPABASE_ACCESS_TOKEN
```

Retorna HTTP 200 com os dados de `empresa` e `usuario`. Token ausente, inválido ou expirado retorna HTTP 401; usuário sem vínculo retorna HTTP 403.

O middleware fica disponível para outras rotas. Em controllers protegidos, use `req.empresaAuth.id` como empresa autorizada. A API valida o token consultando Supabase Auth em cada requisição protegida; por isso a conexão HTTPS com o endpoint do Supabase precisa estar disponível.

## Sessão e segurança

O Supabase Auth verifica a senha e emite um access token JWT assinado. Bcrypt é usado internamente pelo Supabase Auth; não copie senha ou hash para as tabelas públicas. O JWT é assinado, não criptografado.

A tela guarda o access token em `sessionStorage`, ou em `localStorage` quando "Lembrar deste dispositivo" está marcado. Ainda não há renovação automática: quando o access token expirar, a pessoa precisa entrar novamente. Em ambiente publicado, sirva a tela por HTTPS para proteger a senha durante o envio.

## Testes

Ainda não há suíte automatizada configurada; `npm test` é um placeholder. O login bem-sucedido só pode ser testado depois de preencher as variáveis Supabase, criar uma conta Auth, associá-la a `public.usuarios.auth_id` e garantir acesso de leitura ao vínculo.
