import { segmentoParaTela } from "@/lib/configuracao";
import Link from "next/link";
import { db } from "@/lib/db";
import { ETAPAS, ORIGENS, corEtapa, labelEtapa, dataCurta } from "@/lib/constantes";
import NovoLeadDialog from "@/components/NovoLeadDialog";
import { COR_TEMPERATURA as TEMP, TOM, chipFiltro } from "@/lib/tema";
import { formatarTelefone } from "@/lib/telefone";
import { manutencao } from "@/lib/manutencao";
import { filtroLeads } from "@/lib/busca";
import { usuarioAtual, ehGerente } from "@/lib/usuario";
import { contarEtiquetas, listaEtiquetas } from "@/lib/etiquetas";

export const dynamic = "force-dynamic";

export default async function Leads({ searchParams }) {
  const segmento = await segmentoParaTela();
  await manutencao(); // expira orçamentos vencidos e esfria scores antes de mostrar números
  const sp = await searchParams;
  const { etapa, origem, q, meus, etiqueta } = sp ?? {};
  const usuario = await usuarioAtual();
  const gerente = ehGerente(usuario);
  const where = filtroLeads({ etapa, origem, q, meus, etiqueta }, usuario?.id);

  const [leads, total, comEtiqueta] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: [{ score: "desc" }, { ultimoContatoEm: "desc" }],
      include: { _count: { select: { orcamentos: true } } },
      take: 200,
    }),
    db.lead.count({ where }),
    db.lead.findMany({ where: { etiquetas: { not: "" } }, select: { etiquetas: true } }),
  ]);
  const etiquetas = contarEtiquetas(comEtiqueta);

  const params = (extra = {}) => {
    const p = new URLSearchParams({ ...(etapa && { etapa }), ...(origem && { origem }), ...(q && { q }), ...(meus && { meus }), ...(etiqueta && { etiqueta }), ...extra });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return p.toString();
  };
  const filtro = (extra) => `/leads?${params(extra)}`;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-slate-500">
            {total} registro(s){total > leads.length && ` · mostrando os ${leads.length} de maior score`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {gerente && (
            <>
              <a href={`/api/exportar/leads?${params()}`} className="btn-ghost" title="Baixa os leads deste filtro em CSV (abre no Excel)">⇩ Exportar CSV</a>
              <Link href="/configuracoes/planilhas" className="btn-ghost">⇧ Importar</Link>
            </>
          )}
          <NovoLeadDialog etiquetasEmUso={etiquetas.map((e) => e.nome)} segmento={segmento} />
        </div>
      </header>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <form className="flex w-full gap-2 sm:w-auto">
          {etapa && <input type="hidden" name="etapa" value={etapa} />}
          {origem && <input type="hidden" name="origem" value={origem} />}
          {meus && <input type="hidden" name="meus" value={meus} />}
          {etiqueta && <input type="hidden" name="etiqueta" value={etiqueta} />}
          <input name="q" defaultValue={q ?? ""} className="input min-w-0 flex-1 sm:w-56 sm:flex-none" placeholder="Buscar nome ou telefone" />
          <button className="btn-ghost">Buscar</button>
        </form>
        <Link href={filtro({ meus: meus ? "" : "1" })} className={`chip ${chipFiltro(!!meus)}`}>só os meus</Link>
        <div className="flex flex-wrap gap-1 lg:ml-auto">
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
        {etiquetas.length > 0 && (
          <div className="flex w-full flex-wrap gap-1">
            <Link href={filtro({ etiqueta: "" })} className={`chip ${chipFiltro(!etiqueta)}`}>todas etiquetas</Link>
            {etiquetas.map((e) => (
              <Link key={e.nome} href={filtro({ etiqueta: e.nome })} className={`chip ${chipFiltro(etiqueta === e.nome)}`}>
                # {e.nome} <span className="opacity-60">{e.total}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Lead</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Origem</th>
              <th className="px-4 py-2.5 font-medium">Etapa</th>
              <th className="px-4 py-2.5 font-medium">Score</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Orçam.</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Último contato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="min-w-0 px-4 py-2.5">
                  <Link href={`/leads/${l.id}`} className="font-medium text-slate-800 hover:text-emerald-700">{l.nome}</Link>
                  <div className="text-xs text-slate-400">{formatarTelefone(l.telefone) ?? l.email ?? l.empresa ?? "—"}</div>
                  {l.etiquetas && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {listaEtiquetas(l.etiquetas).map((e) => <span key={e} className={`chip ${TOM.neutroClaro} py-0`}># {e}</span>)}
                    </div>
                  )}
                </td>
                <td className="hidden px-4 py-2.5 text-slate-500 md:table-cell">{l.origem.toLowerCase()}</td>
                <td className="px-4 py-2.5"><span className={`chip ${corEtapa(l.etapa)}`}>{labelEtapa(l.etapa)}</span></td>
                <td className="px-4 py-2.5"><span className={`chip ${TEMP[l.temperatura]}`}>{l.score}</span></td>
                <td className="hidden px-4 py-2.5 text-slate-500 md:table-cell">{l._count.orcamentos}</td>
                <td className="hidden whitespace-nowrap px-4 py-2.5 text-slate-500 sm:table-cell">{dataCurta(l.ultimoContatoEm)}</td>
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
