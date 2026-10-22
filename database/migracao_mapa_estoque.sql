-- KITA WMS: enderecamento visual de produtos em cada local de estoque.
-- Execute uma unica vez no banco que ja contem o schema_simples.sql.
-- Esta migracao cria tabelas novas e preserva produtos e movimentacoes existentes.

BEGIN;

CREATE TABLE public.enderecos_estoque (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id bigint NOT NULL,
  estoque_id bigint NOT NULL,
  corredor text NOT NULL,
  estante text NOT NULL,
  prateleira text NOT NULL,
  posicao text NOT NULL,
  nome text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, empresa_id, estoque_id),
  UNIQUE (empresa_id, estoque_id, corredor, estante, prateleira, posicao),
  FOREIGN KEY (estoque_id, empresa_id)
    REFERENCES public.estoques (id, empresa_id) ON DELETE RESTRICT,
  CHECK (length(trim(corredor)) BETWEEN 1 AND 40),
  CHECK (length(trim(estante)) BETWEEN 1 AND 40),
  CHECK (length(trim(prateleira)) BETWEEN 1 AND 40),
  CHECK (length(trim(posicao)) BETWEEN 1 AND 40),
  CHECK (nome IS NULL OR length(trim(nome)) <= 100)
);
CREATE INDEX enderecos_estoque_empresa_idx
  ON public.enderecos_estoque (empresa_id, estoque_id);

-- Cada produto tem uma posicao principal por local. A mudanca de endereco
-- preserva o produto e nao altera o saldo total nem o historico de movimentos.
CREATE TABLE public.produto_enderecos (
  empresa_id bigint NOT NULL,
  estoque_id bigint NOT NULL,
  produto_id bigint NOT NULL,
  endereco_id bigint NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, estoque_id, produto_id),
  UNIQUE (empresa_id, estoque_id, endereco_id),
  FOREIGN KEY (estoque_id, empresa_id)
    REFERENCES public.estoques (id, empresa_id) ON DELETE RESTRICT,
  FOREIGN KEY (produto_id, empresa_id)
    REFERENCES public.produtos (id, empresa_id) ON DELETE RESTRICT,
  FOREIGN KEY (endereco_id, empresa_id, estoque_id)
    REFERENCES public.enderecos_estoque (id, empresa_id, estoque_id) ON DELETE RESTRICT
);
CREATE INDEX produto_enderecos_endereco_idx
  ON public.produto_enderecos (empresa_id, estoque_id, endereco_id);

ALTER TABLE public.enderecos_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_enderecos ENABLE ROW LEVEL SECURITY;

COMMIT;
