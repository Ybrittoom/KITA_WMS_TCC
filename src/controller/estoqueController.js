import {
  buscarMapaDoLocal,
  buscarLocaisDaEmpresa,
  buscarMovimentacoesDoLocal,
  buscarSaldosDoLocal,
  cadastrarEndereco,
  cadastrarLocalDaEmpresa,
  editarEndereco,
  liberarProdutoDoMapa,
  moverProdutoNoMapa,
  removerEndereco,
  registrarMovimentacao,
} from "../service/estoqueService.js";

/** Converte erros de validacao/negocio em status HTTP e esconde detalhes internos. */
function responderErroEstoque(res, error, operacao) {
  if (["STOCK_LOCATION_NOT_FOUND", "STOCK_REFERENCE_NOT_FOUND", "STOCK_ADDRESS_NOT_FOUND"].includes(error.code)) {
    return res.status(404).json({ erro: error.message });
  }
  if (["STOCK_INSUFFICIENT_BALANCE", "STOCK_ADDRESS_CONFLICT", "STOCK_ADDRESS_IN_USE", "STOCK_ADDRESS_OCCUPIED"].includes(error.code)) {
    return res.status(409).json({ erro: error.message });
  }
  if (error.code?.startsWith("STOCK_INVALID_")) {
    return res.status(400).json({ erro: error.message });
  }

  console.error(`Falha ao ${operacao}:`, error.message);
  return res.status(500).json({ erro: `Nao foi possivel ${operacao}.` });
}

/** Retorna todas as posicoes e o produto guardado em cada uma. */
export async function listarMapa(req, res) {
  try {
    const mapa = await buscarMapaDoLocal(req.empresaAuth.id, req.query.estoque_id);
    return res.status(200).json(mapa);
  } catch (error) {
    return responderErroEstoque(res, error, "carregar o mapa do estoque");
  }
}

/** Cria uma posicao fisica dentro de um local da empresa autenticada. */
export async function criarEndereco(req, res) {
  try {
    const endereco = await cadastrarEndereco(req.empresaAuth.id, req.body.estoque_id, req.body);
    return res.status(201).json({ mensagem: "Posicao criada no mapa.", endereco });
  } catch (error) {
    return responderErroEstoque(res, error, "criar a posicao");
  }
}

/** Atualiza corredor, estante, prateleira, posicao ou nome amigavel. */
export async function atualizarEndereco(req, res) {
  try {
    const endereco = await editarEndereco(req.empresaAuth.id, req.params.id, req.body);
    return res.status(200).json({ mensagem: "Posicao atualizada.", endereco });
  } catch (error) {
    return responderErroEstoque(res, error, "atualizar a posicao");
  }
}

/** Remove apenas posicoes que nao tenham produto guardado. */
export async function deletarEndereco(req, res) {
  try {
    await removerEndereco(req.empresaAuth.id, req.params.id);
    return res.status(200).json({ mensagem: "Posicao removida do mapa." });
  } catch (error) {
    return responderErroEstoque(res, error, "remover a posicao");
  }
}

/** Guarda ou move um produto para a posicao selecionada. */
export async function atribuirProdutoEndereco(req, res) {
  try {
    await moverProdutoNoMapa(req.empresaAuth.id, req.params.id, req.body);
    return res.status(200).json({ mensagem: "Produto movido para a posicao selecionada." });
  } catch (error) {
    return responderErroEstoque(res, error, "mover o produto");
  }
}

/** Remove a associacao atual sem apagar o produto nem a posicao. */
export async function desocuparEndereco(req, res) {
  try {
    await liberarProdutoDoMapa(req.empresaAuth.id, req.params.id, req.body);
    return res.status(200).json({ mensagem: "Produto retirado da posicao." });
  } catch (error) {
    return responderErroEstoque(res, error, "retirar o produto da posicao");
  }
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
