import { db } from "@/lib/db";
import Kanban from "@/components/Kanban";

export const dynamic = "force-dynamic";

export default async function Pipeline() {
  const leads = await db.lead.findMany({
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    include: { orcamentos: { select: { status: true, total: true } } },
    take: 300,
  });

  const dados = leads.map((l) => ({
    id: l.id,
    nome: l.nome,
    etapa: l.etapa,
    origem: l.origem,
    score: l.score,
    temperatura: l.temperatura,
    valorAprovado: l.valorAprovado,
    valorAberto: l.orcamentos
      .filter((o) => ["RASCUNHO", "ENVIADO"].includes(o.status))
      .reduce((t, o) => t + o.total, 0),
  }));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Funil de vendas</h1>
        <p className="text-sm text-slate-500">Arraste os cards para mudar a etapa do lead.</p>
      </header>
      <Kanban leadsIniciais={dados} />
    </div>
  );
}
