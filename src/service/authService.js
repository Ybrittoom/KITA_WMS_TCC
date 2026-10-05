import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { buscarEmpresaPorEmail } from "../model/empresaModel.js";

export async function autenticarEmpresa(email, senha) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    const erro = new Error("JWT_SECRET não está configurado.");
    erro.code = "JWT_SECRET_AUSENTE";
    throw erro;
  }

  const empresa = await buscarEmpresaPorEmail(email);
  const senhaValida = empresa?.senha_hash
    ? await bcrypt.compare(senha, empresa.senha_hash)
    : false;

  if (!empresa || !senhaValida) return null;

  const token = jwt.sign(
    { tipo: "empresa", nome: empresa.nome },
    jwtSecret,
    {
      subject: String(empresa.id),
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    }
  );

  return {
    token,
    empresa: { id: empresa.id, nome: empresa.nome, email: empresa.email },
  };
}
