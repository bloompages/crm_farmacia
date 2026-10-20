import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MOTIVOS_REJEICAO, STATUS_ORCAMENTO, labelMotivo } from "@/lib/constantes";
import { STATUS_ABERTOS, centavos } from "@/lib/orcamento";
import { exigirUsuario } from "@/lib/usuario";
import { auditar } from "@/lib/auditoria";

/**
 * Muda o status do orçamento. É aqui que a rejeição vira dado quantificável:
 * todo REJEITADO exige motivo e opcionalmente concorrente/preço praticado.
 */
export async function PATCH(req, { params }) {
  const { usuario, resposta } = await exigirUsuario();
  if (resposta) return resposta;
  const { id } = await params;
  const b = await req.json();
  const atual = await db.orcamento.findUnique({ where: { id }, include: { lead: true } });
  if (!atual) return NextResponse.json({ erro: "orçamento não encontrado" }, { status: 404 });

  if (b.status && !STATUS_ORCAMENTO.includes(b.status)) {
    return NextResponse.json({ erro: `status inválido: ${b.status}` }, { status: 400 });
  }

  const data = {};
  if (b.status) {
    data.status = b.status;
    if (b.status === "ENVIADO" && !atual.enviadoEm) data.enviadoEm = new Date();
    if (["ACEITO", "REJEITADO", "EXPIRADO"].includes(b.status)) data.fechadoEm = new Date();
  }

  if (b.status === "REJEITADO") {
    if (!MOTIVOS_REJEICAO.some((m) => m.id === b.motivoRejeicao)) {
      return NextResponse.json({ erro: "motivo da rejeição é obrigatório" }, { status: 400 });
    }
    data.motivoRejeicao = b.motivoRejeicao;
    data.detalheRejeicao = b.detalheRejeicao || null;
    data.concorrente = b.concorrente || null;
    data.precoConcorrente = b.precoConcorrente ? centavos(b.precoConcorrente) : null;
  }
  if (b.status === "ACEITO") {
    data.motivoRejeicao = null;
    data.detalheRejeicao = null;
  }

  // orçamento, funil do lead e timeline gravados juntos — ou nenhum deles
  const orcamento = await db.$transaction(async (tx) => {
    const orcamento = await tx.orcamento.update({ where: { id }, data });

    // reflete o desfecho no funil do lead
    if (b.status === "ACEITO") {
      await tx.lead.update({ where: { id: atual.leadId }, data: { etapa: "APROVADO", motivoPerda: null } });
    } else if (b.status === "REJEITADO") {
      const outrosAbertos = await tx.orcamento.count({
        where: { leadId: atual.leadId, status: { in: STATUS_ABERTOS } },
      });
      if (!outrosAbertos) {
        await tx.lead.update({
          where: { id: atual.leadId },
          data: { etapa: "PERDIDO", motivoPerda: b.motivoRejeicao },
        });
      }
    }

    await tx.atividade.create({
      data: {
        leadId: atual.leadId,
        autorId: usuario.id,
        tipo: "ORCAMENTO",
        descricao:
          b.status === "REJEITADO"
            ? `Orçamento #${atual.numero} rejeitado — ${labelMotivo(b.motivoRejeicao)}${b.concorrente ? ` (concorrente: ${b.concorrente})` : ""}`
            : `Orçamento #${atual.numero}: status ${b.status}`,
      },
    });
    return orcamento;
  });

  return NextResponse.json(orcamento);
}

export async function DELETE(_req, { params }) {
  const { resposta } = await exigirUsuario("GERENTE");
  if (resposta) return resposta;
  const { id } = await params;
  const o = await db.orcamento.findUnique({ where: { id }, select: { numero: true, total: true } });
  if (!o) return NextResponse.json({ erro: "orçamento não encontrado" }, { status: 404 });
  await db.orcamento.delete({ where: { id } });
  await auditar("EXCLUIR_ORCAMENTO", { entidade: "Orcamento", entidadeId: id, detalhe: `#${o.numero} — R$ ${o.total.toFixed(2)}` });
  return NextResponse.json({ ok: true });
}
