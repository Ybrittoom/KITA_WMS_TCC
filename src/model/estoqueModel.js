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
       RETURNING id, estoque_id, produto_id, tipo, quantidade, saldo_atual, data`,
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
