import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/usuario";
import { normalizarAtalho } from "@/lib/mensagensRapidas";
import { normalizarTexto } from "@/lib/formatacao";

export const dynamic = "force-dynamic";

export async function GET() {
  const { resposta } = await exigirUsuario();
  if (resposta) return resposta;
  return NextResponse.json(await db.mensagemRapida.findMany({ orderBy: { atalho: "asc" } }));
}

/** { atalho, texto } — qualquer pessoa da equipe cadastra; atalho repetido = 409. */
export async function POST(req) {
  const { resposta } = await exigirUsuario();
  if (resposta) return resposta;
  const b = await req.json().catch(() => ({}));
  const atalho = normalizarAtalho(b.atalho);
  const texto = normalizarTexto(b.texto);
  if (!atalho) return NextResponse.json({ erro: "atalho obrigatório (letras e números)" }, { status: 400 });
  if (!texto) return NextResponse.json({ erro: "texto obrigatório" }, { status: 400 });
  if (await db.mensagemRapida.findUnique({ where: { atalho } })) {
    return NextResponse.json({ erro: `já existe o atalho /${atalho}` }, { status: 409 });
  }
  return NextResponse.json(await db.mensagemRapida.create({ data: { atalho, texto } }));
}
