import Link from "next/link";
import { db } from "@/lib/db";
import { usuarioAtual, ehGerente } from "@/lib/usuario";
import { STATUS_ORCAMENTO } from "@/lib/constantes";
import ImportarPlanilha from "@/components/ImportarPlanilha";

export const dynamic = "force-dynamic";

export default async function Planilhas() {
  const usuario = await usuarioAtual();
  const voltar = <Link href="/configuracoes" className="text-xs text-slate-400 hover:text-slate-600">← Configurações</Link>;
  if (!ehGerente(usuario)) {
    return (
      <div className="max-w-3xl space-y-4">
        <header>{voltar}<h1 className="text-2xl font-semibold tracking-tight">Importar e exportar planilhas</h1></header>
        <div className="aviso aviso-neutro">Importação e exportação levam dados pessoais em massa — só o gerente acessa (e cada uso fica na auditoria).</div>
      </div>
    );
  }
  const [leads, orcamentos, produtos] = await Promise.all([
    db.lead.count({ where: { anonimizadoEm: null } }),
    db.orcamento.count(),
    db.produto.count(),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        {voltar}
        <h1 className="text-2xl font-semibold tracking-tight">Importar e exportar planilhas</h1>
        <p className="text-sm text-slate-500">
          Arquivos CSV no padrão do Excel brasileiro (separador ponto e vírgula, vírgula nos centavos). Exporte, ajuste no Excel e
          importe de volta — as colunas são as mesmas.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="border-l-2 border-emerald-500 pl-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Exportar</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card space-y-2 p-4">
            <div className="font-medium">Leads / contatos</div>
            <p className="text-sm text-slate-500">{leads} registro(s), com etiquetas, aniversário, convênio e responsável.</p>
            <a href="/api/exportar/leads" className="btn-ghost w-full">⇩ Baixar CSV</a>
            <p className="text-[11px] text-slate-400">Para exportar só um filtro, use o botão na tela de <Link href="/leads" className="underline">Leads</Link>.</p>
          </div>
          <form action="/api/exportar/orcamentos" className="card space-y-2 p-4">
            <div className="font-medium">Orçamentos</div>
            <p className="text-sm text-slate-500">{orcamentos} registro(s), com itens, motivo da rejeição e concorrente.</p>
            <select name="status" className="input" defaultValue="">
              <option value="">Todos os status</option>
              {STATUS_ORCAMENTO.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
            </select>
            <button className="btn-ghost w-full">⇩ Baixar CSV</button>
          </form>
          <div className="card space-y-2 p-4">
            <div className="font-medium">Catálogo de produtos</div>
            <p className="text-sm text-slate-500">{produtos} produto(s) com categoria e preço.</p>
            <a href="/api/exportar/produtos" className="btn-ghost w-full">⇩ Baixar CSV</a>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="border-l-2 border-emerald-500 pl-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Importar</h2>
        <ImportarPlanilha />
      </section>
    </div>
  );
}
