import pool from "../config/database.js";

/**
 * Lista apenas produtos ativos da empresa autenticada.
 * O filtro por empresa_id impede que a consulta misture dados de outras empresas.
 */
export async function listarProdutosPorEmpresa(empresaId) {
  const resultado = await pool.query(
    `SELECT id, sku, nome, preco, estoque_minimo
     FROM public.produtos
     WHERE empresa_id = $1 AND ativo = true
     ORDER BY nome ASC, id ASC`,
    [empresaId]
  );

  return resultado.rows;
}

/**
 * Insere um produto usando o ID da empresa obtido do token validado.
 * empresa_id nao vem dos dados enviados pelo navegador.
 */
export async function inserirProduto(empresaId, produto) {
  const resultado = await pool.query(
    `INSERT INTO public.produtos (empresa_id, sku, nome, preco, estoque_minimo, ativo)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id, sku, nome, preco, estoque_minimo`,
    [empresaId, produto.sku, produto.nome, produto.preco, produto.estoque_minimo]
  );

  return resultado.rows[0];
}

/**
 * Atualiza os dados de um produto ativo somente quando ele pertence a empresa
 * autenticada. Retorna null se o produto nao existir, estiver inativo ou for de
 * outra empresa.
 */
export async function atualizarProdutoDaEmpresa(empresaId, produtoId, produto) {
  const resultado = await pool.query(
    `UPDATE public.produtos
     SET sku = $3, nome = $4, preco = $5, estoque_minimo = $6
     WHERE id = $1 AND empresa_id = $2 AND ativo = true
     RETURNING id, sku, nome, preco, estoque_minimo`,
    [produtoId, empresaId, produto.sku, produto.nome, produto.preco, produto.estoque_minimo]
  );

  return resultado.rows[0] ?? null;
}

/**
 * Marca o produto como inativo em vez de apagar a linha. Assim, notas e
 * movimentacoes antigas continuam apontando para o mesmo produto.
 */
export async function inativarProdutoDaEmpresa(empresaId, produtoId) {
  const resultado = await pool.query(
    `UPDATE public.produtos
     SET ativo = false
     WHERE id = $1 AND empresa_id = $2 AND ativo = true
     RETURNING id, nome`,
    [produtoId, empresaId]
  );

  return resultado.rows[0] ?? null;
}
