import { getSupabaseClient } from "../config/supabase.js";
import { buscarVinculoEmpresaPorAuthId } from "../model/empresaModel.js";

/**
 * Protege rotas que recebem dados privados da empresa.
 * O cliente deve enviar: Authorization: Bearer <token>.
 */
export async function autenticarEmpresa(req, res, next) {
  const authorization = req.get("authorization") || "";
  const correspondencia = authorization.match(/^Bearer\s+(.+)$/i);

  // Não aceitamos token na URL ou no corpo: o padrão é o cabeçalho Authorization.
  if (!correspondencia) {
    return res.status(401).json({ erro: "Token de autenticação não informado." });
  }

  try {
    // getUser valida o access token com o Supabase Auth, em vez de confiar só em claims locais.
    const { data, error } = await getSupabaseClient().auth.getUser(correspondencia[1]);
    if (error) {
      if (error.status === 400 || error.status === 401 || error.status === 403) {
        return res.status(401).json({ erro: "Token de autenticação inválido ou expirado." });
      }

      console.error("Supabase Auth não pôde validar o token:", error.message);
      return res.status(503).json({ erro: "Não foi possível validar a sessão neste momento." });
    }

    if (!data.user) {
      return res.status(401).json({ erro: "Token de autenticação inválido ou expirado." });
    }

    // Descobre a empresa no banco pelo UUID validado, nunca por um ID enviado pelo navegador.
    const vinculo = await buscarVinculoEmpresaPorAuthId(data.user.id);
    if (!vinculo) {
      return res.status(403).json({ erro: "A conta autenticada não está vinculada a uma empresa." });
    }

    req.empresaAuth = {
      id: vinculo.empresa_id,
      nome: vinculo.empresa_nome,
      usuarioId: vinculo.usuario_id,
      usuarioNome: vinculo.usuario_nome,
      authId: data.user.id,
    };

    return next();
  } catch (error) {
    if (error.code === "SUPABASE_CONFIG_MISSING") {
      return res.status(500).json({ erro: "Supabase Auth não está configurado no servidor." });
    }

    console.error("Falha ao validar a sessão Supabase:", error);
    return res.status(503).json({ erro: "Não foi possível validar a sessão neste momento." });
  }
}
