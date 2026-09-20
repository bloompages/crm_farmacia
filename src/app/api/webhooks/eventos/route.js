import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reprocessarEvento } from "@/lib/webhook";

export const dynamic = "force-dynamic";

/** Lista os últimos eventos de webhook (por padrão só os com erro) para auditoria. */
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const status = p.get("status") ?? "ERRO";
  const eventos = await db.eventoWebhook.findMany({
    where: status === "TODOS" ? {} : { status },
    orderBy: { recebidoEm: "desc" },
    take: Number(p.get("limite") ?? 50),
    select: { id: true, canal: true, status: true, mensagens: true, erro: true, tentativas: true, recebidoEm: true, processadoEm: true },
  });
  return NextResponse.json(eventos);
}

/** Reprocessa um evento ({ id }) ou todos os com erro ({ todos: true }). */
export async function POST(req) {
  const corpo = await req.json().catch(() => ({}));
  const ids = corpo.todos
    ? (await db.eventoWebhook.findMany({ where: { status: "ERRO" }, select: { id: true } })).map((e) => e.id)
    : corpo.id ? [corpo.id] : [];
  const resultados = [];
  for (const id of ids) {
    try {
      resultados.push(await reprocessarEvento(id));
    } catch (e) {
      resultados.push({ eventoId: id, erros: [e?.message ?? String(e)] });
    }
  }
  return NextResponse.json({ reprocessados: resultados.length, resultados });
}
