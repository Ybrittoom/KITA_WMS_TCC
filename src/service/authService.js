import { getSupabaseClient } from "../config/supabase.js";
import { buscarVinculoEmpresaPorAuthId } from "../model/empresaModel.js";

export async function autenticarEmpresa(email, senha) {
  // O Supabase Auth verifica a senha e emite o access token assinado.
  // O projeto não lê nem armazena a senha/hash diretamente.
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    if (error.status === 400 || error.status === 401) {
      const authError = new Error("Credenciais inválidas.");
      authError.code = "AUTH_INVALID_CREDENTIALS";
      throw authError;
    }

    const authError = new Error("Não foi possível acessar o serviço de autenticação.");
    authError.code = "SUPABASE_AUTH_UNAVAILABLE";
    throw authError;
  }

  if (!data.user || !data.session) {
    const authError = new Error("O Supabase Auth não retornou uma sessão.");
    authError.code = "SUPABASE_AUTH_UNAVAILABLE";
    throw authError;
  }

  // auth_id relaciona auth.users com usuarios; empresa_id identifica o tenant.
  const vinculo = await buscarVinculoEmpresaPorAuthId(data.user.id);

  if (!vinculo) {
    const authError = new Error("A conta autenticada ainda não está vinculada a uma empresa.");
    authError.code = "AUTH_USER_NOT_LINKED";
    throw authError;
  }

  return {
    token: data.session.access_token,
    tokenExpiresAt: data.session.expires_at,
    empresa: { id: vinculo.empresa_id, nome: vinculo.empresa_nome },
    usuario: {
      id: vinculo.usuario_id,
      nome: vinculo.usuario_nome,
      authId: data.user.id,
      email: data.user.email,
    },
  };
}
