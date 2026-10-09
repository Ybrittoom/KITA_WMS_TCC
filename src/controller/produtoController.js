import { buscarProdutosDaEmpresa, cadastrarProduto } from "../service/produtoService.js";

export async function listarProdutos(req, res) {
  try {
    const produtos = await buscarProdutosDaEmpresa(req.empresaAuth.id);
    return res.status(200).json({ produtos });
  } catch (error) {
    console.error("Falha ao listar produtos:", error.message);
    return res.status(500).json({ erro: "Nao foi possivel carregar os produtos." });
  }
}

export async function criarProduto(req, res) {
  try {
    const produto = await cadastrarProduto(req.body, req.empresaAuth.id);
    return res.status(201).json({ mensagem: "Produto cadastrado com sucesso.", produto });
  } catch (error) {
    if (error.code === "PRODUCT_SKU_CONFLICT") {
      return res.status(409).json({ erro: error.message });
    }
    if (error.code?.startsWith("PRODUCT_INVALID_")) {
      return res.status(400).json({ erro: error.message });
    }
    console.error("Falha ao cadastrar produto:", error.message);
    return res.status(500).json({ erro: "Nao foi possivel cadastrar o produto." });
  }
}
