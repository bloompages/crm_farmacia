/**
 * Motor de identificação de novos leads.
 * Lê o texto de uma mensagem recebida (WhatsApp/Instagram) e classifica a
 * intenção comercial, gerando um score que alimenta a temperatura do lead.
 */

const SINAIS = [
  { intencao: "ORCAMENTO", peso: 40, termos: ["orçamento", "orcamento", "cotação", "cotacao", "cotar", "faz por quanto", "me passa o valor"] },
  { intencao: "COMPRA", peso: 35, termos: ["quanto custa", "qual o preço", "qual o preco", "preço", "preco", "valor do", "quero comprar", "vou levar", "fecha", "tem pronta entrega"] },
  { intencao: "COMPRA", peso: 30, termos: ["tem disponível", "tem disponivel", "tem em estoque", "chegou", "vocês têm", "voces tem", "vcs tem"] },
  { intencao: "ORCAMENTO", peso: 30, termos: ["manipulado", "manipulação", "manipulacao", "fórmula", "formula", "receita", "prescrição", "prescricao"] },
  { intencao: "COMPRA", peso: 20, termos: ["entrega", "delivery", "leva em casa", "retirar", "pix", "cartão", "cartao", "parcelar"] },
  { intencao: "COMPRA", peso: 25, termos: ["convênio", "convenio", "empresa", "cnpj", "clínica", "clinica", "consultório", "consultorio", "para minha equipe", "recorrente", "mensal"] },
  { intencao: "DUVIDA", peso: 8, termos: ["como usar", "posologia", "serve para", "efeito", "dúvida", "duvida", "horário", "horario", "aberto"] },
  { intencao: "RECLAMACAO", peso: 5, termos: ["reclamação", "reclamacao", "problema", "errado", "demorou", "péssimo", "pessimo", "cancelar"] },
];

const normalizar = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** @returns {{intencao: string, score: number, termos: string[]}} */
export function analisarIntencao(texto) {
  const alvo = normalizar(texto);
  let score = 0;
  const encontrados = [];
  const pontosPorIntencao = {};

  for (const sinal of SINAIS) {
    for (const termo of sinal.termos) {
      if (alvo.includes(normalizar(termo))) {
        score += sinal.peso;
        encontrados.push(termo);
        pontosPorIntencao[sinal.intencao] = (pontosPorIntencao[sinal.intencao] ?? 0) + sinal.peso;
        break; // conta cada grupo de sinais uma única vez
      }
    }
  }

  // Menção a quantidade ("10 caixas", "3 unidades") indica volume de compra
  if (/\b\d{1,4}\s*(caixas?|unidades?|frascos?|comprimidos?|ampolas?)\b/.test(alvo)) {
    score += 20;
    encontrados.push("quantidade");
    pontosPorIntencao.COMPRA = (pontosPorIntencao.COMPRA ?? 0) + 20;
  }

  const intencao =
    Object.entries(pontosPorIntencao).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "OUTRO";

  return { intencao, score: Math.min(score, 100), termos: encontrados };
}

/** Temperatura do lead a partir do score acumulado. */
export function temperaturaPorScore(score) {
  if (score >= 60) return "QUENTE";
  if (score >= 25) return "MORNO";
  return "FRIO";
}

/** Um lead só é "identificado" como oportunidade comercial acima deste corte. */
export const CORTE_OPORTUNIDADE = 25;
