import Link from "next/link";
import { db } from "@/lib/db";
import { resumoComercial, analiseRejeicoes, serieSemanal, funilComValor } from "@/lib/metricas";
import { brl, dataHora, corEtapa, labelEtapa } from "@/lib/constantes";
import { GraficoResultado, GraficoFunil, GraficoMotivos, GraficoOrigens } from "@/components/Graficos";
import { CANAL, chipFiltro } from "@/lib/tema";
import { descreverMensagem } from "@/lib/conversa";
import { previaTexto } from "@/lib/formatacao";
import PainelBoard from "@/components/PainelBoard";

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
  ["em-aberto", "novos-leads", "ganho", "perdido", "conversao"],
  ["resultado-semana", "funil"],
  ["motivos", "origens", "quentes", "ultimas"],
];

export default async function Painel({ searchParams }) {
  const sp = await searchParams;
  const dias = Number(sp?.dias ?? 30);
  const semanas = dias <= 7 ? 4 : dias <= 30 ? 8 : 12;

  const [r, rej, semanal, funil, quentes, ultimas] = await Promise.all([
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
  ]);

  const cartoes = [
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
