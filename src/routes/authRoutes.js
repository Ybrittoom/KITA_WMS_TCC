import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/database.js";

const router = Router();

router.post("/login", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const senha = typeof req.body?.senha === "string" ? req.body.senha : "";

  if (!email || !senha) {
    return res.status(400).json({ erro: "Informe o e-mail e a senha da empresa." });
  }

  if (email.length > 254 || Buffer.byteLength(senha, "utf8") > 72) {
    return res.status(400).json({ erro: "E-mail ou senha em formato inválido." });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error("JWT_SECRET não está configurado.");
    return res.status(500).json({ erro: "Autenticação não configurada no servidor." });
  }

  try {
    const result = await pool.query(
      `SELECT id, nome, email, senha_hash
       FROM empresas
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [email]
    );

    const empresa = result.rows[0];
    const senhaValida = empresa?.senha_hash
      ? await bcrypt.compare(senha, empresa.senha_hash)
      : false;

    if (!empresa || !senhaValida) {
      return res.status(401).json({ erro: "E-mail ou senha da empresa inválidos." });
    }

    const token = jwt.sign(
      { tipo: "empresa", nome: empresa.nome },
      jwtSecret,
      { subject: String(empresa.id), expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );

    return res.status(200).json({
      mensagem: "Login da empresa realizado com sucesso.",
      token,
      empresa: { id: empresa.id, nome: empresa.nome, email: empresa.email },
    });
  } catch (error) {
    console.error("Falha ao autenticar empresa:", error);
    return res.status(500).json({ erro: "Não foi possível realizar o login da empresa." });
  }
});

export default router;
