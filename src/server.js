import express from "express";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/authRoutes.js";
import produtoRoutes from "./routes/produtoRoutes.js";

const app = express();
const port = Number(process.env.PORT) || 3000;
const publicPath = fileURLToPath(new URL("./public/", import.meta.url));
const loginPath = fileURLToPath(new URL("./view/login.html", import.meta.url));
const cadastroProdutoPath = fileURLToPath(new URL("./view/cadastroProduto.html", import.meta.url));

app.use(express.json({ limit: "10kb" }));
app.use("/public", express.static(publicPath));
app.use("/api/auth", authRoutes);
app.use("/api/produtos", produtoRoutes);

app.get(["/", "/login"], (_req, res) => {
  res.sendFile(loginPath);
});

// A pagina pode ser aberta diretamente por URL; a API de produtos exige JWT.
app.get("/produtos/cadastro", (_req, res) => {
  res.sendFile(cadastroProdutoPath);
});

app.use((error, _req, res, _next) => {
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
    ? error.status
    : 500;

  if (status === 500) {
    console.error("Erro inesperado na API:", error);
  }

  res.status(status).json({
    erro: status === 400 ? "Requisição inválida." : "Erro interno do servidor.",
  });
});

app.listen(port, () => {
  console.log(`API KITA WMS disponível na porta ${port}.`);
});
