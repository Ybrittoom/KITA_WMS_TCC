import { inserirProduto, listarProdutosPorEmpresa } from "../model/produtoModel.js";

export async function buscarProdutosDaEmpresa(empresaId) {
  return listarProdutosPorEmpresa(empresaId);
}

export async function cadastrarProduto(dados, empresaId) {
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

  if (!Number.isFinite(preco) || preco < 0 || !Number.isFinite(estoqueMinimo) ||
      !Number.isInteger(estoqueMinimo) || estoqueMinimo < 0) {
    const error = new Error("Preco deve ser positivo ou zero e estoque minimo deve ser um inteiro positivo ou zero.");
    error.code = "PRODUCT_INVALID_NUMBERS";
    throw error;
  }

  try {
    return await inserirProduto(empresaId, { nome, sku, preco, estoque_minimo: estoqueMinimo });
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error("Esse SKU ja esta cadastrado na sua empresa.");
      duplicateError.code = "PRODUCT_SKU_CONFLICT";
      throw duplicateError;
    }
    throw error;
  }
}
