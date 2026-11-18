# 9. DESENVOLVIMENTO DO SISTEMA KITA WMS

## 9.1 Visao geral

O KITA WMS e uma aplicacao web voltada ao controle de produtos e de movimentacoes de estoque em empresas que necessitam organizar seus locais de armazenagem. A proposta e reunir, em uma interface visual, o cadastro dos produtos, a consulta de saldos, o registro de entradas e saidas e a consulta do historico operacional. O sistema tambem possui um modulo de mapa fisico, que representa os enderecos internos de um local por corredor, estante, prateleira e posicao.

A aplicacao foi estruturada para que cada empresa acesse seus proprios dados. No prototipo atual, a empresa e a unidade de autenticacao: ela entra com e-mail e senha e as operacoes protegidas sao associadas a sua identificacao. O sistema nao oferece, nesta versao, cadastro publico de empresas nem contas individuais para funcionarios.

## 9.2 Tecnologias e organizacao

O backend foi desenvolvido em JavaScript com Node.js e Express. Ele recebe as requisicoes do navegador, valida os dados e consulta ou atualiza o PostgreSQL. O frontend utiliza HTML, CSS e JavaScript no navegador, sem depender de um framework de interface. O banco pode ser acessado localmente durante o desenvolvimento ou hospedado no Supabase; a API pode ser publicada em um servico como o Render por meio de variaveis de ambiente.

O codigo do servidor segue uma separacao em rotas, controllers, services e models. As rotas definem os caminhos HTTP e quais deles exigem autenticacao. Os controllers recebem as requisicoes e montam as respostas. Os services concentram validacoes e regras de negocio. Os models executam as consultas SQL no banco. Essa divisao reduz a concentracao de responsabilidades em um unico arquivo e facilita a manutencao e a evolucao do sistema.

## 9.3 Autenticacao e separacao dos dados das empresas

O acesso comeca pela tela de login, na qual a empresa informa e-mail e senha. A senha armazenada no banco e um hash produzido com bcrypt; portanto, o sistema nao precisa guardar a senha original em texto puro. Quando as credenciais sao validas, o backend emite um token JWT com prazo de validade configurado. O navegador envia esse token nas requisicoes protegidas.

O middleware de autenticacao valida o token e identifica a empresa correspondente. Nas consultas e gravacoes de produtos e estoque, o servidor utiliza essa identificacao para limitar os dados a empresa autenticada. Assim, o identificador da empresa nao e escolhido livremente pelo formulario do navegador. Ao sair, a interface remove o token armazenado no navegador e retorna a pessoa usuaria para a tela de login.

## 9.4 Cadastro e consulta de produtos

Na tela de produtos, a empresa pode cadastrar e consultar itens com nome, SKU, preco e estoque minimo. O SKU e normalizado para letras maiusculas e deve ser unico dentro da empresa, permitindo que empresas diferentes utilizem codigos iguais sem misturar seus cadastros. A tela tambem permite editar os dados de um produto ativo.

A opcao de exclusao realiza uma inativacao logica: o produto deixa de aparecer na lista ativa, mas seu registro nao e removido do banco. Essa decisao preserva as referencias das movimentacoes anteriores. O SKU permanece reservado para evitar que um novo produto reutilize o codigo associado ao historico existente.

O saldo atual apresentado para cada produto e calculado a partir do saldo mais recente desse produto em cada local de estoque. O estoque minimo funciona como parametro de alerta: quando o saldo total fica igual ou abaixo do valor definido, a interface indica a necessidade de reposicao. O cadastro do produto nao cria saldo; o saldo inicial por local e zero e passa a ser atualizado por meio das movimentacoes.

## 9.5 Locais e mapa fisico

A empresa pode cadastrar locais de armazenagem, como depositos ou areas internas. Cada local mantem seus saldos e seu historico de movimentacoes. A tela de movimentacoes pode ser aberta com um local pre-selecionado a partir da lista de locais.

O modulo de mapa fisico permite representar enderecos dentro de um local usando corredor, estante, prateleira e posicao, alem de um nome amigavel opcional. A interface agrupa e organiza visualmente as estantes do mesmo corredor. A empresa pode cadastrar e editar posicoes, associar um produto a um endereco, mover o produto para outra posicao e liberar um endereco. O mapa descreve a localizacao fisica: mover um produto no mapa nao altera seu saldo nem cria uma entrada ou saida.

O mapa utiliza tabelas especificas, criadas pela migracao `database/migracao_mapa_estoque.sql`. Por isso, ele so pode persistir enderecos em um banco no qual essa migracao tenha sido aplicada. As demais funcionalidades descritas neste capitulo utilizam o esquema principal do estoque.

