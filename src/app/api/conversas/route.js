import { NextResponse } from "next/server";
import { saudeSincronizacao } from "@/lib/mensageria";
import { listarConversas } from "@/lib/inbox";

export const dynamic = "force-dynamic";

/**
 * Lista de conversas para o inbox (carregamento e polling), só com a última mensagem.
 *   ?q=texto      busca por nome, telefone ou conteúdo (sem diferenciar acento)
 *   ?limite=300
 */
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const [conversas, sincronizacao] = await Promise.all([
    listarConversas({ q: (p.get("q") ?? "").trim(), limite: p.get("limite") ?? 300 }),
    saudeSincronizacao(),
  ]);
  return NextResponse.json({ conversas, sincronizacao });
}
