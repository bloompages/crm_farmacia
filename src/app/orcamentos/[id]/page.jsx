import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { brl, dataCurta, labelMotivo, MOTIVOS_REJEICAO } from "@/lib/constantes";
import OrcamentoAcoes from "@/components/OrcamentoAcoes";

export const dynamic = "force-dynamic";

export default async function OrcamentoDetalhe({ params }) {
  const { id } = await params;
  const o = await db.orcamento.findUnique({
    where: { id },
    include: { lead: true, itens: true },
  });
  if (!o) notFound();

  const bruto = o.itens.reduce((t, i) => t + i.subtotal, 0);
  const acao = MOTIVOS_REJEICAO.find((m) => m.id === o.motivoRejeicao)?.acao;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link href="/orcamentos" className="text-xs text-slate-400 hover:text-slate-600">← Orçamentos</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Orçamento #{o.numero}</h1>
        <p className="text-sm text-slate-500">
          <Link href={`/leads/${o.leadId}`} className="hover:text-emerald-700">{o.lead.nome}</Link>
          {" · "}criado em {dataCurta(o.createdAt)}
          {o.validadeEm && ` · válido até ${dataCurta(o.validadeEm)}`}
        </p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Item</th>
              <th className="px-4 py-2.5 font-medium">Qtd</th>
              <th className="px-4 py-2.5 font-medium">Unit.</th>
              <th className="px-4 py-2.5 font-medium text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {o.itens.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2.5">{i.descricao}</td>
                <td className="px-4 py-2.5 text-slate-500">{i.quantidade}</td>
                <td className="px-4 py-2.5 text-slate-500">{brl(i.precoUnit)}</td>
                <td className="px-4 py-2.5 text-right font-medium">{brl(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 text-sm">
            <tr><td colSpan={3} className="px-4 py-2 text-right text-slate-500">Subtotal</td><td className="px-4 py-2 text-right">{brl(bruto)}</td></tr>
            {o.desconto > 0 && (
              <tr><td colSpan={3} className="px-4 py-2 text-right text-slate-500">Desconto</td><td className="px-4 py-2 text-right text-rose-600">- {brl(o.desconto)}</td></tr>
            )}
            <tr><td colSpan={3} className="px-4 py-2 text-right font-semibold">Total</td><td className="px-4 py-2 text-right text-lg font-semibold">{brl(o.total)}</td></tr>
          </tfoot>
        </table>
      </div>

      {o.status === "REJEITADO" && (
        <div className="card border-rose-200 bg-rose-50 p-4">
          <h2 className="text-sm font-semibold text-rose-800">Rejeitado — {labelMotivo(o.motivoRejeicao)}</h2>
          {o.detalheRejeicao && <p className="mt-1 text-sm text-rose-700">{o.detalheRejeicao}</p>}
          {o.concorrente && (
            <p className="mt-1 text-sm text-rose-700">
              Concorrente: {o.concorrente}
              {o.precoConcorrente ? ` — ${brl(o.precoConcorrente)} (gap de ${brl(o.total - o.precoConcorrente)})` : ""}
            </p>
          )}
          {acao && <p className="mt-2 text-xs text-rose-600">Ação sugerida: {acao}</p>}
        </div>
      )}

      {o.status === "ACEITO" && (
        <div className="card border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          Orçamento aceito em {dataCurta(o.fechadoEm)}.
        </div>
      )}

      <OrcamentoAcoes orcamento={o} />
    </div>
  );
}
