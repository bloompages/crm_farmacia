import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { brl, corEtapa, labelEtapa, labelMotivo, dataHora, dataCurta } from "@/lib/constantes";
import LeadAcoes from "@/components/LeadAcoes";
import OrcamentoAcoes from "@/components/OrcamentoAcoes";
import { COR_STATUS_ORCAMENTO as CORES_STATUS } from "@/lib/tema";

export const dynamic = "force-dynamic";

export default async function LeadDetalhe({ params }) {
  const { id } = await params;
  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      orcamentos: { include: { itens: true }, orderBy: { createdAt: "desc" } },
      atividades: { orderBy: { createdAt: "desc" }, take: 40 },
      conversas: { include: { _count: { select: { mensagens: true } } } },
    },
  });
  if (!lead) notFound();

  const ganho = lead.orcamentos.filter((o) => o.status === "ACEITO").reduce((t, o) => t + o.total, 0);
  const perdido = lead.orcamentos.filter((o) => o.status === "REJEITADO").reduce((t, o) => t + o.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/leads" className="text-xs text-slate-400 hover:text-slate-600">← Leads</Link>
          <h1 className="text-2xl font-semibold tracking-tight">{lead.nome}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className={`chip ${corEtapa(lead.etapa)}`}>{labelEtapa(lead.etapa)}</span>
            <span className="chip border-slate-200 bg-white">{lead.origem.toLowerCase()}</span>
            <span className="chip border-slate-200 bg-white">score {lead.score} · {lead.temperatura.toLowerCase()}</span>
            {lead.telefone && <span>{lead.telefone}</span>}
            {lead.email && <span>{lead.email}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {lead.conversas[0] && (
            <Link href={`/inbox?c=${lead.conversas[0].id}`} className="btn-ghost">Abrir conversa</Link>
          )}
          <Link href={`/orcamentos/novo?lead=${lead.id}`} className="btn-primary">+ Orçamento</Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-3">
              <div className="text-xs text-slate-400">Ganho</div>
              <div className="text-lg font-semibold text-emerald-600">{brl(ganho)}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-slate-400">Perdido</div>
              <div className="text-lg font-semibold text-rose-600">{brl(perdido)}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-slate-400">Primeiro contato</div>
              <div className="text-lg font-semibold">{dataCurta(lead.primeiroContatoEm)}</div>
            </div>
          </div>

          <section className="card p-4">
            <h2 className="mb-3 text-sm font-semibold">Orçamentos</h2>
            {lead.orcamentos.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum orçamento ainda.</p>
            ) : (
              <ul className="space-y-3">
                {lead.orcamentos.map((o) => (
                  <li key={o.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Link href={`/orcamentos/${o.id}`} className="font-medium hover:text-emerald-700">
                          #{o.numero}
                        </Link>
                        <span className="ml-2 text-sm text-slate-500">{o.itens.length} item(ns) · {brl(o.total)}</span>
                      </div>
                      <span className={`chip ${CORES_STATUS[o.status]}`}>{o.status.toLowerCase()}</span>
                    </div>
                    {o.status === "REJEITADO" && (
                      <p className="mt-2 text-xs text-rose-600">
                        Motivo: {labelMotivo(o.motivoRejeicao)}
                        {o.concorrente && ` · ${o.concorrente}${o.precoConcorrente ? ` a ${brl(o.precoConcorrente)}` : ""}`}
                        {o.detalheRejeicao && ` — ${o.detalheRejeicao}`}
                      </p>
                    )}
                    <div className="mt-2"><OrcamentoAcoes orcamento={o} compacto /></div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-4">
            <h2 className="mb-3 text-sm font-semibold">Timeline</h2>
            <ul className="space-y-3">
              {lead.atividades.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700">{a.descricao}</p>
                    <p className="text-xs text-slate-400">{a.tipo.toLowerCase()} · {dataHora(a.createdAt)}</p>
                  </div>
                </li>
              ))}
              {lead.atividades.length === 0 && <p className="text-sm text-slate-400">Sem histórico.</p>}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <LeadAcoes lead={lead} />
          <div className="card p-4 text-sm">
            <h2 className="mb-2 text-sm font-semibold">Ficha</h2>
            <dl className="space-y-1.5 text-slate-600">
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Tipo</dt><dd>{lead.tipo}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Empresa</dt><dd className="truncate">{lead.empresa ?? "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Interesses</dt><dd className="truncate">{lead.interesses || "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Último contato</dt><dd>{dataCurta(lead.ultimoContatoEm)}</dd></div>
              {lead.motivoPerda && (
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Motivo da perda</dt><dd className="text-rose-600">{labelMotivo(lead.motivoPerda)}</dd></div>
              )}
            </dl>
            {lead.observacoes && <p className="mt-3 border-t border-slate-100 pt-3 text-slate-600">{lead.observacoes}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
