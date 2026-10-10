# KITA WMS TCC

Aplicação Node.js/Express com login de empresa, cadastro e listagem de produtos, e banco PostgreSQL multiempresa. O desenvolvimento local usa o PostgreSQL instalado no computador; o DBeaver conecta ao banco para executar SQL e consultar dados. A publicação planejada usa Supabase para hospedar o PostgreSQL e Render para hospedar a API.

## Login e isolamento por empresa

Cada empresa entra com e-mail e senha cadastrados em `public.empresas`. A senha é armazenada como hash bcrypt (`senha_hash`) e o backend emite um JWT após validar as credenciais. Não existe cadastro público de empresa.

O ID da empresa usado nas operações protegidas vem do JWT validado no servidor. O navegador não escolhe nem envia o `empresa_id` que será usado no cadastro. `public.usuarios` representa funcionários relacionados a pedidos e movimentações; nessa versão eles não fazem login.

## Banco de dados

O DBeaver é um cliente SQL: conecte-o ao PostgreSQL local e crie um banco vazio, por exemplo `kita_wms_tcc`. Depois, execute uma única vez `database/schema_simples.sql` nesse banco. O script cria as tabelas do WMS, índices e regras básicas e ativa RLS. Ele não apaga nem migra tabelas existentes; use um banco vazio.

Para cadastrar uma empresa, abra `database/dbeaver_cadastro_empresa.sql`, substitua os exemplos e execute o `INSERT`. A senha é transformada em hash bcrypt pela função `pgcrypto`. Não salve senhas reais no arquivo, no Git ou no histórico do DBeaver.

Para conferir as empresas cadastradas sem exibir os hashes:

```sql
SELECT id, nome, cnpj, email
FROM public.empresas
ORDER BY id;
```

## Configuração local

No `.env`, use as credenciais do PostgreSQL local. Exemplo:

```dotenv
PORT=8081
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kita_wms_tcc
DB_USER=postgres
DB_PASSWORD=senha_do_postgres_local
DB_SSL=false
JWT_SECRET=segredo-aleatorio-com-pelo-menos-32-caracteres
JWT_EXPIRES_IN=8h
```

`DB_PASSWORD` é a senha da conexão PostgreSQL, não a senha da empresa. Gere um segredo JWT aleatório com:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Não compartilhe nem publique `.env`, `DB_PASSWORD` ou `JWT_SECRET`. Este fluxo não usa Supabase Auth nem precisa de `SUPABASE_URL`/`SUPABASE_ANON_KEY`.

## Rodar e testar localmente

```powershell
npm install
npm run dev
```

Abra `http://localhost:8081/login` e entre com uma empresa cadastrada. O endpoint `POST /api/auth/login` recebe `{ "email": "...", "senha": "..." }`. `GET /api/auth/me` retorna a empresa autenticada e exige `Authorization: Bearer <token>`.

Depois do login, acesse **manualmente**, na mesma aba e no mesmo navegador, `http://localhost:8081/produtos/cadastro`. Essa página não é ligada à tela de login e não há redirecionamento após entrar. Sem sessão válida, a página retorna para o login.

### Cadastro de produtos

As rotas estão organizadas em MVC + service:

| Arquivo | Responsabilidade |
| --- | --- |
| `src/routes/produtoRoutes.js` | Define as rotas protegidas de produtos. |
| `src/controller/produtoController.js` | Trata requisições e respostas HTTP. |
| `src/service/produtoService.js` | Valida nome, SKU, preço e estoque mínimo; trata SKU duplicado e inativação. |
| `src/model/produtoModel.js` | Consulta, grava, atualiza e inativa em `public.produtos`, sempre no escopo da empresa autenticada. |
| `src/view/cadastroProduto.html` | Tela acessada manualmente em `/produtos/cadastro`. |
| `src/public/js/cadastroProduto.js` | Envia o JWT, carrega a lista e envia o formulário. |

Endpoints:

- `GET /api/produtos`: lista os produtos da empresa autenticada.
- `POST /api/produtos`: cadastra produto com `nome`, `sku`, `preco` e `estoque_minimo`.
- `PUT /api/produtos/:id`: atualiza os campos do produto ativo daquela empresa.
- `DELETE /api/produtos/:id`: inativa o produto, sem apagar o histórico.

Todas as rotas exigem JWT. O SKU é convertido para maiúsculas e deve ser único dentro da empresa. Ao excluir, o produto recebe `ativo = false`; ele some da lista ativa, mas suas referências históricas são preservadas e o SKU continua reservado. A tela lista preço e estoque mínimo; o saldo atual depende de futuras movimentações de estoque.

Para conferir os produtos no DBeaver:

```sql
SELECT id, empresa_id, sku, nome, preco, estoque_minimo
FROM public.produtos
ORDER BY id DESC;
```

## Publicar depois no Supabase e Render

1. Crie um projeto Supabase novo para não misturar o banco local ou tabelas antigas.
2. Execute `database/schema_simples.sql` no PostgreSQL do projeto e cadastre nele as empresas necessárias. O DBeaver pode conectar ao Supabase, ou você pode usar o SQL Editor do painel.
3. Configure no Render `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL=true`, `DB_SSL_CA`, `JWT_SECRET` e `JWT_EXPIRES_IN`. O Render fornece `PORT`.
4. Baixe o certificado CA em **Database → SSL Configuration**. Disponibilize o arquivo ao serviço Render e configure `DB_SSL_CA` com o caminho correto. Nunca publique senha do banco ou segredo JWT.
5. Use Build Command `npm install` e Start Command `npm start` no Web Service do Render.

## Limitações atuais

O sistema tem login, a rota `/api/auth/me` e cadastro/listagem/edição/inativação de produtos. Ainda não implementa cadastro de empresa pelo site, recuperação de senha, logout, renovação do JWT, reativação de produtos, saldo de estoque ou endpoints de clientes e pedidos. Cada empresa compartilha uma conta de login; contas individuais de funcionários exigiriam uma evolução futura.

`npm test` ainda é apenas um placeholder, sem suíte automatizada.
