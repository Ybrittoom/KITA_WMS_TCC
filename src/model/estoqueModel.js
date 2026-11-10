import pool from "../config/database.js";

/**
 * Lista os locais de estoque pertencentes a uma empresa.
 * O ID da empresa sempre chega do JWT validado, nunca do navegador.
 */
export async function listarLocaisDaEmpresa(empresaId) {
  const resultado = await pool.query(
    `SELECT id, nome, localizacao
     FROM public.estoques
     WHERE empresa_id = $1
     ORDER BY nome ASC, id ASC`,
    [empresaId]
  );

  return resultado.rows;
}

/** Cria um local vinculado ao tenant atual. */
export async function inserirLocalDaEmpresa(empresaId, local) {
  const resultado = await pool.query(
    `INSERT INTO public.estoques (empresa_id, nome, localizacao)
     VALUES ($1, $2, $3)
     RETURNING id, nome, localizacao`,
    [empresaId, local.nome, local.localizacao]
  );

  return resultado.rows[0];
}

/** Verifica se um local existe e pertence à empresa da sessão. */
export async function buscarLocalDaEmpresa(empresaId, estoqueId) {
  const resultado = await pool.query(
    `SELECT id, nome, localizacao
     FROM public.estoques
     WHERE id = $1 AND empresa_id = $2
     LIMIT 1`,
    [estoqueId, empresaId]
  );

  return resultado.rows[0] ?? null;
}

/**
 * Lista o saldo mais recente de cada produto ativo no local escolhido.
 * Cada movimentacao guarda o saldo depois daquele movimento; por isso basta
 * buscar o ultimo registro por produto/local, em vez de somar todo o historico.
 */
export async function listarSaldosDoLocal(empresaId, estoqueId) {
  const resultado = await pool.query(
    `SELECT
       p.id AS produto_id,
       p.sku,
       p.nome AS produto_nome,
       p.estoque_minimo,
       COALESCE(ultima_movimentacao.saldo_atual, 0) AS saldo_atual
     FROM public.produtos AS p
     LEFT JOIN LATERAL (
       SELECT ep.saldo_atual
       FROM public.estoque_produto AS ep
       WHERE ep.empresa_id = $1
         AND ep.estoque_id = $2
         AND ep.produto_id = p.id
       ORDER BY ep.id DESC
       LIMIT 1
     ) AS ultima_movimentacao ON true
     WHERE p.empresa_id = $1 AND p.ativo = true
     ORDER BY p.nome ASC, p.id ASC`,
    [empresaId, estoqueId]
  );

  return resultado.rows;
}

/**
 * Lista as movimentacoes recentes de um local, incluindo dados legiveis do produto.
 * O limite evita devolver todo o historico de uma vez para a pagina.
 */
export async function listarMovimentacoesDoLocal(empresaId, estoqueId) {
  const resultado = await pool.query(
    `SELECT
       ep.id,
       ep.produto_id,
       p.sku,
       p.nome AS produto_nome,
       ep.tipo,
       ep.quantidade,
       ep.saldo_atual,
       ep.data
     FROM public.estoque_produto AS ep
     JOIN public.produtos AS p
       ON p.id = ep.produto_id AND p.empresa_id = ep.empresa_id
     WHERE ep.empresa_id = $1 AND ep.estoque_id = $2
     ORDER BY ep.id DESC
     LIMIT 100`,
    [empresaId, estoqueId]
  );

  return resultado.rows;
}

/** Busca o historico geral da empresa com filtros opcionais e limite seguro. */
export async function listarHistoricoDaEmpresa(empresaId, filtros) {
  const condicoes = ["ep.empresa_id = $1"];
  const valores = [empresaId];
  const adicionarFiltro = (sql, valor) => {
    valores.push(valor);
    condicoes.push(sql.replace("?", `$${valores.length}`));
  };

  if (filtros.tipo) adicionarFiltro("ep.tipo = ?", filtros.tipo);
  if (filtros.busca) {
    valores.push(`%${filtros.busca}%`);
    condicoes.push(`(p.nome ILIKE $${valores.length} OR p.sku ILIKE $${valores.length})`);
  }
  if (filtros.dataInicio) adicionarFiltro("ep.data::date >= ?::date", filtros.dataInicio);
  if (filtros.dataFim) adicionarFiltro("ep.data::date <= ?::date", filtros.dataFim);
  valores.push(filtros.limite);

  const resultado = await pool.query(
    `SELECT ep.id, ep.estoque_id, e.nome AS local_nome, ep.produto_id,
            p.nome AS produto_nome, p.sku, ep.tipo, ep.quantidade,
            ep.saldo_atual, ep.data
     FROM public.estoque_produto AS ep
     JOIN public.produtos AS p
       ON p.id = ep.produto_id AND p.empresa_id = ep.empresa_id
     JOIN public.estoques AS e
       ON e.id = ep.estoque_id AND e.empresa_id = ep.empresa_id
     WHERE ${condicoes.join(" AND ")}
     ORDER BY ep.id DESC
     LIMIT $${valores.length}`,
    valores
  );
  return resultado.rows;
}

