import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/usuario";

/**
 * Resolver / reabrir a conversa: { status: "FECHADA" | "ABERTA" }.
 * Fechar só tira da fila de "abertas" — se o cliente escrever de novo, ela reabre sozinha.
 */
export async function PATCH(req, { params }) {
  const { usuario, resposta } = await exigirUsuario();
  if (resposta) return resposta;
  const { id } = await params;
  const { status } = await req.json().catch(() => ({}));
  if (!["FECHADA", "ABERTA"].includes(status)) return NextResponse.json({ erro: "status inválido" }, { status: 400 });

  const conversa = await db.conversa.findUnique({ where: { id }, select: { id: true, leadId: true, canal: true } });
  if (!conversa) return NextResponse.json({ erro: "conversa não encontrada" }, { status: 404 });

  const atualizada = await db.conversa.update({
    where: { id },
    data: { status, ...(status === "FECHADA" ? { naoLidas: 0 } : {}) },
    select: { id: true, status: true, naoLidas: true },
  });
  if (conversa.leadId) {
    await db.atividade.create({
      data: {
        leadId: conversa.leadId,
        autorId: usuario.id,
        tipo: "MENSAGEM",
        descricao: status === "FECHADA" ? `Conversa de ${conversa.canal.toLowerCase()} marcada como resolvida.` : `Conversa de ${conversa.canal.toLowerCase()} reaberta.`,
      },
    });
  }
  return NextResponse.json(atualizada);
}
