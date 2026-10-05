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

  // bcrypt não descriptografa uma senha: ele compara o texto recebido com o hash
  // de mão única salvo no banco. Assim, a senha original não precisa ser armazenada.
  const senhaValida = empresa?.senha_hash
    ? await bcrypt.compare(senha, empresa.senha_hash)
    : false;

  if (!empresa || !senhaValida) return null;

  // O id da empresa vai no subject padrão (sub); o token expira para limitar o tempo de uso.
  const token = jwt.sign(
    { tipo: "empresa", nome: empresa.nome },
    jwtSecret,
    {
      subject: String(empresa.id),
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      algorithm: "HS256",
    }
  );

  return {
    token,
    empresa: { id: empresa.id, nome: empresa.nome, email: empresa.email },
  };
}
