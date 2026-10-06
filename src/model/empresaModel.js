import pool from "../config/database.js";

/** Localiza a empresa associada ao usuário autenticado pelo Supabase Auth. */
export async function buscarVinculoEmpresaPorAuthId(authId) {
  // O auth_id vem do usuário verificado pelo Supabase, nunca do corpo da requisição.
  const resultado = await pool.query(
    `SELECT
       u.id AS usuario_id,
       u.nome AS usuario_nome,
       u.empresa_id,
       e.nome AS empresa_nome
     FROM usuarios AS u
     INNER JOIN empresas AS e ON e.id = u.empresa_id
     WHERE u.auth_id = $1::uuid
     LIMIT 1`,
    [authId]
  );

  return resultado.rows[0] ?? null;
}
