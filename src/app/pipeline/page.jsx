import { db } from "@/lib/db";
import Kanban from "@/components/Kanban";
import { manutencao } from "@/lib/manutencao";
import { listaEtiquetas } from "@/lib/etiquetas";

export const dynamic = "force-dynamic";

export default async function Pipeline() {
  await manutencao(); // expira orçamentos vencidos e esfria scores antes de mostrar números
  const [leads, equipe] = await Promise.all([
    db.lead.findMany({
      where: { anonimizadoEm: null },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
      include: { orcamentos: { select: { status: true, total: true } }, responsavel: { select: { id: true, nome: true } } },
      take: 500,
    }),
    db.user.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  const dados = leads.map((l) => ({
    id: l.id,
    nome: l.nome,
    telefone: l.telefone,
    etapa: l.etapa,
    origem: l.origem,
    score: l.score,
    temperatura: l.temperatura,
    etiquetas: listaEtiquetas(l.etiquetas),
    responsavel: l.responsavel,
    criadoEm: l.createdAt.toISOString(),
    ultimoContatoEm: l.ultimoContatoEm.toISOString(),
    valorAprovado: l.valorAprovado,
    valorAberto: l.orcamentos
      .filter((o) => ["RASCUNHO", "ENVIADO"].includes(o.status))
      .reduce((t, o) => t + o.total, 0),
  }));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Funil de vendas</h1>
        <p className="text-sm text-slate-500">
          {leads.length} negócio(s) · arraste os cards para mudar a etapa; em "Orçamento enviado", confirme a venda direto no card.
        </p>
      </header>
      <Kanban leadsIniciais={dados} equipe={equipe} />
    </div>
  );
}
