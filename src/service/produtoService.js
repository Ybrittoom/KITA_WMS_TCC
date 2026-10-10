import {
  atualizarProdutoDaEmpresa,
  inativarProdutoDaEmpresa,
  inserirProduto,
  listarProdutosPorEmpresa,
} from "../model/produtoModel.js";

export async function buscarProdutosDaEmpresa(empresaId) {
  return listarProdutosPorEmpresa(empresaId);
}

/** Confere que o ID da URL e um bigint positivo aceito pelo PostgreSQL. */
function validarIdProduto(id) {
  const valor = String(id ?? "");
  if (!/^[1-9]\d*$/.test(valor) || BigInt(valor) > 9223372036854775807n) {
    const error = new Error("Identificador de produto invalido.");
    error.code = "PRODUCT_INVALID_ID";
    throw error;
  }
  return valor;
}

/**
 * Limpa e valida os campos compartilhados entre cadastro e edicao.
 * SKU e normalizado para maiusculas para manter um padrao nos cadastros da API.
 */
function validarDadosProduto(dados) {
  const nome = typeof dados?.nome === "string" ? dados.nome.trim() : "";
  const sku = typeof dados?.sku === "string" ? dados.sku.trim().toUpperCase() : "";
  const preco = dados?.preco === "" || dados?.preco === undefined
    ? Number.NaN
    : Number(dados.preco);
  const estoqueMinimo = dados?.estoque_minimo === "" || dados?.estoque_minimo === undefined
    ? Number.NaN
    : Number(dados.estoque_minimo);

  if (!nome || nome.length > 160) {
    const error = new Error("Informe um nome de produto com no maximo 160 caracteres.");
    error.code = "PRODUCT_INVALID_NAME";
    throw error;
  }
  if (!sku || sku.length > 80) {
    const error = new Error("Informe um SKU com no maximo 80 caracteres.");
    error.code = "PRODUCT_INVALID_SKU";
    throw error;
  }
  if (!Number.isFinite(preco) || preco < 0 || preco > 9999999999.99 ||
      !Number.isFinite(estoqueMinimo) || !Number.isInteger(estoqueMinimo) || estoqueMinimo < 0) {
    const error = new Error("Informe um preco valido e um estoque minimo inteiro maior ou igual a zero.");
    error.code = "PRODUCT_INVALID_NUMBERS";
    throw error;
  }

  return { nome, sku, preco, estoque_minimo: estoqueMinimo };
}

/** Converte a violacao de SKU unico em um erro que a API consegue explicar. */
async function salvarComTratamentoDeSku(operacao) {
  try {
    return await operacao();
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error("Esse SKU ja esta cadastrado na sua empresa.");
      duplicateError.code = "PRODUCT_SKU_CONFLICT";
      throw duplicateError;
    }
    throw error;
  }
}

export async function cadastrarProduto(dados, empresaId) {
  const produto = validarDadosProduto(dados);
  return salvarComTratamentoDeSku(() => inserirProduto(empresaId, produto));
}

/** Edita um produto ativo; a consulta tambem exige que ele seja da empresa. */
export async function editarProduto(dados, empresaId, id) {
  const produtoId = validarIdProduto(id);
  const produto = validarDadosProduto(dados);
  const atualizado = await salvarComTratamentoDeSku(
    () => atualizarProdutoDaEmpresa(empresaId, produtoId, produto)
  );
  if (!atualizado) {
    const error = new Error("Produto nao encontrado ou nao pertence a esta empresa.");
    error.code = "PRODUCT_NOT_FOUND";
    throw error;
  }
  return atualizado;
}

/**
 * Faz exclusao logica: desativa o produto sem remover seu historico.
 * O SKU permanece reservado pela restricao UNIQUE do banco.
 */
export async function excluirProduto(empresaId, id) {
  const produtoId = validarIdProduto(id);
  const produto = await inativarProdutoDaEmpresa(empresaId, produtoId);
  if (!produto) {
    const error = new Error("Produto nao encontrado ou ja inativo.");
    error.code = "PRODUCT_NOT_FOUND";
    throw error;
  }
  return produto;
}
