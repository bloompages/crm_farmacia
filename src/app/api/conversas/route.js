import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { saudeSincronizacao } from "@/lib/mensageria";

export const dynamic = "force-dynamic";

/**
 * Lista de conversas para o inbox (usada no carregamento e no polling).
 * Nunca esconde conversa por idade: só ordena e, se pedido, filtra por texto.
 *   ?q=texto      busca por nome, contato ou conteúdo
 *   ?limite=300
 */
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const q = (p.get("q") ?? "").trim();
  const limite = Math.min(1000, Number(p.get("limite") ?? 300));

  const where = q
    ? {
        OR: [
          { nomeExibicao: { contains: q } },
          { contatoExterno: { contains: q } },
          { mensagens: { some: { texto: { contains: q } } } },
        ],
      }
    : {};

  const [conversas, sincronizacao] = await Promise.all([
    db.conversa.findMany({
      where,
      orderBy: { ultimaMsgEm: "desc" },
      take: limite,
      include: { mensagens: { orderBy: { enviadoEm: "asc" }, take: 200 }, lead: { select: { id: true, nome: true, etapa: true, valorAprovado: true } } },
    }),
    saudeSincronizacao(),
  ]);

  return NextResponse.json({ conversas, sincronizacao });
}
