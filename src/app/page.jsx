import Link from "next/link";
import { db } from "@/lib/db";
import { resumoComercial, analiseRejeicoes, serieSemanal, funilComValor, resumoAtendimento, leadsPorDia, aniversariantes } from "@/lib/metricas";
import { brl, dataHora, corEtapa, labelEtapa } from "@/lib/constantes";
import { GraficoResultado, GraficoFunil, GraficoMotivos, GraficoOrigens, GraficoLeadsDia } from "@/components/Graficos";
import { CANAL, chipFiltro } from "@/lib/tema";
import { descreverMensagem } from "@/lib/conversa";
import { previaTexto } from "@/lib/formatacao";
import PainelBoard from "@/components/PainelBoard";
import { manutencao } from "@/lib/manutencao";

export const dynamic = "force-dynamic";

/** Número grande de um cartão de indicador. */
function Indicador({ valor, detalhe, destaque = false }) {
  return (
    <div>
      <div className={`font-semibold leading-none tracking-tight text-slate-900 ${destaque ? "text-4xl" : "text-2xl"}`}>{valor}</div>
      {detalhe && <div className="mt-2 text-xs text-slate-400">{detalhe}</div>}
    </div>
  );
}

const LinkAcao = ({ href, children }) => (
  <Link href={href} className="text-xs text-emerald-700 hover:underline">{children}</Link>
);

/** Arranjo inicial das listas (o usuário reorganiza e o navegador lembra). */
const LAYOUT_PADRAO = [
  ["atendimento", "em-aberto", "novos-leads", "ganho", "perdido", "conversao"],
  ["leads-dia", "resultado-semana", "funil"],
  ["motivos", "origens", "quentes", "aniversariantes", "ultimas"],
];

/** Mini-indicador dentro de um cartão com vários números. */
const Numero = ({ rotulo, valor, href, alerta = false }) => {
  const corpo = (
    <>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{rotulo}</div>
      <div className={`text-2xl font-semibold leading-tight ${alerta ? "text-rose-600" : "text-slate-900"}`} style={{ fontVariantNumeric: "tabular-nums" }}>{valor}</div>
    </>
  );
  return href ? <Link href={href} className="block rounded-lg p-1 hover:bg-slate-50">{corpo}</Link> : <div className="p-1">{corpo}</div>;
};

