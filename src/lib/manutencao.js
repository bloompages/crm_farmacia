import { db } from "./db.js";
import { scoreEsfriado, temperaturaPorScore } from "./intencao.js";
import { STATUS_ABERTOS } from "./orcamento.js";

const INTERVALO_MS = 10 * 60 * 1000;
const ORDEM_TEMPERATURA = ["FRIO", "MORNO", "QUENTE"];

/**
 * Rotinas que dependem só da passagem do tempo: expirar orçamentos vencidos e
 * esfriar o score de quem parou de falar. Rodam sob demanda (as telas de números
 * chamam antes de consultar), no máximo a cada 10 min por processo — sem cron.
 * Uma falha aqui nunca derruba a tela.
 */
export async function manutencao() {
  const g = globalThis;
  if (g.__manutencaoEm && Date.now() - g.__manutencaoEm < INTERVALO_MS) return g.__manutencaoRodando;
  g.__manutencaoEm = Date.now();
  g.__manutencaoRodando = (async () => {
    try {
      return { expirados: await expirarOrcamentos(), esfriados: await esfriarLeads(), ...(await aplicarRetencao()) };
    } catch (e) {
      console.error("[manutencao] falhou", e);
      g.__manutencaoEm = 0; // tenta de novo na próxima requisição
      return null;
    }
  })();
  return g.__manutencaoRodando;
}

/**
 * Retenção (LGPD art. 15/16): o payload bruto do webhook traz telefone e texto das
 * mensagens e só serve para reprocessar falhas. Processados com sucesso saem em
 * RETENCAO_WEBHOOK_DIAS; com erro, ficam o dobro para dar tempo de investigar.
 */
export const RETENCAO_WEBHOOK_DIAS = 30;

export async function aplicarRetencao(agora = new Date()) {
  const dias = (n) => new Date(agora.getTime() - n * 86400000);
  const [ok, erro, sessoes] = await db.$transaction([
    db.eventoWebhook.deleteMany({ where: { status: { in: ["OK", "IGNORADO"] }, recebidoEm: { lt: dias(RETENCAO_WEBHOOK_DIAS) } } }),
    db.eventoWebhook.deleteMany({ where: { status: { in: ["ERRO", "PENDENTE"] }, recebidoEm: { lt: dias(RETENCAO_WEBHOOK_DIAS * 2) } } }),
    db.sessao.deleteMany({ where: { expiraEm: { lt: agora } } }),
  ]);
  return { webhooksApagados: ok.count + erro.count, sessoesApagadas: sessoes.count };
}

/** RASCUNHO/ENVIADO com validade vencida → EXPIRADO (sai do "valor em aberto"). */
export async function expirarOrcamentos(agora = new Date()) {
  const vencidos = await db.orcamento.findMany({
    where: { status: { in: STATUS_ABERTOS }, validadeEm: { lt: agora } },
    select: { id: true, numero: true, leadId: true, validadeEm: true },
  });
  for (const o of vencidos) {
    await db.$transaction([
      db.orcamento.update({ where: { id: o.id }, data: { status: "EXPIRADO", fechadoEm: agora } }),
      db.atividade.create({
        data: {
          leadId: o.leadId,
          tipo: "ORCAMENTO",
          descricao: `Orçamento #${o.numero} expirou (validade ${o.validadeEm.toLocaleDateString("pt-BR")}) sem resposta do cliente`,
        },
      }),
    ]);
  }
  return vencidos.length;
}

/** Recalcula o score atual a partir da base e baixa a temperatura quando ele cai de faixa. */
export async function esfriarLeads(agora = new Date()) {
  const ontem = new Date(agora.getTime() - 86400000);
  const leads = await db.lead.findMany({
    where: { score: { gt: 0 }, scoreBase: { gt: 0 }, scoreEm: { lt: ontem } },
    select: { id: true, score: true, scoreBase: true, scoreEm: true, temperatura: true },
  });

  const atualizacoes = leads.flatMap((l) => {
    const score = scoreEsfriado(l.scoreBase, l.scoreEm, agora);
    if (score === l.score) return [];
    // só esfria: uma temperatura definida à mão acima do score não é rebaixada sem o score mudar de faixa
    const derivada = temperaturaPorScore(score);
    const temperatura =
      ORDEM_TEMPERATURA.indexOf(derivada) < ORDEM_TEMPERATURA.indexOf(l.temperatura) ? derivada : l.temperatura;
    return [db.lead.update({ where: { id: l.id }, data: { score, temperatura } })];
  });

  for (let i = 0; i < atualizacoes.length; i += 200) await db.$transaction(atualizacoes.slice(i, i + 200));
  return atualizacoes.length;
}
