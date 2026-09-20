import { db } from "./db.js";
import { ETAPAS, MOTIVOS_REJEICAO } from "./constantes.js";

export function inicioPeriodo(dias = 30) {
  const d = new Date();
  d.setDate(d.getDate() - Number(dias || 30));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Números do painel principal. */
export async function resumoComercial(dias = 30) {
  const desde = inicioPeriodo(dias);

  const [novosLeads, leadsPorOrigem, funil, orcamentos, conversasAbertas, naoLidas] = await Promise.all([
    db.lead.count({ where: { createdAt: { gte: desde } } }),
    db.lead.groupBy({ by: ["origem"], _count: true, where: { createdAt: { gte: desde } } }),
    db.lead.groupBy({ by: ["etapa"], _count: true }),
    db.orcamento.findMany({
      where: { createdAt: { gte: desde } },
      select: { status: true, total: true, motivoRejeicao: true, precoConcorrente: true },
    }),
    db.conversa.count({ where: { status: "ABERTA" } }),
    db.conversa.aggregate({ _sum: { naoLidas: true } }),
  ]);

  const por = (s) => orcamentos.filter((o) => o.status === s);
  const soma = (lista) => lista.reduce((t, o) => t + o.total, 0);

  const aceitos = por("ACEITO");
  const rejeitados = por("REJEITADO");
  const fechados = aceitos.length + rejeitados.length + por("EXPIRADO").length;

  return {
    dias: Number(dias),
    novosLeads,
    leadsPorOrigem: leadsPorOrigem.map((l) => ({ origem: l.origem, total: l._count })),
    funil: ETAPAS.map((e) => ({
      ...e,
      total: funil.find((f) => f.etapa === e.id)?._count ?? 0,
    })),
    orcamentosCriados: orcamentos.length,
    valorEmAberto: soma(por("RASCUNHO").concat(por("ENVIADO"))),
    valorGanho: soma(aceitos),
    valorPerdido: soma(rejeitados),
    qtdAceitos: aceitos.length,
    qtdRejeitados: rejeitados.length,
    ticketMedioGanho: aceitos.length ? soma(aceitos) / aceitos.length : 0,
    ticketMedioPerdido: rejeitados.length ? soma(rejeitados) / rejeitados.length : 0,
    taxaConversao: fechados ? (aceitos.length / fechados) * 100 : 0,
    conversasAbertas,
    naoLidas: naoLidas._sum.naoLidas ?? 0,
  };
}

/** Quantificação das rejeições: quanto cada motivo custou em R$. */
export async function analiseRejeicoes(dias = 90) {
  const desde = inicioPeriodo(dias);
  const rejeitados = await db.orcamento.findMany({
    where: { status: "REJEITADO", fechadoEm: { gte: desde } },
    include: { lead: { select: { id: true, nome: true, origem: true } } },
    orderBy: { fechadoEm: "desc" },
  });

  const porMotivo = MOTIVOS_REJEICAO.map((m) => {
    const doMotivo = rejeitados.filter((o) => o.motivoRejeicao === m.id);
    const valor = doMotivo.reduce((t, o) => t + o.total, 0);
    const comparaveis = doMotivo.filter((o) => o.precoConcorrente);
    const gap = comparaveis.length
      ? comparaveis.reduce((t, o) => t + (o.total - o.precoConcorrente), 0) / comparaveis.length
      : null;
    return { ...m, quantidade: doMotivo.length, valor, gapMedio: gap };
  })
    .filter((m) => m.quantidade > 0)
    .sort((a, b) => b.valor - a.valor);

  const totalPerdido = rejeitados.reduce((t, o) => t + o.total, 0);

  const porConcorrente = Object.values(
    rejeitados
      .filter((o) => o.concorrente)
      .reduce((acc, o) => {
        acc[o.concorrente] ??= { nome: o.concorrente, quantidade: 0, valor: 0 };
        acc[o.concorrente].quantidade++;
        acc[o.concorrente].valor += o.total;
        return acc;
      }, {})
  ).sort((a, b) => b.valor - a.valor);

  return { dias: Number(dias), rejeitados, porMotivo, totalPerdido, porConcorrente };
}

/** Série semanal de resultado: ganho (acima) x perdido (abaixo) em R$. */
export async function serieSemanal(semanas = 8) {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  inicio.setDate(inicio.getDate() - inicio.getDay() - 7 * (semanas - 1)); // domingo da 1ª semana

  const fechados = await db.orcamento.findMany({
    where: { status: { in: ["ACEITO", "REJEITADO"] }, fechadoEm: { gte: inicio } },
    select: { status: true, total: true, fechadoEm: true },
  });

  const baldes = Array.from({ length: semanas }, (_, i) => {
    const de = new Date(inicio);
    de.setDate(de.getDate() + i * 7);
    const ate = new Date(de);
    ate.setDate(ate.getDate() + 6);
    return { de, ate, ganho: 0, perdido: 0, qtdGanho: 0, qtdPerdido: 0 };
  });

  for (const o of fechados) {
    const i = Math.floor((o.fechadoEm - inicio) / (7 * 24 * 3600 * 1000));
    const b = baldes[i];
    if (!b) continue;
    if (o.status === "ACEITO") { b.ganho += o.total; b.qtdGanho++; }
    else { b.perdido += o.total; b.qtdPerdido++; }
  }

  return baldes.map((b) => ({
    rotulo: b.de.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    periodo: `${b.de.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${b.ate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`,
    ganho: Math.round(b.ganho),
    perdido: Math.round(b.perdido),
    qtdGanho: b.qtdGanho,
    qtdPerdido: b.qtdPerdido,
  }));
}

/** Valor em aberto por etapa, para o funil. */
export async function funilComValor() {
  const leads = await db.lead.findMany({
    select: { etapa: true, orcamentos: { select: { status: true, total: true } } },
  });
  return ETAPAS.map((e) => {
    const daEtapa = leads.filter((l) => l.etapa === e.id);
    return {
      id: e.id,
      label: e.label,
      total: daEtapa.length,
      valor: daEtapa.reduce(
        (t, l) => t + l.orcamentos.filter((o) => ["RASCUNHO", "ENVIADO"].includes(o.status)).reduce((s, o) => s + o.total, 0),
        0
      ),
    };
  });
}
