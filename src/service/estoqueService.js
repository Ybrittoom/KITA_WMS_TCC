import {
  buscarLocalDaEmpresa,
  inserirLocalDaEmpresa,
  inserirMovimentacaoDaEmpresa,
  listarLocaisDaEmpresa,
  listarMovimentacoesDoLocal,
  listarSaldosDoLocal,
} from "../model/estoqueModel.js";

/** Cria um erro com codigo conhecido para o controller escolher o status HTTP. */
function criarErroEstoque(codigo, mensagem) {
  const error = new Error(mensagem);
  error.code = codigo;
  return error;
}

/** Valida IDs bigint positivos sem converter para Number e perder precisao. */
function validarId(valor, nomeCampo) {
  const id = String(valor ?? "");
  if (!/^[1-9]\d*$/.test(id) || BigInt(id) > 9223372036854775807n) {
    throw criarErroEstoque("STOCK_INVALID_ID", `O identificador de ${nomeCampo} e invalido.`);
  }
  return id;
}

/** Retorna os locais cadastrados para a empresa do token. */
export async function buscarLocaisDaEmpresa(empresaId) {
  return listarLocaisDaEmpresa(empresaId);
}

/** Valida nome/localizacao e grava um local de estoque para a empresa. */
export async function cadastrarLocalDaEmpresa(dados, empresaId) {
  const nome = typeof dados?.nome === "string" ? dados.nome.trim() : "";
  const localizacao = typeof dados?.localizacao === "string" ? dados.localizacao.trim() : "";

  if (!nome || nome.length > 120) {
    throw criarErroEstoque("STOCK_INVALID_NAME", "Informe o nome do local, com no maximo 120 caracteres.");
  }
  if (localizacao.length > 160) {
    throw criarErroEstoque("STOCK_INVALID_LOCATION", "A localizacao pode ter no maximo 160 caracteres.");
  }

  return inserirLocalDaEmpresa(empresaId, {
    nome,
    localizacao: localizacao || null,
  });
}

/** Valida o local antes de consultar seu saldo atual. */
export async function buscarSaldosDoLocal(empresaId, estoqueIdInformado) {
  const estoqueId = validarId(estoqueIdInformado, "local");
  const local = await buscarLocalDaEmpresa(empresaId, estoqueId);
  if (!local) {
    throw criarErroEstoque("STOCK_LOCATION_NOT_FOUND", "Local nao encontrado nesta empresa.");
  }

  return listarSaldosDoLocal(empresaId, estoqueId);
}

/** Valida o local e retorna ate as 100 movimentacoes mais recentes. */
export async function buscarMovimentacoesDoLocal(empresaId, estoqueIdInformado) {
  const estoqueId = validarId(estoqueIdInformado, "local");
  const local = await buscarLocalDaEmpresa(empresaId, estoqueId);
  if (!local) {
    throw criarErroEstoque("STOCK_LOCATION_NOT_FOUND", "Local nao encontrado nesta empresa.");
  }

  return listarMovimentacoesDoLocal(empresaId, estoqueId);
}

/**
 * Valida os dados e calcula o saldo novo dentro da transacao do model.
 * Saidas maiores que o saldo atual sao recusadas antes de inserir a movimentacao.
 */
export async function registrarMovimentacao(dados, empresaId) {
  const estoqueId = validarId(dados?.estoque_id, "local");
  const produtoId = validarId(dados?.produto_id, "produto");
  const tipo = typeof dados?.tipo === "string" ? dados.tipo.trim().toLowerCase() : "";
  const quantidade = dados?.quantidade === "" || dados?.quantidade === undefined
    ? Number.NaN
    : Number(dados.quantidade);

  if (!["entrada", "saida"].includes(tipo)) {
    throw criarErroEstoque("STOCK_INVALID_TYPE", "Escolha entrada ou saida para a movimentacao.");
  }
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 2147483647) {
    throw criarErroEstoque("STOCK_INVALID_QUANTITY", "A quantidade deve ser um inteiro positivo.");
  }

  const movimento = await inserirMovimentacaoDaEmpresa(
    empresaId,
    { estoque_id: estoqueId, produto_id: produtoId, tipo, quantidade },
    (saldoAtual) => {
      if (tipo === "saida" && quantidade > saldoAtual) {
        throw criarErroEstoque(
          "STOCK_INSUFFICIENT_BALANCE",
          `Saldo insuficiente. Disponivel: ${saldoAtual} unidade(s).`
        );
      }

      return tipo === "entrada" ? saldoAtual + quantidade : saldoAtual - quantidade;
    }
  );

  if (!movimento) {
    throw criarErroEstoque(
      "STOCK_REFERENCE_NOT_FOUND",
      "Produto ou local nao encontrado nesta empresa; confira se o produto esta ativo."
    );
  }

  return movimento;
}
