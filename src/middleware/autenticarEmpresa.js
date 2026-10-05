import jwt from "jsonwebtoken";

/**
 * Protege rotas que recebem dados privados da empresa.
 * O cliente deve enviar: Authorization: Bearer <token>.
 */
export function autenticarEmpresa(req, res, next) {
  const jwtSecret = process.env.JWT_SECRET;

  // Sem o segredo, a API não consegue validar tokens com segurança.
  // Isso é uma falha de configuração do servidor, não uma credencial inválida.
  if (!jwtSecret) {
    console.error("JWT_SECRET não está configurado.");
    return res.status(500).json({ erro: "Autenticação não configurada no servidor." });
  }

  const authorization = req.get("authorization") || "";
  const correspondencia = authorization.match(/^Bearer\s+(.+)$/i);

  // Não aceitamos token na URL ou no corpo: o padrão é o cabeçalho Authorization.
  if (!correspondencia) {
    return res.status(401).json({ erro: "Token de autenticação não informado." });
  }

  try {
    // A lista limita a verificação ao algoritmo que usamos ao criar os tokens.
    const payload = jwt.verify(correspondencia[1], jwtSecret, {
      algorithms: ["HS256"],
    });

    // Só tokens de empresa, com subject numérico, acessam as rotas protegidas.
    if (
      typeof payload !== "object" ||
      payload.tipo !== "empresa" ||
      typeof payload.sub !== "string" ||
      !/^\d+$/.test(payload.sub)
    ) {
      return res.status(401).json({ erro: "Token de autenticação inválido." });
    }

    // Próximos controllers usam estes dados para filtrar pela empresa autenticada.
    // Não confie em um empresa_id enviado pelo cliente no corpo da requisição.
    req.empresaAuth = {
      id: payload.sub,
      nome: typeof payload.nome === "string" ? payload.nome : undefined,
    };

    return next();
  } catch {
    // JWT inválido, adulterado ou expirado recebe a mesma resposta, sem detalhes internos.
    return res.status(401).json({ erro: "Token de autenticação inválido ou expirado." });
  }
}
