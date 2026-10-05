import pool from "../config/database.js";

export async function buscarEmpresaPorEmail(email) {
  // O placeholder $1 mantém o e-mail como parâmetro, evitando montar SQL com texto do usuário.
  const resultado = await pool.query(
    `SELECT id, nome, email, senha_hash
     FROM empresas
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [email]
  );

  return resultado.rows[0] ?? null;
}
