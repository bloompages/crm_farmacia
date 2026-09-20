import Link from "next/link";
import { db } from "@/lib/db";
import { ETAPAS, ORIGENS, corEtapa, labelEtapa, dataCurta } from "@/lib/constantes";
import NovoLeadDialog from "@/components/NovoLeadDialog";
import { COR_TEMPERATURA as TEMP, TOM, chipFiltro } from "@/lib/tema";

export const dynamic = "force-dynamic";

export default async function Leads({ searchParams }) {
  const sp = await searchParams;
  const { etapa, origem, q } = sp ?? {};

  const where = {
    ...(etapa ? { etapa } : {}),
    ...(origem ? { origem } : {}),
    ...(q
      ? { OR: [{ nome: { contains: q } }, { telefone: { contains: q } }, { empresa: { contains: q } }] }
      : {}),
  };

  const leads = await db.lead.findMany({
    where,
    orderBy: [{ score: "desc" }, { ultimoContatoEm: "desc" }],
    include: { _count: { select: { orcamentos: true } } },
    take: 200,
  });

  const filtro = (extra) => {
    const p = new URLSearchParams({ ...(etapa && { etapa }), ...(origem && { origem }), ...(q && { q }), ...extra });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/leads?${p}`;
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-slate-500">{leads.length} registro(s)</p>
        </div>
        <NovoLeadDialog />
      </header>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <form className="flex gap-2">
          {etapa && <input type="hidden" name="etapa" value={etapa} />}
          {origem && <input type="hidden" name="origem" value={origem} />}
          <input name="q" defaultValue={q ?? ""} className="input w-56" placeholder="Buscar nome ou telefone" />
          <button className="btn-ghost">Buscar</button>
        </form>
        <div className="ml-auto flex flex-wrap gap-1">
          <Link href={filtro({ etapa: "" })} className={`chip ${chipFiltro(!etapa)}`}>todas etapas</Link>
          {ETAPAS.map((e) => (
            <Link key={e.id} href={filtro({ etapa: e.id })} className={`chip ${etapa === e.id ? e.cor : TOM.neutroClaro}`}>
              {e.label}
            </Link>
          ))}
        </div>
        <div className="flex w-full flex-wrap gap-1">
          <Link href={filtro({ origem: "" })} className={`chip ${chipFiltro(!origem)}`}>todas origens</Link>
          {ORIGENS.map((o) => (
            <Link key={o} href={filtro({ origem: o })} className={`chip ${chipFiltro(origem === o)}`}>
              {o.toLowerCase()}
            </Link>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Lead</th>
              <th className="px-4 py-2.5 font-medium">Origem</th>
              <th className="px-4 py-2.5 font-medium">Etapa</th>
              <th className="px-4 py-2.5 font-medium">Score</th>
              <th className="px-4 py-2.5 font-medium">Orçam.</th>
              <th className="px-4 py-2.5 font-medium">Último contato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`/leads/${l.id}`} className="font-medium text-slate-800 hover:text-emerald-700">{l.nome}</Link>
                  <div className="text-xs text-slate-400">{l.telefone ?? l.email ?? l.empresa ?? "—"}</div>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{l.origem.toLowerCase()}</td>
                <td className="px-4 py-2.5"><span className={`chip ${corEtapa(l.etapa)}`}>{labelEtapa(l.etapa)}</span></td>
                <td className="px-4 py-2.5"><span className={`chip ${TEMP[l.temperatura]}`}>{l.score}</span></td>
                <td className="px-4 py-2.5 text-slate-500">{l._count.orcamentos}</td>
                <td className="px-4 py-2.5 text-slate-500">{dataCurta(l.ultimoContatoEm)}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Nenhum lead encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
