import {
  atualizarEndereco,
  buscarLocalDaEmpresa,
  excluirEndereco,
  inserirEndereco,
  inserirLocalDaEmpresa,
  inserirMovimentacaoDaEmpresa,
  listarEnderecosDoMapa,
  listarLocaisDaEmpresa,
  listarMovimentacoesDoLocal,
  listarSaldosDoLocal,
  moverProdutoParaEndereco,
  retirarProdutoDoEndereco,
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

/** Valida um ID numerico antes de usa-lo em consultas do mapa. */
function validarIdMapa(valor, campo) {
  try {
    return validarId(valor, campo);
  } catch {
    throw criarErroEstoque("STOCK_INVALID_ID", `O identificador de ${campo} e invalido.`);
  }
}

/** Confere que um campo do endereco e curto e nao vazio. */
function validarParteEndereco(valor, campo) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!texto || texto.length > 40) {
    throw criarErroEstoque("STOCK_INVALID_ADDRESS", `Preencha ${campo} com ate 40 caracteres.`);
  }
  return texto;
}

/** Limpa os campos que compoem a posicao fisica no mapa. */
function validarEndereco(dados) {
  const nome = typeof dados?.nome === "string" ? dados.nome.trim() : "";
  if (nome.length > 100) {
    throw criarErroEstoque("STOCK_INVALID_ADDRESS", "O nome da posicao pode ter ate 100 caracteres.");
  }
  return {
    corredor: validarParteEndereco(dados?.corredor, "o corredor"),
    estante: validarParteEndereco(dados?.estante, "a estante"),
    prateleira: validarParteEndereco(dados?.prateleira, "a prateleira"),
    posicao: validarParteEndereco(dados?.posicao, "a posicao"),
    nome: nome || null,
  };
}

/** Lista o mapa depois de verificar que o local pertence ao tenant do JWT. */
export async function buscarMapaDoLocal(empresaId, estoqueIdInformado) {
  const estoqueId = validarIdMapa(estoqueIdInformado, "local");
  const local = await buscarLocalDaEmpresa(empresaId, estoqueId);
  if (!local) throw criarErroEstoque("STOCK_LOCATION_NOT_FOUND", "Local nao encontrado nesta empresa.");
  const enderecos = await listarEnderecosDoMapa(empresaId, estoqueId);
  return { local, enderecos };
}

/** Registra uma posicao no mapa fisico do local selecionado. */
export async function cadastrarEndereco(empresaId, estoqueIdInformado, dados) {
  const estoqueId = validarIdMapa(estoqueIdInformado, "local");
  if (!await buscarLocalDaEmpresa(empresaId, estoqueId)) {
    throw criarErroEstoque("STOCK_LOCATION_NOT_FOUND", "Local nao encontrado nesta empresa.");
  }
  const endereco = validarEndereco(dados);
  try {
    return await inserirEndereco(empresaId, estoqueId, endereco);
  } catch (error) {
    if (error.code === "23505") {
      throw criarErroEstoque("STOCK_ADDRESS_CONFLICT", "Essa posicao ja existe neste local.");
    }
    throw error;
  }
}

/** Edita o nome e as coordenadas de uma posicao existente. */
export async function editarEndereco(empresaId, enderecoIdInformado, dados) {
  const enderecoId = validarIdMapa(enderecoIdInformado, "posicao");
  const endereco = validarEndereco(dados);
  try {
    const atualizado = await atualizarEndereco(empresaId, enderecoId, endereco);
    if (!atualizado) throw criarErroEstoque("STOCK_ADDRESS_NOT_FOUND", "Posicao nao encontrada nesta empresa.");
    return atualizado;
  } catch (error) {
    if (error.code === "23505") {
      throw criarErroEstoque("STOCK_ADDRESS_CONFLICT", "Essa posicao ja existe neste local.");
    }
    throw error;
  }
}

/** Impede apagar uma posicao que ainda guarda um produto. */
export async function removerEndereco(empresaId, enderecoIdInformado) {
  const enderecoId = validarIdMapa(enderecoIdInformado, "posicao");
  const removido = await excluirEndereco(empresaId, enderecoId);
  if (!removido) {
    throw criarErroEstoque("STOCK_ADDRESS_IN_USE", "Posicao nao encontrada ou ainda ocupada por um produto.");
  }
}

/** Move o produto para outra posicao do mesmo local, com verificacao de empresa. */
export async function moverProdutoNoMapa(empresaId, enderecoIdInformado, dados) {
  const enderecoId = validarIdMapa(enderecoIdInformado, "posicao");
  const estoqueId = validarIdMapa(dados?.estoque_id, "local");
  const produtoId = validarIdMapa(dados?.produto_id, "produto");
  const resultado = await moverProdutoParaEndereco(empresaId, estoqueId, enderecoId, produtoId);
  if (resultado.tipo === "endereco") {
    throw criarErroEstoque("STOCK_ADDRESS_NOT_FOUND", "Posicao nao encontrada neste local da empresa.");
  }
  if (resultado.tipo === "produto") {
    throw criarErroEstoque("STOCK_REFERENCE_NOT_FOUND", "Produto nao encontrado ou inativo nesta empresa.");
  }
  if (resultado.tipo === "ocupado") {
    throw criarErroEstoque("STOCK_ADDRESS_OCCUPIED", "Essa posicao ja esta ocupada por outro produto.");
  }
}

/** Libera um produto da posicao para que possa ser guardado em outro lugar. */
export async function liberarProdutoDoMapa(empresaId, enderecoIdInformado, dados) {
  const enderecoId = validarIdMapa(enderecoIdInformado, "posicao");
  const estoqueId = validarIdMapa(dados?.estoque_id, "local");
  const liberado = await retirarProdutoDoEndereco(empresaId, estoqueId, enderecoId);
  if (!liberado) throw criarErroEstoque("STOCK_ADDRESS_NOT_FOUND", "Produto nao encontrado nesta posicao.");
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
