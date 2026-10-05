import pool from "../config/database.js";

export async function buscarEmpresaPorEmail(email) {
  const resultado = await pool.query(
    `SELECT id, nome, email, senha_hash
     FROM empresas
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [email]
  );

  return resultado.rows[0] ?? null;
}
