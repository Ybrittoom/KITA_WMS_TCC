import {
  buscarLocaisDaEmpresa,
  buscarMovimentacoesDoLocal,
  buscarSaldosDoLocal,
  cadastrarLocalDaEmpresa,
  registrarMovimentacao,
} from "../service/estoqueService.js";

/** Converte erros de validacao/negocio em status HTTP e esconde detalhes internos. */
function responderErroEstoque(res, error, operacao) {
  if (error.code === "STOCK_LOCATION_NOT_FOUND" || error.code === "STOCK_REFERENCE_NOT_FOUND") {
    return res.status(404).json({ erro: error.message });
  }
  if (error.code === "STOCK_INSUFFICIENT_BALANCE") {
    return res.status(409).json({ erro: error.message });
  }
  if (error.code?.startsWith("STOCK_INVALID_")) {
    return res.status(400).json({ erro: error.message });
  }

  console.error(`Falha ao ${operacao}:`, error.message);
  return res.status(500).json({ erro: `Nao foi possivel ${operacao}.` });
}

/** Retorna apenas os locais de estoque da empresa autenticada. */
export async function listarLocais(req, res) {
  try {
    const locais = await buscarLocaisDaEmpresa(req.empresaAuth.id);
    return res.status(200).json({ locais });
  } catch (error) {
    return responderErroEstoque(res, error, "carregar os locais de estoque");
  }
}

/** Cadastra um local; empresa_id vem do JWT e nao do corpo HTTP. */
export async function criarLocal(req, res) {
  try {
    const local = await cadastrarLocalDaEmpresa(req.body, req.empresaAuth.id);
    return res.status(201).json({ mensagem: "Local de estoque cadastrado.", local });
  } catch (error) {
    return responderErroEstoque(res, error, "cadastrar o local de estoque");
  }
}

/** Busca saldo mais recente de cada produto ativo no local selecionado. */
export async function listarSaldos(req, res) {
  try {
    const saldos = await buscarSaldosDoLocal(req.empresaAuth.id, req.query.estoque_id);
    return res.status(200).json({ saldos });
  } catch (error) {
    return responderErroEstoque(res, error, "carregar os saldos");
  }
}

/** Lista o historico recente de um local, limitado pelo model. */
export async function listarMovimentacoes(req, res) {
  try {
    const movimentacoes = await buscarMovimentacoesDoLocal(
      req.empresaAuth.id,
      req.query.estoque_id
    );
    return res.status(200).json({ movimentacoes });
  } catch (error) {
    return responderErroEstoque(res, error, "carregar o historico de movimentacoes");
  }
}

/** Registra entrada/saida e informa o saldo resultante salvo na mesma transacao. */
export async function criarMovimentacao(req, res) {
  try {
    const movimentacao = await registrarMovimentacao(req.body, req.empresaAuth.id);
    return res.status(201).json({
      mensagem: "Movimentacao registrada com sucesso.",
      movimentacao,
    });
  } catch (error) {
    return responderErroEstoque(res, error, "registrar a movimentacao");
  }
}
