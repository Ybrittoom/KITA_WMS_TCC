import express from "express";
import authRoutes from "./routes/authRoutes.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "10kb" }));
app.use("/api/auth", authRoutes);

app.use((error, _req, res, _next) => {
  console.error("Erro inesperado na API:", error);
  res.status(500).json({ erro: "Erro interno do servidor." });
});

app.listen(port, () => {
  console.log(`API KITA WMS disponível na porta ${port}.`);
});
