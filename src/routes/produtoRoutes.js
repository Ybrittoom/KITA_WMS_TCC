import { Router } from "express";
import { criarProduto, listarProdutos } from "../controller/produtoController.js";
import { autenticarEmpresa } from "../middleware/autenticarEmpresa.js";

const router = Router();

// Todas as operacoes desta rota exigem token de uma empresa autenticada.
router.use(autenticarEmpresa);
router.get("/", listarProdutos);
router.post("/", criarProduto);

export default router;
