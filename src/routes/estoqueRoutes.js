import { Router } from "express";
import {
  atribuirProdutoEndereco,
  atualizarEndereco,
  criarLocal,
  criarEndereco,
  criarMovimentacao,
  deletarEndereco,
  desocuparEndereco,
  listarMapa,
  listarLocais,
  listarMovimentacoes,
  listarSaldos,
} from "../controller/estoqueController.js";
import { autenticarEmpresa } from "../middleware/autenticarEmpresa.js";

const router = Router();

// Todas as rotas de estoque usam o mesmo JWT das rotas de produtos.
router.use(autenticarEmpresa);

// Locais e produtos sempre sao limitados a empresa extraida do token.
router.get("/locais", listarLocais);
router.post("/locais", criarLocal);

// O mapa e os enderecos fisicos tambem ficam sob autenticacao por JWT.
router.get("/mapa", listarMapa);
router.post("/enderecos", criarEndereco);
router.put("/enderecos/:id", atualizarEndereco);
router.delete("/enderecos/:id", deletarEndereco);
router.put("/enderecos/:id/produto", atribuirProdutoEndereco);
router.delete("/enderecos/:id/produto", desocuparEndereco);

// Informam o estoque_id na query para listar e no JSON para registrar movimento.
router.get("/saldos", listarSaldos);
router.get("/movimentacoes", listarMovimentacoes);
router.post("/movimentacoes", criarMovimentacao);

export default router;
