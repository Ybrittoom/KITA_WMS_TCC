import { Router } from "express";
import {
  atualizarProduto,
  criarProduto,
  listarProdutos,
  removerProduto,
} from "../controller/produtoController.js";
import { autenticarEmpresa } from "../middleware/autenticarEmpresa.js";

const router = Router();

// Protege listagem, cadastro, edicao e inativacao com o mesmo JWT da empresa.
router.use(autenticarEmpresa);
router.get("/", listarProdutos);
router.post("/", criarProduto);
router.put("/:id", atualizarProduto);
router.delete("/:id", removerProduto);

export default router;
