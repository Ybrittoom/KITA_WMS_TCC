import { autenticarEmpresa } from "../service/authService.js";

export async function loginEmpresa(req, res) {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const senha = typeof req.body?.senha === "string" ? req.body.senha : "";

  if (!email || !senha) {
    return res.status(400).json({ erro: "Informe o email e a senha da empresa." });
  }
  if (email.length > 254 || senha.length > 1024) {
    return res.status(400).json({ erro: "Email ou senha em formato invalido." });
  }

  try {
    const resultado = await autenticarEmpresa(email, senha);
    return res.status(200).json({ mensagem: "Login realizado com sucesso.", ...resultado });
  } catch (error) {
    if (error.code === "AUTH_INVALID_CREDENTIALS") {
      return res.status(401).json({ erro: "Email ou senha invalidos." });
    }
    if (error.code === "JWT_CONFIG_MISSING") {
      console.error(error.message);
      return res.status(500).json({ erro: "JWT_SECRET nao esta configurado corretamente." });
    }
    console.error("Falha ao autenticar conta:", error.message);
    return res.status(500).json({ erro: "Nao foi possivel realizar o login." });
  }
}
