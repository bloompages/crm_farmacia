import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PAPEIS, hashSenha, problemaNaSenha, publico } from "@/lib/auth";
import { exigirUsuario } from "@/lib/usuario";
import { auditar } from "@/lib/auditoria";

/** Cria usuário com senha inicial (o gerente repassa; a pessoa troca em /equipe). */
export async function POST(req) {
  const { resposta } = await exigirUsuario("GERENTE");
  if (resposta) return resposta;
  const b = await req.json().catch(() => ({}));

  const nome = String(b.nome ?? "").trim();
  const email = String(b.email ?? "").trim().toLowerCase();
  if (!nome) return NextResponse.json({ erro: "nome obrigatório" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ erro: "e-mail inválido" }, { status: 400 });
  if (!PAPEIS.some((p) => p.id === b.papel)) return NextResponse.json({ erro: "papel inválido" }, { status: 400 });
  const problema = problemaNaSenha(b.senha);
  if (problema) return NextResponse.json({ erro: problema }, { status: 400 });
  if (await db.user.findUnique({ where: { email } })) {
    return NextResponse.json({ erro: "já existe usuário com este e-mail" }, { status: 409 });
  }

  const user = await db.user.create({
    data: { nome, email, papel: b.papel, cargo: String(b.cargo ?? "").trim() || (b.papel === "GERENTE" ? "Gerente" : "Atendente"), senhaHash: await hashSenha(b.senha) },
  });
  await auditar("USUARIO_CRIADO", { entidade: "User", entidadeId: user.id, detalhe: `${email} (${b.papel})` });
  return NextResponse.json(publico(user));
}
