import jwt from "jsonwebtoken";
import { buscarEmpresaPorId } from "../model/empresaModel.js";

/** Protects API routes. Requires Authorization: Bearer <token>. */
export async function autenticarEmpresa(req, res, next) {
  const authorization = req.get("authorization") || "";
  const correspondencia = authorization.match(/^Bearer\s+(.+)$/i);
  if (!correspondencia) {
    return res.status(401).json({ erro: "Token de autenticacao nao informado." });
  }

  const segredo = process.env.JWT_SECRET;
  if (!segredo || segredo.length < 32) {
    console.error("JWT_SECRET ausente ou curto demais.");
    return res.status(500).json({ erro: "Autenticacao nao configurada no servidor." });
  }

  try {
    const payload = jwt.verify(correspondencia[1], segredo);
    if (!payload.sub) {
      return res.status(401).json({ erro: "Token invalido ou expirado." });
    }

    const empresa = await buscarEmpresaPorId(payload.sub);
    if (!empresa) {
      return res.status(401).json({ erro: "Conta ou vinculo invalido; entre novamente." });
    }

    req.empresaAuth = {
      id: empresa.empresa_id,
      nome: empresa.empresa_nome,
      email: empresa.email,
    };
    return next();
  } catch (error) {
    if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name)) {
      return res.status(401).json({ erro: "Token invalido ou expirado." });
    }
    console.error("Falha ao validar sessao:", error.message);
    return res.status(503).json({ erro: "Nao foi possivel validar a sessao neste momento." });
  }
}
