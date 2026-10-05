# KITA WMS TCC

API Express e tela web para autenticação de empresas. O login usa e-mail e senha da empresa; as senhas são comparadas com hashes bcrypt e a API emite JWTs para as rotas protegidas.

## O que está implementado

- Tela de login servida em `/` e `/login`.
- `POST /api/auth/login`: autentica uma empresa e devolve um JWT.
- `GET /api/auth/me`: exemplo de rota protegida; devolve a identidade contida no token.
- Middleware que verifica assinatura, tipo e validade do JWT.
- Pastas separadas por responsabilidade (routes, controller, service, model e middleware).
- Script SQL para adicionar e-mail e hash de senha à tabela `empresas`, a ser executado manualmente.

Ainda não há painel após o login, cadastro de empresas, recuperação de senha ou endpoints de estoque, pedidos e produtos. O link "Esqueceu a senha?" apenas informa que a recuperação ainda não está disponível.

## Estrutura atual

| Caminho | Responsabilidade |
| --- | --- |
| `src/server.js` | Inicializa o Express, serve a tela e registra as rotas da API. |
| `src/view/login.html` | Formulário de login. |
| `src/public/css/login.css` | Estilos da tela de login. |
| `src/public/js/login.js` | Envia o formulário, mostra estados de carregamento/erro/sucesso e guarda o token. |
| `src/routes/authRoutes.js` | Mapeia as rotas de autenticação. |
| `src/controller/authController.js` | Valida os campos e monta as respostas HTTP do login. |
| `src/service/authService.js` | Compara senha com bcrypt e cria o JWT. |
| `src/model/empresaModel.js` | Consulta a empresa no PostgreSQL. |
| `src/middleware/autenticarEmpresa.js` | Verifica o JWT e identifica a empresa nas rotas protegidas. |
| `src/config/database.js` | Configura o pool de conexões PostgreSQL usando variáveis do `.env`. |
| `database/dbeaver_login_empresa.sql` | SQL para execução manual no banco local. |

## Requisitos e configuração local

Requisitos: Node.js, npm e um PostgreSQL local com o banco que será usado pelo projeto. A aplicação não cria bancos e não executa migrações automaticamente.

Instale as dependências e crie o arquivo local `.env` com base no exemplo:

```powershell
npm install
Copy-Item .env.example .env
```

Edite `.env` e preencha os dados do **banco existente**:

```dotenv
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nome_do_banco_existente
DB_USER=usuario_postgres
DB_PASSWORD=senha_postgres
JWT_SECRET=troque_por_um_segredo_aleatorio_longo
JWT_EXPIRES_IN=8h
```

Gere um segredo JWT aleatório no terminal, em vez de usar o texto de exemplo:

```powershell
node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(64).toString('hex'))"
```

Copie o resultado para `JWT_SECRET`. Não compartilhe nem versione `.env`; ele já está ignorado pelo Git. `JWT_EXPIRES_IN` aceita a duração entendida pela biblioteca `jsonwebtoken`; o padrão no código é `8h`.

## Preparar a tabela `empresas`

Depois que a equipe aprovar a alteração do esquema, conecte o DBeaver ao banco local correto e execute manualmente `database/dbeaver_login_empresa.sql`. O script adiciona `email`, `senha_hash` e um índice único que não diferencia maiúsculas de minúsculas. Ele altera somente a tabela `empresas` do banco selecionado.

O script não cria um banco, não cadastra uma empresa e não é executado pela API. Para preparar o acesso da empresa:

1. Gere um hash bcrypt para a senha (não guarde a senha em texto puro):

   ```powershell
   node --input-type=module -e "import bcrypt from 'bcryptjs'; console.log(await bcrypt.hash('SUA_SENHA', 12))"
   ```

2. No arquivo SQL, descomente o `UPDATE` de exemplo e substitua o e-mail, o hash gerado e o ID real da empresa.
3. Execute o `UPDATE` no DBeaver.

O usuário PostgreSQL configurado em `.env` precisa conseguir consultar a empresa. Como o esquema usa RLS, uma política ou configuração de permissões incompatível pode ocultar a linha durante o login.

## Executar

Inicie o servidor em modo de desenvolvimento:

```powershell
npm run dev
```

O comando usa nodemon para reiniciar o servidor quando arquivos JavaScript mudarem. Se o PowerShell bloquear `npm.ps1`, tente `npm.cmd run dev`. Para iniciar sem nodemon, use `npm start`.

Abra `http://localhost:3000/` ou `http://localhost:3000/login` para acessar a tela. O CSS e o JavaScript do navegador são servidos em `/public`.

## Testes

Ainda não há uma suíte de testes automatizados configurada. O script `npm test` do `package.json` é apenas um placeholder e termina com erro. Para conferir manualmente a API, use um cliente HTTP como Postman ou PowerShell. O login com sucesso requer o banco configurado, a alteração aprovada/aplicada e credenciais cadastradas.

## API

### `POST /api/auth/login`

Autentica a empresa. E-mail não diferencia maiúsculas de minúsculas; a senha diferencia.

Requisição:

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "contato@empresa.com",
  "senha": "senha da empresa"
}
```

Em caso de sucesso, retorna HTTP 200:

```json
{
  "mensagem": "Login da empresa realizado com sucesso.",
  "token": "SEU_JWT_AQUI",
  "empresa": {
    "id": "1",
    "nome": "Minha Empresa",
    "email": "contato@empresa.com"
  }
}
```

Respostas de erro:

| HTTP | Significado |
| --- | --- |
| 400 | JSON inválido, e-mail/senha ausente ou entrada fora dos limites aceitos. |
| 401 | E-mail ou senha não correspondem a uma empresa. |
| 500 | Falha de configuração, conexão/consulta ao banco ou erro interno. |

O endpoint precisa que o banco exista, que `empresas.email` e `empresas.senha_hash` estejam disponíveis, que a empresa tenha credenciais cadastradas e que `JWT_SECRET` esteja definido.

### `GET /api/auth/me`

Exemplo de endpoint protegido. Envie o JWT no cabeçalho `Authorization`:

```http
GET /api/auth/me
Authorization: Bearer SEU_TOKEN
```

Resposta esperada (HTTP 200):

```json
{
  "empresa": {
    "id": "1",
    "nome": "Minha Empresa"
  }
}
```

Sem token, com token inválido ou expirado, retorna HTTP 401. Se `JWT_SECRET` estiver ausente, retorna HTTP 500. Essa rota de exemplo usa os dados assinados no JWT; ela não consulta novamente a empresa no banco.

Para futuras rotas privadas, use `autenticarEmpresa` como middleware e filtre consultas com `req.empresaAuth.id`. Não confie em um `empresa_id` enviado pelo navegador para definir a empresa autorizada.

## Senha e token

Bcrypt é um hash de mão única, não uma criptografia que possa ser revertida. No login, `bcrypt.compare` confere a senha recebida contra o hash salvo no banco. O JWT é assinado, não criptografado: não inclua senhas nem segredos em seu conteúdo. O prazo padrão do token é de 8 horas.

Na tela, o token fica em `sessionStorage` por padrão; se "Lembrar deste dispositivo" estiver marcada, fica em `localStorage`. A recuperação de senha ainda não existe. Em ambiente publicado, use HTTPS para proteger as credenciais durante o envio.
