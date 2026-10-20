import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { centavos, comNumeroSequencial } from "@/lib/orcamento";
import { exigirUsuario } from "@/lib/usuario";

const calcularTotal = (itens, desconto = 0) =>
  centavos(Math.max(0, itens.reduce((s, i) => s + i.subtotal, 0) - Number(desconto || 0)));

/** "2026-10-20" do <input type="date"> = válido até o fim desse dia no horário local (não meia-noite UTC). */
const fimDoDia = (data) => (/^\d{4}-\d{2}-\d{2}$/.test(data) ? new Date(`${data}T23:59:59.999`) : new Date(data));

export async function POST(req) {
  const { usuario, resposta } = await exigirUsuario();
  if (resposta) return resposta;
  const b = await req.json();
  if (!b.leadId) return NextResponse.json({ erro: "leadId obrigatório" }, { status: 400 });
  const lead = await db.lead.findUnique({ where: { id: b.leadId } });
  if (!lead) return NextResponse.json({ erro: "lead não encontrado" }, { status: 404 });

  const itens = (b.itens ?? [])
    .filter((i) => i.descricao?.trim())
    .map((i) => {
      const quantidade = Number(i.quantidade) || 1;
      const precoUnit = centavos(i.precoUnit);
      return {
        produtoId: i.produtoId || null,
        descricao: i.descricao.trim(),
        quantidade,
        precoUnit,
        subtotal: centavos(quantidade * precoUnit),
      };
    });
  if (!itens.length) return NextResponse.json({ erro: "informe ao menos 1 item" }, { status: 400 });

  const status = b.status || "ENVIADO";
  const validadeEm = b.validadeEm ? fimDoDia(b.validadeEm) : null;
  if (validadeEm && (Number.isNaN(validadeEm.getTime()) || validadeEm < new Date())) {
    return NextResponse.json({ erro: "validade precisa ser hoje ou uma data futura" }, { status: 400 });
  }

  const orcamento = await comNumeroSequencial(async (tx, numero) => {
    const orcamento = await tx.orcamento.create({
      data: {
        numero,
        leadId: b.leadId,
        responsavelId: usuario.id,
        status,
        desconto: centavos(b.desconto),
        total: calcularTotal(itens, b.desconto),
        validadeEm,
        enviadoEm: status === "ENVIADO" ? new Date() : null,
        itens: { create: itens },
      },
      include: { itens: true },
    });

    if ((lead.etapa === "NOVO" && status === "ENVIADO") || !lead.responsavelId) {
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          ...(lead.etapa === "NOVO" && status === "ENVIADO" ? { etapa: "ORCAMENTO" } : {}),
          responsavelId: lead.responsavelId ?? usuario.id, // quem orça primeiro assume o lead
        },
      });
    }
    await tx.atividade.create({
      data: {
        leadId: b.leadId,
        autorId: usuario.id,
        tipo: "ORCAMENTO",
        descricao: `Orçamento #${orcamento.numero} criado com ${itens.length} item(ns) — total R$ ${orcamento.total.toFixed(2)}`,
      },
    });
    return orcamento;
  });

  return NextResponse.json(orcamento);
}
