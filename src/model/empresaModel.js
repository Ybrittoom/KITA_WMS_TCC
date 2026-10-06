import pool from "../config/database.js";

/** Busca a conta de login da empresa pelo e-mail. */
export async function buscarEmpresaPorEmail(email) {
  const resultado = await pool.query(
    `SELECT id AS empresa_id, nome AS empresa_nome, email, senha_hash
     FROM public.empresas
     WHERE lower(email) = $1
     LIMIT 1`,
    [email]
  );
  return resultado.rows[0] ?? null;
}

/** Recarrega os dados da empresa em cada requisicao autenticada. */
export async function buscarEmpresaPorId(empresaId) {
  const resultado = await pool.query(
    `SELECT id AS empresa_id, nome AS empresa_nome, email
     FROM public.empresas
     WHERE id = $1
     LIMIT 1`,
    [empresaId]
  );
  return resultado.rows[0] ?? null;
}