/** Resume os saldos em todos os locais e devolve as movimentacoes recentes. */
export async function buscarResumoDashboard(empresaId) {
  const resumo = await pool.query(
    `WITH ultimos_saldos AS (
       SELECT DISTINCT ON (ep.estoque_id, ep.produto_id)
              ep.estoque_id, ep.produto_id, ep.saldo_atual
       FROM public.estoque_produto AS ep
       WHERE ep.empresa_id = $1
       ORDER BY ep.estoque_id, ep.produto_id, ep.id DESC
     ), totais_produtos AS (
       SELECT p.id, p.estoque_minimo,
              COALESCE(SUM(us.saldo_atual), 0)::bigint AS saldo
       FROM public.produtos AS p
       LEFT JOIN ultimos_saldos AS us ON us.produto_id = p.id
       WHERE p.empresa_id = $1 AND p.ativo = true
       GROUP BY p.id, p.estoque_minimo
     )
     SELECT
       (SELECT COUNT(*) FROM public.produtos WHERE empresa_id = $1 AND ativo = true) AS produtos,
       (SELECT COUNT(*) FROM public.estoques WHERE empresa_id = $1) AS locais,
       COALESCE((SELECT SUM(saldo) FROM totais_produtos), 0) AS unidades,
       (SELECT COUNT(*) FROM totais_produtos WHERE saldo <= estoque_minimo) AS estoque_baixo,
       COALESCE((SELECT SUM(quantidade) FROM public.estoque_produto
         WHERE empresa_id = $1 AND tipo = 'entrada'
           AND data >= (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')), 0) AS entradas_hoje,
       COALESCE((SELECT SUM(quantidade) FROM public.estoque_produto
         WHERE empresa_id = $1 AND tipo = 'saida'
           AND data >= (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')), 0) AS saidas_hoje`,
    [empresaId]
  );

  const recentes = await pool.query(
    `SELECT ep.id, ep.tipo, ep.quantidade, ep.saldo_atual, ep.data,
            p.nome AS produto_nome, p.sku, e.nome AS local_nome
     FROM public.estoque_produto AS ep
     JOIN public.produtos AS p ON p.id = ep.produto_id AND p.empresa_id = ep.empresa_id
     JOIN public.estoques AS e ON e.id = ep.estoque_id AND e.empresa_id = ep.empresa_id
     WHERE ep.empresa_id = $1
     ORDER BY ep.id DESC
     LIMIT 6`,
    [empresaId]
  );

  return { ...resumo.rows[0], recentes: recentes.rows };
}

/** Devolve os enderecos fisicos e o produto atualmente guardado em cada um. */
export async function listarEnderecosDoMapa(empresaId, estoqueId) {
  const resultado = await pool.query(
    `SELECT e.id, e.corredor, e.estante, e.prateleira, e.posicao, e.nome,
            p.id AS produto_id, p.nome AS produto_nome, p.sku
     FROM public.enderecos_estoque AS e
     LEFT JOIN public.produto_enderecos AS pe
       ON pe.endereco_id = e.id AND pe.empresa_id = e.empresa_id
      AND pe.estoque_id = e.estoque_id
     LEFT JOIN public.produtos AS p
       ON p.id = pe.produto_id AND p.empresa_id = pe.empresa_id
     WHERE e.empresa_id = $1 AND e.estoque_id = $2
     ORDER BY e.corredor, e.estante, e.prateleira, e.posicao, e.id`,
    [empresaId, estoqueId]
  );
  return resultado.rows;
}

/** Cria um endereco fisico dentro de um local pertencente a empresa. */
export async function inserirEndereco(empresaId, estoqueId, endereco) {
  const resultado = await pool.query(
    `INSERT INTO public.enderecos_estoque
       (empresa_id, estoque_id, corredor, estante, prateleira, posicao, nome)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, corredor, estante, prateleira, posicao, nome`,
    [empresaId, estoqueId, endereco.corredor, endereco.estante,
      endereco.prateleira, endereco.posicao, endereco.nome]
  );
  return resultado.rows[0];
}

/** Renomeia os componentes de um endereco, sem alterar o produto armazenado. */
export async function atualizarEndereco(empresaId, enderecoId, endereco) {
  const resultado = await pool.query(
    `UPDATE public.enderecos_estoque
     SET corredor = $3, estante = $4, prateleira = $5, posicao = $6, nome = $7
     WHERE id = $1 AND empresa_id = $2
     RETURNING id, corredor, estante, prateleira, posicao, nome`,
    [enderecoId, empresaId, endereco.corredor, endereco.estante,
      endereco.prateleira, endereco.posicao, endereco.nome]
  );
  return resultado.rows[0] ?? null;
}

/** Remove um endereco apenas se ainda nao houver produto associado. */
export async function excluirEndereco(empresaId, enderecoId) {
  const resultado = await pool.query(
    `DELETE FROM public.enderecos_estoque AS e
     WHERE e.id = $1 AND e.empresa_id = $2
       AND NOT EXISTS (
         SELECT 1 FROM public.produto_enderecos AS pe
         WHERE pe.endereco_id = e.id AND pe.empresa_id = e.empresa_id
       )
     RETURNING e.id`,
    [enderecoId, empresaId]
  );
  return resultado.rowCount > 0;
}

