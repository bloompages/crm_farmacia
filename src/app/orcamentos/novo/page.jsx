import Link from "next/link";
import { db } from "@/lib/db";
import FormOrcamento from "@/components/FormOrcamento";

export const dynamic = "force-dynamic";

export default async function NovoOrcamento({ searchParams }) {
  const sp = await searchParams;
  const [leads, produtos] = await Promise.all([
    db.lead.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true, telefone: true } }),
    db.produto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/orcamentos" className="text-xs text-slate-400 hover:text-slate-600">← Orçamentos</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Novo orçamento</h1>
      </div>
      <FormOrcamento leads={leads} produtos={produtos} leadPre={sp?.lead ?? ""} />
    </div>
  );
}
