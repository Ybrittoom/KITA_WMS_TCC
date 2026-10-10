import {
  buscarProdutosDaEmpresa,
  cadastrarProduto,
  editarProduto,
  excluirProduto,
} from "../service/produtoService.js";

export async function listarProdutos(req, res) {
  try {
    const produtos = await buscarProdutosDaEmpresa(req.empresaAuth.id);
    return res.status(200).json({ produtos });
  } catch (error) {
    console.error("Falha ao listar produtos:", error.message);
    return res.status(500).json({ erro: "Nao foi possivel carregar os produtos." });
  }
}

/** Recebe os dados do formulario e cria produto para a empresa do JWT. */
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

/** Traduz erros conhecidos do service em codigos HTTP compreensiveis. */
function responderErroDeProduto(res, error, operacao) {
  if (error.code === "PRODUCT_NOT_FOUND") {
    return res.status(404).json({ erro: error.message });
  }
  if (error.code === "PRODUCT_SKU_CONFLICT") {
    return res.status(409).json({ erro: error.message });
  }
  if (error.code?.startsWith("PRODUCT_INVALID_")) {
    return res.status(400).json({ erro: error.message });
  }
  console.error(`Falha ao ${operacao} produto:`, error.message);
  return res.status(500).json({ erro: `Nao foi possivel ${operacao} o produto.` });
}

/** Atualiza produto e devolve a linha salva para a tela. */
export async function atualizarProduto(req, res) {
  try {
    const produto = await editarProduto(req.body, req.empresaAuth.id, req.params.id);
    return res.status(200).json({ mensagem: "Produto atualizado com sucesso.", produto });
  } catch (error) {
    return responderErroDeProduto(res, error, "atualizar");
  }
}

/** Inativa produto e informa que o historico continua preservado. */
export async function removerProduto(req, res) {
  try {
    const produto = await excluirProduto(req.empresaAuth.id, req.params.id);
    return res.status(200).json({
      mensagem: `Produto \"${produto.nome}\" inativado. O historico foi mantido.`,
      produto,
    });
  } catch (error) {
    return responderErroDeProduto(res, error, "inativar");
  }
}
