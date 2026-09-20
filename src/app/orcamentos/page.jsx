import Link from "next/link";
import { db } from "@/lib/db";
import { brl, dataCurta, labelMotivo, STATUS_ORCAMENTO } from "@/lib/constantes";
import { COR_STATUS_ORCAMENTO as CORES, TOM, chipFiltro } from "@/lib/tema";

export const dynamic = "force-dynamic";

export default async function Orcamentos({ searchParams }) {
  const sp = await searchParams;
  const status = sp?.status;
  const motivo = sp?.motivo;

  const orcamentos = await db.orcamento.findMany({
    where: { ...(status ? { status } : {}), ...(motivo ? { motivoRejeicao: motivo } : {}) },
    include: { lead: true, _count: { select: { itens: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const total = orcamentos.reduce((t, o) => t + o.total, 0);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orçamentos</h1>
          <p className="text-sm text-slate-500">{orcamentos.length} registro(s) · {brl(total)}</p>
        </div>
        <Link href="/orcamentos/novo" className="btn-primary">+ Novo orçamento</Link>
      </header>

      <div className="flex flex-wrap gap-1">
        <Link href="/orcamentos" className={`chip ${chipFiltro(!status)}`}>todos</Link>
        {STATUS_ORCAMENTO.map((s) => (
          <Link key={s} href={`/orcamentos?status=${s}`} className={`chip ${status === s ? CORES[s] : TOM.neutroClaro}`}>
            {s.toLowerCase()}
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">#</th>
              <th className="px-4 py-2.5 font-medium">Lead</th>
              <th className="px-4 py-2.5 font-medium">Itens</th>
              <th className="px-4 py-2.5 font-medium">Total</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Motivo (se perdido)</th>
              <th className="px-4 py-2.5 font-medium">Criado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orcamentos.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`/orcamentos/${o.id}`} className="font-medium text-slate-800 hover:text-emerald-700">#{o.numero}</Link>
                </td>
                <td className="px-4 py-2.5">
                  <Link href={`/leads/${o.leadId}`} className="text-slate-700 hover:text-emerald-700">{o.lead.nome}</Link>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{o._count.itens}</td>
                <td className="px-4 py-2.5 font-medium">{brl(o.total)}</td>
                <td className="px-4 py-2.5"><span className={`chip ${CORES[o.status]}`}>{o.status.toLowerCase()}</span></td>
                <td className="px-4 py-2.5 text-slate-500">
                  {o.status === "REJEITADO" ? labelMotivo(o.motivoRejeicao) : "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{dataCurta(o.createdAt)}</td>
              </tr>
            ))}
            {orcamentos.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Nenhum orçamento.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
