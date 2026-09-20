import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ETAPAS, labelEtapa } from "@/lib/constantes";

export async function PATCH(req, { params }) {
  const { id } = await params;
  const b = await req.json();
  const atual = await db.lead.findUnique({ where: { id } });
  if (!atual) return NextResponse.json({ erro: "lead não encontrado" }, { status: 404 });

  const data = {};
  for (const campo of ["nome", "telefone", "email", "empresa", "tipo", "origem", "interesses", "observacoes", "temperatura", "motivoPerda"]) {
    if (b[campo] !== undefined) data[campo] = b[campo] || null;
  }
  if (b.etapa && !ETAPAS.some((e) => e.id === b.etapa)) {
    return NextResponse.json({ erro: `etapa inválida: ${b.etapa}` }, { status: 400 });
  }
  if (b.etapa && b.etapa !== atual.etapa) {
    data.etapa = b.etapa;
    if (b.etapa !== "PERDIDO") data.motivoPerda = null;
  }

  // valor aprovado: vem do botão "Aprovar" da conversa (soma dos "Total" ou editado pelo atendente)
  let valorAprovado;
  if (b.valorAprovado !== undefined) {
    valorAprovado = b.valorAprovado === null || b.valorAprovado === "" ? null : Number(b.valorAprovado);
    if (valorAprovado !== null && (!Number.isFinite(valorAprovado) || valorAprovado < 0)) {
      return NextResponse.json({ erro: "valor aprovado inválido" }, { status: 400 });
    }
    data.valorAprovado = valorAprovado;
  }

  const lead = await db.lead.update({ where: { id }, data });

  if (data.etapa) {
    await db.atividade.create({
      data: {
        leadId: id,
        tipo: "ETAPA",
        descricao: `Etapa alterada: ${labelEtapa(atual.etapa)} → ${labelEtapa(lead.etapa)}${lead.motivoPerda ? ` (motivo: ${lead.motivoPerda})` : ""}`,
      },
    });
  }

  // Ao aprovar (ou ao editar o valor de um lead já aprovado), o orçamento acompanha:
  // o orçamento em aberto vira ACEITO com o valor aprovado; sem orçamento, cria um ACEITO —
  // assim o valor entra nos relatórios de resultado.
  if (lead.etapa === "APROVADO" && (data.etapa || valorAprovado !== undefined)) {
    const orc = await sincronizarOrcamentoAprovado(lead, valorAprovado);
    if (orc) {
      await db.atividade.create({
        data: {
          leadId: id,
          tipo: "ORCAMENTO",
          descricao: `Orçamento #${orc.numero} aceito — total R$ ${orc.total.toFixed(2)}${valorAprovado !== undefined ? " (valor definido na conversa)" : ""}`,
        },
      });
    }
  }

  if (b.nota?.trim()) {
    await db.atividade.create({ data: { leadId: id, tipo: "NOTA", descricao: b.nota.trim() } });
  }
  return NextResponse.json(lead);
}

async function sincronizarOrcamentoAprovado(lead, valorAprovado) {
  const valor = valorAprovado ?? lead.valorAprovado ?? null;
  const existente = await db.orcamento.findFirst({
    where: { leadId: lead.id, status: { in: ["RASCUNHO", "ENVIADO", "ACEITO"] } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }], // ACEITO < ENVIADO < RASCUNHO em ordem alfabética: prioriza o já aceito
  });

  if (existente) {
    return db.orcamento.update({
      where: { id: existente.id },
      data: {
        status: "ACEITO",
        fechadoEm: existente.fechadoEm ?? new Date(),
        motivoRejeicao: null,
        detalheRejeicao: null,
        ...(valor !== null && valor > 0 ? { total: valor } : {}),
      },
    });
  }
  if (valor === null || valor <= 0) return null;

  const { _max } = await db.orcamento.aggregate({ _max: { numero: true } });
  return db.orcamento.create({
    data: {
      numero: (_max.numero ?? 0) + 1,
      leadId: lead.id,
      status: "ACEITO",
      total: valor,
      enviadoEm: new Date(),
      fechadoEm: new Date(),
      itens: { create: [{ descricao: "Pedido aprovado na conversa", quantidade: 1, precoUnit: valor, subtotal: valor }] },
    },
  });
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  await db.lead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
