import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enviarMensagem, reenviarMensagem } from "@/lib/mensageria";

export const dynamic = "force-dynamic";

/**
 * Envia uma mensagem. Corpo:
 *   { texto }                       texto livre (Enter no textarea = quebra de linha preservada)
 *   { template: { nome, idioma } }  template do WhatsApp para reabrir conversa após 24h
 *   { reenviarId }                  tenta de novo uma mensagem que ficou FALHOU
 * Resposta 502 quando o provedor recusa — a mensagem fica gravada com o erro.
 */
export async function POST(req, { params }) {
  const { id } = await params;
  const corpo = await req.json().catch(() => ({}));

  try {
    let msg;
    if (corpo.reenviarId) msg = await reenviarMensagem(corpo.reenviarId);
    else if (corpo.template?.nome) msg = await enviarMensagem({ conversaId: id, template: corpo.template });
    else {
      if (!corpo.texto?.trim()) return NextResponse.json({ erro: "texto vazio" }, { status: 400 });
      msg = await enviarMensagem({ conversaId: id, texto: corpo.texto });
    }
    if (msg.status === "FALHOU") return NextResponse.json({ erro: msg.erro, mensagem: msg }, { status: 502 });
    return NextResponse.json(msg);
  } catch (e) {
    return NextResponse.json({ erro: e?.message ?? "Falha ao enviar" }, { status: 500 });
  }
}

/** Marca a conversa como lida. */
export async function PATCH(req, { params }) {
  const { id } = await params;
  await db.conversa.update({ where: { id }, data: { naoLidas: 0 } });
  return NextResponse.json({ ok: true });
}