## 9.6 Recebimento, expedicao e controle de saldo

O sistema registra entradas e saidas de produtos em um local selecionado. Para cada operacao, a pessoa usuaria informa o produto e uma quantidade inteira positiva. A entrada aumenta o saldo; a saida diminui o saldo disponivel. O servidor recusa uma saida quando a quantidade solicitada supera o saldo existente naquele local.

Cada movimentacao e registrada com empresa, local, produto, tipo, quantidade, data e saldo resultante. O registro e feito dentro de uma transacao no PostgreSQL, de forma que a gravacao do movimento e a atualizacao logica do saldo ocorram como uma operacao consistente. O sistema guarda uma linha por movimento, preservando o historico em vez de sobrescrever as operacoes anteriores.

O prototipo cobre o registro basico de recebimento e retirada. Nesta versao, o usuario ainda nao cria pedidos de venda ou compra, nao gera nota fiscal, nao informa lote ou validade e nao realiza estorno ou ajuste manual pela interface. Esses recursos podem ser incluidos em etapas posteriores, mas nao devem ser apresentados como funcionalidades ja concluidas.

## 9.7 Leitura de codigo de barras

As telas de produtos e de movimentacoes oferecem leitura de codigo de barras pela camera do dispositivo. A biblioteca ZXing, servida localmente pela aplicacao, interpreta o codigo e o sistema procura o texto lido como SKU entre os produtos da empresa autenticada. Na tela de produtos, a leitura pode preencher o SKU no cadastro; na movimentacao, pode selecionar o produto encontrado.

A leitura serve para identificar o produto e nao registra uma movimentacao automaticamente. A pessoa usuaria ainda precisa escolher entrada ou saida, informar a quantidade e confirmar a operacao. Caso nao seja possivel usar a camera, o SKU pode ser digitado manualmente. O navegador requer uma origem segura para liberar a camera: em desenvolvimento, pode-se usar `localhost`; em hospedagem, a pagina precisa estar em HTTPS. A selecao de camera e o zoom dependem dos recursos informados pelo aparelho e pelo navegador.

## 9.8 Painel e historico

A tela inicial apresenta indicadores consultados no banco para a empresa autenticada, incluindo quantidade de produtos ativos, unidades somadas entre locais, produtos no estoque minimo, quantidade de locais e totais de entradas e saidas do dia. Tambem exibe movimentacoes recentes e oferece atalhos para as operacoes principais.

A tela de historico permite consultar movimentacoes da empresa e aplicar filtros por tipo, nome ou SKU do produto e intervalo de datas. O historico pode ser consultado de forma geral ou pela tela de um local. Essas informacoes permitem acompanhar as alteracoes de saldo e localizar operacoes anteriores sem apagar o registro original.

## 9.9 Interface e acesso em diferentes dispositivos

As paginas foram organizadas com navegacao compartilhada entre o painel, produtos, locais, entradas, saidas, movimentacoes e historico. A interface utiliza tabelas, formularios, indicadores e mensagens de confirmacao ou erro para tornar as operacoes mais compreensiveis. Os estilos responsivos adaptam os componentes a larguras menores, permitindo o uso em computadores e celulares.

O acesso a camera em celulares depende da permissao concedida pelo usuario e do suporte do dispositivo. O modo de digitacao manual continua disponivel como alternativa. A responsividade da interface facilita o acesso em telas menores, mas nao elimina as diferencas de camera, navegador e conexao entre aparelhos.

## 9.10 Limites do prototipo e evolucao

O KITA WMS implementa atualmente autenticacao de empresas, cadastro e manutencao de produtos, cadastro de locais, controle de entradas e saidas, consulta de saldos, leitura de SKU pela camera, painel e historico, alem do mapa fisico quando a migracao correspondente esta habilitada no banco. O escopo atual nao inclui cadastro de clientes pela interface, pedidos, notas fiscais, lotes, previsao de demanda, usuarios individuais, recuperacao de senha, estorno de movimentacoes ou ajuste manual de saldo.

Essa delimitacao permite apresentar com clareza o que o prototipo realiza e quais partes podem ser desenvolvidas futuramente. A evolucao pode incluir controle de lotes e validade, associacao das movimentacoes a documentos, gestao de pedidos, cadastro de clientes, perfis de funcionarios e relatorios adicionais, desde que sejam acompanhados das alteracoes necessarias no banco, nas regras do servidor e nas interfaces.
