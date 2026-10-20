import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { COOKIE_SESSAO, hashSenha, hashToken, problemaNaSenha, verificarSenha } from "@/lib/auth";
import { exigirUsuario } from "@/lib/usuario";
import { auditar } from "@/lib/auditoria";

/** Troca a própria senha (exige a atual). Derruba as outras sessões do usuário. */
export async function POST(req) {
  const { usuario, resposta } = await exigirUsuario();
  if (resposta) return resposta;
  const b = await req.json().catch(() => ({}));

  const user = await db.user.findUnique({ where: { id: usuario.id } });
  if (!(await verificarSenha(b.atual ?? "", user.senhaHash))) {
    return NextResponse.json({ erro: "senha atual incorreta" }, { status: 400 });
  }
  const problema = problemaNaSenha(b.nova);
  if (problema) return NextResponse.json({ erro: problema }, { status: 400 });

  const atual = hashToken(req.cookies.get(COOKIE_SESSAO)?.value ?? "");
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { senhaHash: await hashSenha(b.nova) } }),
    db.sessao.deleteMany({ where: { userId: user.id, id: { not: atual } } }),
  ]);
  await auditar("SENHA_ALTERADA", { entidade: "User", entidadeId: user.id });
  return NextResponse.json({ ok: true });
}
