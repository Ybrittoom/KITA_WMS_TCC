import pool from "../config/database.js";

/** Lista somente produtos pertencentes a empresa autenticada. */
export async function listarProdutosPorEmpresa(empresaId) {
  const resultado = await pool.query(
    `SELECT id, sku, nome, preco, estoque_minimo
     FROM public.produtos
     WHERE empresa_id = $1
     ORDER BY nome ASC, id ASC`,
    [empresaId]
  );

  return resultado.rows;
}

/** O empresaId sempre vem do token validado pelo servidor. */
export async function inserirProduto(empresaId, produto) {
  const resultado = await pool.query(
    `INSERT INTO public.produtos (empresa_id, sku, nome, preco, estoque_minimo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, sku, nome, preco, estoque_minimo`,
    [empresaId, produto.sku, produto.nome, produto.preco, produto.estoque_minimo]
  );

  return resultado.rows[0];
}
