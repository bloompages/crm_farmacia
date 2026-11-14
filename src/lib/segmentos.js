/**
 * Segmentos de negócio. O CRM é o mesmo para qualquer empresa; o segmento escolhido em
 * Configurações › Empresa e integrações só muda o que é específico do ramo:
 *
 *  - saude: liga o campo "Convênio / plano" do lead, o motivo de perda "convênio" e o
 *    trecho de dados de saúde (LGPD art. 11) na política de privacidade;
 *  - categorias: sugestões de categoria de produto/serviço (planilhas e orçamentos);
 *  - termosOrcamento: palavras do ramo que indicam pedido de orçamento na conversa;
 *  - exemplos: textos de exemplo nos campos, para a equipe entender o que preencher.
 *
 * Para criar um segmento novo basta acrescentar uma entrada aqui.
 */
export const SEGMENTOS = {
  GERAL: {
    nome: "Outro / geral",
    saude: false,
    categorias: ["Produto", "Serviço"],
    termosOrcamento: [],
    exemplos: { interesses: "produto A, serviço B", item: "Descrição do produto ou serviço", nota: "Pediu desconto à vista…", empresa: "Minha Empresa" },
  },
  FARMACIA: {
    nome: "Farmácia / drogaria",
    saude: true,
    categorias: ["Medicamento", "Manipulado", "Dermocosmético", "Suplemento", "Perfumaria"],
    termosOrcamento: ["manipulado", "manipulação", "manipulacao", "fórmula", "formula", "receita", "prescrição", "prescricao", "convênio", "convenio"],
    exemplos: { interesses: "manipulados, dermocosméticos", item: "Fórmula manipulada 60 cápsulas", nota: "Ligou pedindo desconto no manipulado…", empresa: "Farmácia São João", convenio: "Unimed, Bradesco Saúde, Farmácia Popular…" },
  },
  SAUDE: {
    nome: "Clínica / consultório",
    saude: true,
    categorias: ["Consulta", "Exame", "Procedimento", "Pacote"],
    termosOrcamento: ["consulta", "agendar", "agendamento", "marcar", "exame", "procedimento", "avaliação", "avaliacao", "pedido médico", "pedido medico", "convênio", "convenio"],
    exemplos: { interesses: "avaliação, pacote de sessões", item: "Pacote 10 sessões", nota: "Quer agendar para a próxima semana…", empresa: "Clínica Bem Estar", convenio: "Unimed, Amil, particular…" },
  },
  VAREJO: {
    nome: "Loja / varejo",
    saude: false,
    categorias: ["Produto", "Acessório", "Kit", "Promoção"],
    termosOrcamento: ["tamanho", "cor", "modelo", "tem no", "frete", "atacado", "revenda"],
    exemplos: { interesses: "lançamentos, promoções", item: "Camiseta básica M", nota: "Perguntou se chega até sexta…", empresa: "Loja Exemplo" },
  },
  SERVICOS: {
    nome: "Serviços",
    saude: false,
    categorias: ["Serviço", "Pacote", "Mensalidade", "Visita técnica"],
    termosOrcamento: ["agendar", "visita", "proposta", "contrato", "mensalidade", "plano", "instalação", "instalacao", "manutenção", "manutencao"],
    exemplos: { interesses: "manutenção mensal", item: "Visita técnica", nota: "Pediu proposta para o contrato anual…", empresa: "Serviços Exemplo" },
  },
};

export const SEGMENTO_PADRAO = "GERAL";

export const segmentoDe = (id) => SEGMENTOS[id] ?? SEGMENTOS[SEGMENTO_PADRAO];

export const listaSegmentos = () => Object.entries(SEGMENTOS).map(([id, s]) => ({ id, nome: s.nome }));