/** Move um produto para uma posicao, substituindo seu endereco anterior no mesmo local. */
export async function moverProdutoParaEndereco(empresaId, estoqueId, enderecoId, produtoId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const endereco = await client.query(
      `SELECT id FROM public.enderecos_estoque
       WHERE id = $1 AND estoque_id = $2 AND empresa_id = $3 FOR UPDATE`,
      [enderecoId, estoqueId, empresaId]
    );
    if (!endereco.rowCount) {
      await client.query("ROLLBACK");
      return { tipo: "endereco" };
    }

    const produto = await client.query(
      `SELECT id FROM public.produtos
       WHERE id = $1 AND empresa_id = $2 AND ativo = true`,
      [produtoId, empresaId]
    );
    if (!produto.rowCount) {
      await client.query("ROLLBACK");
      return { tipo: "produto" };
    }

    // Um endereco aceita um produto e um produto tem uma posicao principal por local.
    const ocupado = await client.query(
      `SELECT produto_id FROM public.produto_enderecos
       WHERE empresa_id = $1 AND estoque_id = $2 AND endereco_id = $3
       FOR UPDATE`,
      [empresaId, estoqueId, enderecoId]
    );
    if (ocupado.rowCount && String(ocupado.rows[0].produto_id) !== String(produtoId)) {
      await client.query("ROLLBACK");
      return { tipo: "ocupado" };
    }

    await client.query(
      `DELETE FROM public.produto_enderecos
       WHERE empresa_id = $1 AND estoque_id = $2 AND produto_id = $3`,
      [empresaId, estoqueId, produtoId]
    );
    await client.query(
      `INSERT INTO public.produto_enderecos (empresa_id, estoque_id, produto_id, endereco_id)
       VALUES ($1, $2, $3, $4)`,
      [empresaId, estoqueId, produtoId, enderecoId]
    );
    await client.query("COMMIT");
    return { tipo: "ok" };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    // A restricao unica tambem protege duas movimentacoes concorrentes.
    if (error.code === "23505") return { tipo: "ocupado" };
    throw error;
  } finally {
    client.release();
  }
}

/** Desassocia o produto do endereco sem excluir o cadastro do produto. */
export async function retirarProdutoDoEndereco(empresaId, estoqueId, enderecoId) {
  const resultado = await pool.query(
    `DELETE FROM public.produto_enderecos
     WHERE empresa_id = $1 AND estoque_id = $2 AND endereco_id = $3
     RETURNING produto_id`,
    [empresaId, estoqueId, enderecoId]
  );
  return resultado.rowCount > 0;
}

/**
 * Faz uma movimentacao como transacao atomica e serializa movimentos do mesmo local.
 * O callback calcula o saldo novo dentro da transacao, depois da leitura protegida.
 */
export async function inserirMovimentacaoDaEmpresa(empresaId, dados, calcularNovoSaldo) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // O bloqueio do local faz duas operacoes simultaneas nesse local esperarem sua vez.
    const local = await client.query(
      `SELECT id
       FROM public.estoques
       WHERE id = $1 AND empresa_id = $2
       FOR UPDATE`,
      [dados.estoque_id, empresaId]
    );

    if (local.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    // O bloqueio compartilhado evita inativacao/edicao concorrente durante o registro.
    const produto = await client.query(
      `SELECT id
       FROM public.produtos
       WHERE id = $1 AND empresa_id = $2 AND ativo = true
       FOR SHARE`,
      [dados.produto_id, empresaId]
    );

    if (produto.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    // Se ainda nao houve movimento deste produto neste local, o saldo inicial e zero.
    const movimentoAnterior = await client.query(
      `SELECT saldo_atual
       FROM public.estoque_produto
       WHERE empresa_id = $1 AND estoque_id = $2 AND produto_id = $3
       ORDER BY id DESC
       LIMIT 1`,
      [empresaId, dados.estoque_id, dados.produto_id]
    );
    const saldoAtual = movimentoAnterior.rowCount === 0
      ? 0
      : Number(movimentoAnterior.rows[0].saldo_atual);

    // O service aplica a regra de entrada/saida e pode abortar se faltar saldo.
    const saldoNovo = calcularNovoSaldo(saldoAtual);
    const resultado = await client.query(
      `INSERT INTO public.estoque_produto
         (empresa_id, estoque_id, produto_id, tipo, quantidade, saldo_atual)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, estoque_id, produto_id, tipo, quantidade,
                 saldo_atual, data`,
      [
        empresaId,
        dados.estoque_id,
        dados.produto_id,
        dados.tipo,
        dados.quantidade,
        saldoNovo,
      ]
    );

    await client.query("COMMIT");
    return resultado.rows[0];
  } catch (error) {
    // Se qualquer etapa falhar, desfaz a operacao para nao deixar saldo pela metade.
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    // Devolve a conexao ao pool tanto no sucesso quanto no erro.
    client.release();
  }
}
