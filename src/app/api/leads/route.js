import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req) {
  const b = await req.json();
  if (!b.nome?.trim()) return NextResponse.json({ erro: "nome obrigatório" }, { status: 400 });
  const lead = await db.lead.create({
    data: {
      nome: b.nome.trim(),
      telefone: b.telefone?.trim() || null,
      email: b.email?.trim() || null,
      empresa: b.empresa?.trim() || null,
      tipo: b.tipo || "PF",
      origem: b.origem || "MANUAL",
      etapa: b.etapa || "NOVO",
      interesses: b.interesses || "",
      observacoes: b.observacoes || null,
    },
  });
  await db.atividade.create({
    data: { leadId: lead.id, tipo: "NOTA", descricao: `Lead cadastrado manualmente (origem ${lead.origem}).` },
  });
  return NextResponse.json(lead);
}
