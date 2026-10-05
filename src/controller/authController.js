import { autenticarEmpresa } from "../service/authService.js";

export async function loginEmpresa(req, res) {
  // Normalizar o e-mail evita diferenças por espaços ou letras maiúsculas.
  const email = typeof req.body?.email === "string"
    ? req.body.email.trim().toLowerCase()
    : "";
  const senha = typeof req.body?.senha === "string" ? req.body.senha : "";

  if (!email || !senha) {
    return res.status(400).json({ erro: "Informe o e-mail e a senha da empresa." });
  }

  // O limite de 72 bytes acompanha o limite de entrada do bcrypt.
  if (email.length > 254 || Buffer.byteLength(senha, "utf8") > 72) {
    return res.status(400).json({ erro: "E-mail ou senha em formato inválido." });
  }

  try {
    const resultado = await autenticarEmpresa(email, senha);

    if (!resultado) {
      return res.status(401).json({ erro: "E-mail ou senha da empresa inválidos." });
    }

    return res.status(200).json({
      mensagem: "Login da empresa realizado com sucesso.",
      ...resultado,
    });
  } catch (error) {
    if (error.code === "JWT_SECRET_AUSENTE") {
      console.error(error.message);
      return res.status(500).json({ erro: "Autenticação não configurada no servidor." });
    }

    console.error("Falha ao autenticar empresa:", error);
    return res.status(500).json({ erro: "Não foi possível realizar o login da empresa." });
  }
}