export default async function Painel({ searchParams }) {
  await manutencao(); // expira orçamentos vencidos e esfria scores antes de mostrar números
  const sp = await searchParams;
  const dias = Number(sp?.dias ?? 30);
  const semanas = dias <= 7 ? 4 : dias <= 30 ? 8 : 12;

  const [r, rej, semanal, funil, quentes, ultimas, atend, porDia, aniver] = await Promise.all([
    resumoComercial(dias),
    analiseRejeicoes(dias),
    serieSemanal(semanas),
    funilComValor(),
    db.lead.findMany({
      where: { temperatura: "QUENTE", etapa: { notIn: ["APROVADO", "PERDIDO"] } },
      orderBy: { score: "desc" },
      take: 5,
    }),
    db.mensagem.findMany({
      where: { direcao: "ENTRADA" },
      orderBy: { enviadoEm: "desc" },
      take: 5,
      include: { conversa: true },
    }),
    resumoAtendimento(dias),
    leadsPorDia(dias),
    aniversariantes(7),
  ]);

  const cartoes = [
    {
      id: "atendimento",
      titulo: "Atendimento",
      descricao: `Conversas nos últimos ${r.dias} dias · ${atend.mensagens} mensagem(ns)`,
      acao: <LinkAcao href="/inbox">abrir inbox</LinkAcao>,
      conteudo: (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Numero rotulo="No período" valor={atend.noPeriodo} />
            <Numero rotulo="Em aberto" valor={atend.emAberto} href="/inbox" />
            <Numero rotulo="Encerradas" valor={atend.encerradas} />
            <Numero rotulo="Sem resposta" valor={atend.semResposta} href="/inbox" alerta={atend.semResposta > 0} />
          </div>
          {atend.porCanal.length > 0 && (
            <div className="space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
              {atend.porCanal.map((c) => (
                <div key={c.canal} className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${CANAL[c.canal]?.ponto ?? "bg-slate-300"}`} />
                  {CANAL[c.canal]?.rotulo ?? c.canal}
                  <span className="ml-auto font-medium text-slate-700" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {c.total} · {Math.round((c.total / Math.max(1, atend.noPeriodo)) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "leads-dia",
      titulo: "Novos leads por dia",
      descricao: `Últimos ${r.dias} dias`,
      acao: <LinkAcao href="/leads">ver leads</LinkAcao>,
      conteudo: <GraficoLeadsDia dados={porDia} />,
    },
    {
      id: "aniversariantes",
      titulo: "Aniversariantes",
      descricao: "Próximos 7 dias — mensagem só para quem autorizou contato",
      conteudo:
        aniver.length === 0 ? (
          <p className="text-sm text-slate-400">Ninguém faz aniversário nos próximos 7 dias.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {aniver.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                <Link href={`/leads/${l.id}`} className="min-w-0 truncate text-sm font-medium text-slate-800 hover:text-emerald-700">{l.nome}</Link>
                <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                  {l.emDias === 0 ? <b className="text-emerald-700">hoje 🎂</b> : l.proximo.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                  {!l.consentimentoMarketing && <span className="chip border-slate-200 bg-white text-slate-400" title="Sem consentimento LGPD para contato ativo">sem consentimento</span>}
                </span>
              </li>
            ))}
          </ul>
        ),
    },
    {
      id: "em-aberto",
      titulo: "Em aberto no funil",
      descricao: "O dinheiro que ainda dá para ganhar",
      acao: <LinkAcao href="/orcamentos?status=ENVIADO">ver orçamentos</LinkAcao>,
      conteudo: (
        <Indicador
          destaque
          valor={brl(r.valorEmAberto)}
          detalhe={`orçamentos aguardando resposta · ${r.conversasAbertas} conversa(s) aberta(s)`}
        />
      ),
    },
    {
      id: "novos-leads",
      titulo: "Novos leads",
      descricao: `Últimos ${r.dias} dias`,
      acao: <LinkAcao href="/leads">ver leads</LinkAcao>,
      conteudo: <Indicador valor={r.novosLeads} detalhe={`${r.naoLidas} mensagem(ns) não lida(s)`} />,
    },
    {
      id: "ganho",
      titulo: "Ganho",
      descricao: `Últimos ${r.dias} dias`,
      conteudo: <Indicador valor={brl(r.valorGanho)} detalhe={`${r.qtdAceitos} orçamento(s) aceito(s)`} />,
    },
    {
      id: "perdido",
      titulo: "Perdido",
      descricao: `Últimos ${r.dias} dias`,
      acao: <LinkAcao href="/relatorios">ver relatório</LinkAcao>,
      conteudo: <Indicador valor={brl(r.valorPerdido)} detalhe={`${r.qtdRejeitados} rejeitado(s) · ticket ${brl(r.ticketMedioPerdido)}`} />,
    },
    {
      id: "conversao",
      titulo: "Conversão",
      descricao: "Dos orçamentos fechados",
      conteudo: <Indicador valor={`${r.taxaConversao.toFixed(0)}%`} detalhe={`${r.qtdAceitos} aceito(s) de ${r.qtdAceitos + r.qtdRejeitados} fechado(s)`} />,
    },
    {
      id: "resultado-semana",
      titulo: "Resultado por semana",
      descricao: `Valor fechado nas últimas ${semanas} semanas — ganho acima da linha, perdido abaixo`,
      conteudo: <GraficoResultado dados={semanal} />,
    },
    {
      id: "funil",
      titulo: "Funil de vendas",
      descricao: "Leads por etapa",
      acao: <LinkAcao href="/pipeline">abrir kanban</LinkAcao>,
      conteudo: <GraficoFunil etapas={funil} />,
    },
    {
      id: "motivos",
      titulo: "Por que perdemos",
      descricao: `${brl(rej.totalPerdido)} em orçamentos rejeitados`,
      acao: <LinkAcao href="/relatorios">ver relatório</LinkAcao>,
      conteudo: <GraficoMotivos motivos={rej.porMotivo} total={rej.totalPerdido} />,
    },
    {
      id: "origens",
      titulo: "Origem dos novos leads",
      descricao: "De onde vem a demanda",
      conteudo: <GraficoOrigens origens={r.leadsPorOrigem} />,
    },
    {
      id: "quentes",
      titulo: "Oportunidades quentes",
      descricao: "Maior score de intenção de compra",
      acao: <LinkAcao href="/leads">ver leads</LinkAcao>,
      conteudo:
        quentes.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum lead quente no momento.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {quentes.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                <Link href={`/leads/${l.id}`} className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-800 hover:text-emerald-700">{l.nome}</div>
                  <div className="truncate text-xs text-slate-400">{l.origem.toLowerCase()} · {l.interesses || "sem interesse mapeado"}</div>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`chip ${corEtapa(l.etapa)}`}>{labelEtapa(l.etapa)}</span>
                  <span className="text-xs font-medium text-slate-500" style={{ fontVariantNumeric: "tabular-nums" }}>{l.score}</span>
                </div>
              </li>
            ))}
          </ul>
        ),
    },
    {
      id: "ultimas",
      titulo: "Últimas mensagens",
      descricao: "WhatsApp e Instagram",
      acao: <LinkAcao href="/inbox">abrir inbox</LinkAcao>,
      conteudo:
        ultimas.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma mensagem recebida.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ultimas.map((m) => (
              <li key={m.id} className="py-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className={`chip ${CANAL[m.conversa.canal].chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${CANAL[m.conversa.canal].ponto}`} />
                    {CANAL[m.conversa.canal].rotulo}
                  </span>
                  <span className="truncate">{m.conversa.nomeExibicao}</span>
                  <span className="ml-auto shrink-0">{dataHora(m.enviadoEm)}</span>
                </div>
                <Link href={`/inbox?c=${m.conversaId}`} className="mt-1 line-clamp-2 block text-sm text-slate-700 hover:text-emerald-700">
                  {previaTexto(descreverMensagem(m), 140)}
                </Link>
              </li>
            ))}
          </ul>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Painel comercial</h1>
          <p className="text-sm text-slate-500">Últimos {r.dias} dias</p>
        </div>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <Link key={d} href={`/?dias=${d}`} className={`chip ${chipFiltro(d === r.dias)}`}>
              {d} dias
            </Link>
          ))}
        </div>
      </header>

      <PainelBoard cartoes={cartoes} layoutPadrao={LAYOUT_PADRAO} />
    </div>
  );
}
