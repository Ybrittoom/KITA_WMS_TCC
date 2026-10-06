-- KITA WMS: esquema multiempresa simplificado (PostgreSQL / Supabase)
-- Execute em um banco NOVO/vazio, uma unica vez, pelo DBeaver.
-- Este arquivo nao apaga nem migra dados. Se ja houver tabelas, use outro banco.
-- Cada empresa e a conta de login: empresas.email + empresas.senha_hash.
-- Nunca grave senha em texto puro. O exemplo de cadastro ao final gera bcrypt.

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Conta que entra na tela de login.
CREATE TABLE public.empresas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome text NOT NULL,
  cnpj text UNIQUE,
  email text NOT NULL,
  senha_hash text NOT NULL,
  criada_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX empresas_email_lower_uidx ON public.empresas (lower(email));

-- Pessoas da empresa para autoria de pedidos/movimentacoes; nao fazem login.
CREATE TABLE public.usuarios (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  nome text NOT NULL,
  cargo text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, empresa_id)
);
CREATE INDEX usuarios_empresa_idx ON public.usuarios (empresa_id);

CREATE TABLE public.clientes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  nome text NOT NULL,
  cnpj_cpf text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, empresa_id)
);
CREATE UNIQUE INDEX clientes_empresa_documento_uidx
  ON public.clientes (empresa_id, cnpj_cpf) WHERE cnpj_cpf IS NOT NULL;
CREATE INDEX clientes_empresa_idx ON public.clientes (empresa_id);

CREATE TABLE public.estoques (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  nome text NOT NULL,
  localizacao text,
  UNIQUE (id, empresa_id)
);
CREATE INDEX estoques_empresa_idx ON public.estoques (empresa_id);

CREATE TABLE public.produtos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  sku text NOT NULL,
  nome text NOT NULL,
  preco numeric(12,2) NOT NULL DEFAULT 0 CHECK (preco >= 0),
  estoque_minimo integer NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
  UNIQUE (id, empresa_id),
  UNIQUE (empresa_id, sku)
);
CREATE INDEX produtos_empresa_idx ON public.produtos (empresa_id);

CREATE TABLE public.pedidos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  cliente_id bigint NOT NULL REFERENCES public.clientes(id),
  usuario_id bigint NOT NULL REFERENCES public.usuarios(id),
  status text NOT NULL DEFAULT 'aberto',
  data timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, empresa_id)
);
CREATE INDEX pedidos_empresa_idx ON public.pedidos (empresa_id);

CREATE TABLE public.notas_fiscais (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  pedido_id bigint REFERENCES public.pedidos(id),
  tipo text NOT NULL CHECK (tipo IN ('venda', 'compra', 'pedido')),
  numero text NOT NULL,
  chave_acesso text,
  criada_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, tipo, numero),
  UNIQUE (empresa_id, chave_acesso)
);
CREATE INDEX notas_fiscais_empresa_idx ON public.notas_fiscais (empresa_id);

-- Itens fiscais compartilham a mesma estrutura; tipo da nota define a operacao.
CREATE TABLE public.itens_nf (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  nota_fiscal_id bigint NOT NULL REFERENCES public.notas_fiscais(id),
  produto_id bigint NOT NULL REFERENCES public.produtos(id),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  preco_unitario numeric(12,2) NOT NULL DEFAULT 0 CHECK (preco_unitario >= 0)
);
CREATE INDEX itens_nf_empresa_idx ON public.itens_nf (empresa_id);
CREATE INDEX itens_nf_nota_idx ON public.itens_nf (nota_fiscal_id);
CREATE INDEX itens_nf_produto_idx ON public.itens_nf (produto_id);

-- Cada linha e uma movimentacao; saldo_atual e o saldo apos a movimentacao.
CREATE TABLE public.estoque_produto (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  estoque_id bigint NOT NULL REFERENCES public.estoques(id),
  produto_id bigint NOT NULL REFERENCES public.produtos(id),
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste')),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  saldo_atual integer NOT NULL DEFAULT 0 CHECK (saldo_atual >= 0),
  nota_fiscal_id bigint REFERENCES public.notas_fiscais(id),
  usuario_id bigint REFERENCES public.usuarios(id),
  data timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX estoque_produto_empresa_idx ON public.estoque_produto (empresa_id);
CREATE INDEX estoque_produto_estoque_idx ON public.estoque_produto (estoque_id);
CREATE INDEX estoque_produto_produto_idx ON public.estoque_produto (produto_id);

CREATE TABLE public.recomposicao_estoque (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  estoque_id bigint NOT NULL REFERENCES public.estoques(id),
  produto_id bigint NOT NULL REFERENCES public.produtos(id),
  quantidade_sugerida integer NOT NULL CHECK (quantidade_sugerida > 0),
  status text NOT NULL DEFAULT 'pendente'
);
CREATE INDEX recomposicao_empresa_idx ON public.recomposicao_estoque (empresa_id);

-- Bloqueia acesso direto anon/authenticated pela API REST do Supabase.
-- A API Node conecta pelo PostgreSQL e filtra cada consulta por empresa_id.
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_nf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_produto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recomposicao_estoque ENABLE ROW LEVEL SECURITY;

COMMIT;

-- CADASTRO MANUAL DE UMA EMPRESA E SUA CONTA DE LOGIN (execute separadamente)
-- Troque todos os exemplos. A senha vira hash bcrypt; nunca remova crypt().
-- Nao salve uma senha real neste arquivo nem no historico de consultas do DBeaver.
--
-- INSERT INTO public.empresas (nome, cnpj, email, senha_hash)
-- VALUES (
--   'Nome da empresa',
--   'CNPJ',
--   lower('email@empresa.com'),
--   extensions.crypt('SENHA_TEMPORARIA_FORTE', extensions.gen_salt('bf', 12))
-- );
--
-- Para criar outra empresa, execute outro INSERT com email e CNPJ proprios.
-- Os funcionarios (usuarios) sao registros internos, nao contas de login.
