import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { labelMotivo } from "@/lib/constantes";

/**
 * Muda o status do orçamento. É aqui que a rejeição vira dado quantificável:
 * todo REJEITADO exige motivo e opcionalmente concorrente/preço praticado.
 */
export async function PATCH(req, { params }) {
  const { id } = await params;
  const b = await req.json();
  const atual = await db.orcamento.findUnique({ where: { id }, include: { lead: true } });
  if (!atual) return NextResponse.json({ erro: "orçamento não encontrado" }, { status: 404 });

  const data = {};
  if (b.status) {
    data.status = b.status;
    if (b.status === "ENVIADO" && !atual.enviadoEm) data.enviadoEm = new Date();
    if (["ACEITO", "REJEITADO", "EXPIRADO"].includes(b.status)) data.fechadoEm = new Date();
  }

  if (b.status === "REJEITADO") {
    if (!b.motivoRejeicao) {
      return NextResponse.json({ erro: "motivo da rejeição é obrigatório" }, { status: 400 });
    }
    data.motivoRejeicao = b.motivoRejeicao;
    data.detalheRejeicao = b.detalheRejeicao || null;
    data.concorrente = b.concorrente || null;
    data.precoConcorrente = b.precoConcorrente ? Number(b.precoConcorrente) : null;
  }
  if (b.status === "ACEITO") {
    data.motivoRejeicao = null;
    data.detalheRejeicao = null;
  }

  const orcamento = await db.orcamento.update({ where: { id }, data });

  // reflete o desfecho no funil do lead
  if (b.status === "ACEITO") {
    await db.lead.update({ where: { id: atual.leadId }, data: { etapa: "APROVADO" } });
  } else if (b.status === "REJEITADO") {
    const outrosAbertos = await db.orcamento.count({
      where: { leadId: atual.leadId, status: { in: ["RASCUNHO", "ENVIADO"] } },
    });
    if (!outrosAbertos) {
      await db.lead.update({
        where: { id: atual.leadId },
        data: { etapa: "PERDIDO", motivoPerda: b.motivoRejeicao },
      });
    }
  }

  await db.atividade.create({
    data: {
      leadId: atual.leadId,
      tipo: "ORCAMENTO",
      descricao:
        b.status === "REJEITADO"
          ? `Orçamento #${atual.numero} rejeitado — ${labelMotivo(b.motivoRejeicao)}${b.concorrente ? ` (concorrente: ${b.concorrente})` : ""}`
          : `Orçamento #${atual.numero}: status ${b.status}`,
    },
  });

  return NextResponse.json(orcamento);
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  await db.orcamento.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
