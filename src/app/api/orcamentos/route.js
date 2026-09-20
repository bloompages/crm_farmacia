import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const calcularTotal = (itens, desconto = 0) =>
  Math.max(0, itens.reduce((s, i) => s + i.subtotal, 0) - Number(desconto || 0));

/** Próximo número sequencial do orçamento (SQLite não permite autoincrement fora do id). */
async function proximoNumero() {
  const { _max } = await db.orcamento.aggregate({ _max: { numero: true } });
  return (_max.numero ?? 0) + 1;
}

export async function POST(req) {
  const b = await req.json();
  if (!b.leadId) return NextResponse.json({ erro: "leadId obrigatório" }, { status: 400 });

  const itens = (b.itens ?? [])
    .filter((i) => i.descricao?.trim())
    .map((i) => {
      const quantidade = Number(i.quantidade) || 1;
      const precoUnit = Number(i.precoUnit) || 0;
      return {
        produtoId: i.produtoId || null,
        descricao: i.descricao.trim(),
        quantidade,
        precoUnit,
        subtotal: quantidade * precoUnit,
      };
    });
  if (!itens.length) return NextResponse.json({ erro: "informe ao menos 1 item" }, { status: 400 });

  const status = b.status || "ENVIADO";
  const orcamento = await db.orcamento.create({
    data: {
      numero: await proximoNumero(),
      leadId: b.leadId,
      status,
      desconto: Number(b.desconto) || 0,
      total: calcularTotal(itens, b.desconto),
      validadeEm: b.validadeEm ? new Date(b.validadeEm) : null,
      enviadoEm: status === "ENVIADO" ? new Date() : null,
      itens: { create: itens },
    },
    include: { itens: true },
  });

  const lead = await db.lead.findUnique({ where: { id: b.leadId } });
  if (lead && lead.etapa === "NOVO" && status === "ENVIADO") {
    await db.lead.update({ where: { id: lead.id }, data: { etapa: "ORCAMENTO" } });
  }
  await db.atividade.create({
    data: {
      leadId: b.leadId,
      tipo: "ORCAMENTO",
      descricao: `Orçamento #${orcamento.numero} criado com ${itens.length} item(ns) — total R$ ${orcamento.total.toFixed(2)}`,
    },
  });

  return NextResponse.json(orcamento);
}
