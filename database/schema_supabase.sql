

-- 1) Tabelas base (versão multiempresa)


 
create table if not exists empresas (
 id bigint generated always as identity primary key,
 nome text not null,
 cnpj text unique
);
 
create table if not exists usuarios (
 id bigint generated always as identity primary key,
 empresa_id bigint not null references empresas(id),
 auth_id uuid unique references auth.users(id),  -- liga o usuário ao login do Supabase (opcional)
 nome text not null,
 cargo text
);
 
create table if not exists clientes (
 id bigint generated always as identity primary key,
 empresa_id bigint not null references empresas(id),
 nome text not null,
 cnpj_cpf text
);
 
create table if not exists estoques (
 id bigint generated always as identity primary key,
 empresa_id bigint not null references empresas(id),
 nome text not null,
 localizacao text
);
 
create table if not exists produtos (
 id bigint generated always as identity primary key,
 empresa_id bigint not null references empresas(id),
 sku text not null,  -- único dentro de cada empresa (índice na seção 6)
 nome text not null,
 preco numeric(12,2) not null default 0 check (preco >= 0),
 estoque_minimo integer not null default 0
);
 
-- 2) Pedidos e notas fiscais
 
create table if not exists pedidos (
 id bigint generated always as identity primary key,
 empresa_id bigint not null references empresas(id),
 cliente_id bigint not null references clientes(id),
 usuario_id bigint not null references usuarios(id),
 status text not null default 'aberto',
 data timestamptz not null default now()
);
 
create table if not exists notas_fiscais (
 id bigint generated always as identity primary key,
 pedido_id bigint not null unique references pedidos(id),  -- unique = relação 1:1
 numero text not null,
 chave_acesso text unique
);
 
-- 3) Itens das notas fiscais
 
create table if not exists itens_nf_venda (
 id bigint generated always as identity primary key,
 nota_fiscal_id bigint not null references notas_fiscais(id),
 produto_id bigint not null references produtos(id),
 quantidade integer not null check (quantidade > 0),
 preco_unitario numeric(12,2) not null default 0 check (preco_unitario >= 0)
);
 
create table if not exists itens_nf_compra (
 id bigint generated always as identity primary key,
 nota_fiscal_id bigint not null references notas_fiscais(id),
 produto_id bigint not null references produtos(id),
 quantidade integer not null check (quantidade > 0),
 preco_unitario numeric(12,2) not null default 0 check (preco_unitario >= 0)
);
 
create table if not exists itens_nf_pedido (
 id bigint generated always as identity primary key,
 nota_fiscal_id bigint not null references notas_fiscais(id),
 produto_id bigint not null references produtos(id),
 quantidade integer not null check (quantidade > 0),
 preco_unitario numeric(12,2) not null default 0 check (preco_unitario >= 0)
);
 
-- 4) Estoque por produto e recomposição
 
-- estoque_produto é o registro único de estoque: cada linha é uma movimentação.
-- tipo = entrada/saída, quantidade = quanto foi movimentado,
-- saldo_atual = saldo do produto nesse estoque DEPOIS da movimentação.
-- Por isso NÃO existe unique em (estoque_id, produto_id).
create table if not exists estoque_produto (
 id bigint generated always as identity primary key,
 estoque_id bigint not null references estoques(id),
 produto_id bigint not null references produtos(id),
 tipo text not null,
 quantidade integer not null,
 saldo_atual integer not null default 0,
 nota_fiscal_id bigint references notas_fiscais(id),  -- origem da movimentação (vazio em ajuste manual)
 usuario_id bigint references usuarios(id),  -- quem registrou
 data timestamptz not null default now()
);
 
create table if not exists recomposicao_estoque (
 id bigint generated always as identity primary key,
 estoque_id bigint not null references estoques(id),
 produto_id bigint not null references produtos(id),
 quantidade_sugerida integer not null,
 status text not null default 'pendente'
);
 
