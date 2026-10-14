import { Router } from "express";
import {
  criarLocal,
  criarMovimentacao,
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

// Informam o estoque_id na query para listar e no JSON para registrar movimento.
router.get("/saldos", listarSaldos);
router.get("/movimentacoes", listarMovimentacoes);
router.post("/movimentacoes", criarMovimentacao);

export default router;
