import { autenticarEmpresa } from "../service/authService.js";

export async function loginEmpresa(req, res) {
  // Normalizar o e-mail remove espaços acidentais antes de enviá-lo ao Supabase Auth.
  const email = typeof req.body?.email === "string"
    ? req.body.email.trim().toLowerCase()
    : "";
  const senha = typeof req.body?.senha === "string" ? req.body.senha : "";

  if (!email || !senha) {
    return res.status(400).json({ erro: "Informe o e-mail e a senha da empresa." });
  }

  if (email.length > 254 || senha.length > 1024) {
    return res.status(400).json({ erro: "E-mail ou senha em formato inválido." });
  }

  try {
    const resultado = await autenticarEmpresa(email, senha);

    return res.status(200).json({
      mensagem: "Login realizado com sucesso.",
      ...resultado,
    });
  } catch (error) {
    if (error.code === "AUTH_INVALID_CREDENTIALS") {
      return res.status(401).json({ erro: "E-mail ou senha inválidos." });
    }

    if (error.code === "AUTH_USER_NOT_LINKED") {
      return res.status(403).json({ erro: error.message });
    }

    if (error.code === "SUPABASE_CONFIG_MISSING") {
      console.error(error.message);
      return res.status(500).json({ erro: "Supabase Auth não está configurado no servidor." });
    }

    if (error.code === "SUPABASE_AUTH_UNAVAILABLE") {
      console.error(error.message);
      return res.status(503).json({ erro: "Serviço de autenticação temporariamente indisponível." });
    }

    console.error("Falha ao autenticar empresa:", error);
    return res.status(500).json({ erro: "Não foi possível realizar o login da empresa." });
  }
}
