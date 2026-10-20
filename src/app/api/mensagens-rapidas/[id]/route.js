import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/usuario";
import { normalizarAtalho } from "@/lib/mensagensRapidas";
import { normalizarTexto } from "@/lib/formatacao";

export async function PATCH(req, { params }) {
  const { resposta } = await exigirUsuario();
  if (resposta) return resposta;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const data = {};
  if (b.atalho !== undefined) {
    data.atalho = normalizarAtalho(b.atalho);
    if (!data.atalho) return NextResponse.json({ erro: "atalho obrigatório (letras e números)" }, { status: 400 });
    const dono = await db.mensagemRapida.findUnique({ where: { atalho: data.atalho } });
    if (dono && dono.id !== id) return NextResponse.json({ erro: `já existe o atalho /${data.atalho}` }, { status: 409 });
  }
  if (b.texto !== undefined) {
    data.texto = normalizarTexto(b.texto);
    if (!data.texto) return NextResponse.json({ erro: "texto obrigatório" }, { status: 400 });
  }
  const atual = await db.mensagemRapida.findUnique({ where: { id } });
  if (!atual) return NextResponse.json({ erro: "mensagem rápida não encontrada" }, { status: 404 });
  return NextResponse.json(await db.mensagemRapida.update({ where: { id }, data }));
}

export async function DELETE(_req, { params }) {
  const { resposta } = await exigirUsuario();
  if (resposta) return resposta;
  const { id } = await params;
  await db.mensagemRapida.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