-- 5) Atualização de bancos criados com a versão antiga
-- Em um banco novo estes comandos não fazem nada (as colunas já existem).
-- Atenção: as colunas obrigatórias novas só podem ser criadas com as tabelas vazias.
 
alter table clientes add column if not exists cnpj_cpf text;
alter table usuarios add column if not exists auth_id uuid unique references auth.users(id);
 
alter table clientes add column if not exists empresa_id bigint not null references empresas(id);
alter table produtos add column if not exists empresa_id bigint not null references empresas(id);
alter table pedidos add column if not exists empresa_id bigint not null references empresas(id);
 
alter table produtos drop constraint if exists produtos_sku_key;
 
alter table produtos add column if not exists preco numeric(12,2) not null default 0 check (preco >= 0);
alter table itens_nf_venda add column if not exists preco_unitario numeric(12,2) not null default 0 check (preco_unitario >= 0);
alter table itens_nf_compra add column if not exists preco_unitario numeric(12,2) not null default 0 check (preco_unitario >= 0);
alter table itens_nf_pedido add column if not exists preco_unitario numeric(12,2) not null default 0 check (preco_unitario >= 0);
 
alter table recomposicao_estoque add column if not exists estoque_id bigint not null references estoques(id);
 
alter table estoque_produto add column if not exists nota_fiscal_id bigint references notas_fiscais(id);
alter table estoque_produto add column if not exists usuario_id bigint references usuarios(id);
alter table estoque_produto add column if not exists data timestamptz not null default now();
 
-- 6) Índices (deixam as consultas mais rápidas)
 
-- SKU e CNPJ/CPF únicos dentro de cada empresa
create unique index if not exists produtos_empresa_sku_idx on produtos(empresa_id, sku);
create unique index if not exists clientes_empresa_cnpj_cpf_idx on clientes(empresa_id, cnpj_cpf);
 
create index if not exists idx_usuarios_empresa on usuarios(empresa_id);
create index if not exists idx_clientes_empresa on clientes(empresa_id);
create index if not exists idx_produtos_empresa on produtos(empresa_id);
create index if not exists idx_estoques_empresa on estoques(empresa_id);
create index if not exists idx_pedidos_empresa on pedidos(empresa_id);
create index if not exists idx_pedidos_cliente on pedidos(cliente_id);
create index if not exists idx_pedidos_usuario on pedidos(usuario_id);
create index if not exists idx_itens_venda_nf on itens_nf_venda(nota_fiscal_id);
create index if not exists idx_itens_venda_produto on itens_nf_venda(produto_id);
create index if not exists idx_itens_compra_nf on itens_nf_compra(nota_fiscal_id);
create index if not exists idx_itens_compra_produto on itens_nf_compra(produto_id);
create index if not exists idx_itens_pedido_nf on itens_nf_pedido(nota_fiscal_id);
create index if not exists idx_itens_pedido_produto on itens_nf_pedido(produto_id);
create index if not exists idx_estoque_produto_estoque on estoque_produto(estoque_id);
create index if not exists idx_estoque_produto_produto on estoque_produto(produto_id);
create index if not exists idx_estoque_produto_nf on estoque_produto(nota_fiscal_id);
create index if not exists idx_estoque_produto_usuario on estoque_produto(usuario_id);
create index if not exists idx_recomposicao_estoque on recomposicao_estoque(estoque_id);
create index if not exists idx_recomposicao_produto on recomposicao_estoque(produto_id);
 
-- 7) Liga o RLS em todas as tabelas
 
alter table empresas enable row level security;
alter table usuarios enable row level security;
alter table clientes enable row level security;
alter table estoques enable row level security;
alter table produtos enable row level security;
alter table pedidos enable row level security;
alter table notas_fiscais enable row level security;
alter table itens_nf_venda enable row level security;
alter table itens_nf_compra enable row level security;
alter table itens_nf_pedido enable row level security;
alter table estoque_produto enable row level security;
alter table recomposicao_estoque enable row level security;