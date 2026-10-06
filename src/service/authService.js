import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { buscarEmpresaPorEmail } from "../model/empresaModel.js";

export async function autenticarEmpresa(email, senha) {
  const segredo = process.env.JWT_SECRET;
  if (!segredo || segredo.length < 32) {
    const error = new Error("JWT_SECRET ausente ou curto demais.");
    error.code = "JWT_CONFIG_MISSING";
    throw error;
  }

  const empresa = await buscarEmpresaPorEmail(email);
  const senhaCorreta = empresa?.senha_hash
    ? await bcrypt.compare(senha, empresa.senha_hash)
    : false;

  if (!empresa || !senhaCorreta) {
    const error = new Error("Email ou senha invalidos.");
    error.code = "AUTH_INVALID_CREDENTIALS";
    throw error;
  }

  const token = jwt.sign(
    {},
    segredo,
    { subject: String(empresa.empresa_id), expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );

  return {
    token,
    empresa: {
      id: empresa.empresa_id,
      nome: empresa.empresa_nome,
      email: empresa.email,
    },
  };
}
