import Link from "next/link";
import { analiseRejeicoes } from "@/lib/metricas";
import { brl, dataCurta, labelMotivo } from "@/lib/constantes";
import { chipFiltro } from "@/lib/tema";

export const dynamic = "force-dynamic";

export default async function Relatorios({ searchParams }) {
  const sp = await searchParams;
  const dias = Number(sp?.dias ?? 90);
  const r = await analiseRejeicoes(dias);
  const maior = Math.max(1, ...r.porMotivo.map((m) => m.valor));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orçamentos rejeitados</h1>
          <p className="text-sm text-slate-500">
            {r.rejeitados.length} rejeição(ões) nos últimos {r.dias} dias — {brl(r.totalPerdido)} deixados na mesa
          </p>
        </div>
        <div className="flex gap-1">
          {[30, 90, 180].map((d) => (
            <Link key={d} href={`/relatorios?dias=${d}`} className={`chip ${chipFiltro(d === r.dias)}`}>
              {d} dias
            </Link>
          ))}
        </div>
      </header>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold">Perda por motivo</h2>
        {r.porMotivo.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma rejeição registrada no período.</p>
        ) : (
          <div className="space-y-3">
            {r.porMotivo.map((m) => (
              <div key={m.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <Link href={`/orcamentos?status=REJEITADO&motivo=${m.id}`} className="font-medium text-slate-800 hover:text-emerald-700">
                    {m.label}
                  </Link>
                  <span className="text-slate-500">
                    {m.quantidade} orç. ·{" "}
                    <span className="font-semibold text-rose-600">{brl(m.valor)}</span> ·{" "}
                    {((m.valor / (r.totalPerdido || 1)) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 h-2 rounded bg-slate-100">
                  <div className="h-2 rounded bg-rose-400" style={{ width: `${(m.valor / maior) * 100}%` }} />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {m.acao}
                  {m.gapMedio !== null && (
                    <span className="ml-2 text-amber-600">gap médio vs. concorrente: {brl(m.gapMedio)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {r.porConcorrente.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-semibold">Para quem estamos perdendo</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {r.porConcorrente.map((c) => (
              <li key={c.nome} className="flex items-center justify-between py-2">
                <span className="text-slate-700">{c.nome}</span>
                <span className="text-slate-500">{c.quantidade} orç. · <span className="font-medium text-rose-600">{brl(c.valor)}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card overflow-hidden">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Rejeições detalhadas</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">#</th>
              <th className="px-4 py-2.5 font-medium">Lead</th>
              <th className="px-4 py-2.5 font-medium">Origem</th>
              <th className="px-4 py-2.5 font-medium">Valor</th>
              <th className="px-4 py-2.5 font-medium">Motivo</th>
              <th className="px-4 py-2.5 font-medium">Concorrente</th>
              <th className="px-4 py-2.5 font-medium">Fechado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {r.rejeitados.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`/orcamentos/${o.id}`} className="font-medium hover:text-emerald-700">#{o.numero}</Link>
                </td>
                <td className="px-4 py-2.5">
                  <Link href={`/leads/${o.lead.id}`} className="text-slate-700 hover:text-emerald-700">{o.lead.nome}</Link>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{o.lead.origem.toLowerCase()}</td>
                <td className="px-4 py-2.5 font-medium text-rose-600">{brl(o.total)}</td>
                <td className="px-4 py-2.5 text-slate-600">{labelMotivo(o.motivoRejeicao)}</td>
                <td className="px-4 py-2.5 text-slate-500">
                  {o.concorrente ?? "—"}{o.precoConcorrente ? ` (${brl(o.precoConcorrente)})` : ""}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{dataCurta(o.fechadoEm)}</td>
              </tr>
            ))}
            {r.rejeitados.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Nada por aqui.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
