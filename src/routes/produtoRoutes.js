import { Router } from "express";
import {
  atualizarProduto,
  buscarProdutoPorSku,
  criarProduto,
  listarProdutos,
  removerProduto,
} from "../controller/produtoController.js";
import { autenticarEmpresa } from "../middleware/autenticarEmpresa.js";

const router = Router();

// Protege listagem, cadastro, edicao e inativacao com o mesmo JWT da empresa.
router.use(autenticarEmpresa);
router.get("/", listarProdutos);
// Busca exata protegida; o codigo e enviado como query string ?sku=ABC123.
router.get("/buscar", buscarProdutoPorSku);
router.post("/", criarProduto);
router.put("/:id", atualizarProduto);
router.delete("/:id", removerProduto);

export default router;
