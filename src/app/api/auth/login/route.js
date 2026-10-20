import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  COOKIE_SESSAO, criarSessao, ipDaRequisicao, loginBloqueado, opcoesCookie, publico, registrarTentativa, verificarSenha,
} from "@/lib/auth";
import { auditar } from "@/lib/auditoria";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  const ip = ipDaRequisicao(req);
  const chave = `${email}|${ip ?? "?"}`;

  const minutos = loginBloqueado(chave);
  if (minutos) {
    return NextResponse.json({ erro: `muitas tentativas — aguarde ${minutos} min` }, { status: 429 });
  }

  const user = email ? await db.user.findUnique({ where: { email } }) : null;
  const ok = (await verificarSenha(b.senha ?? "", user?.senhaHash)) && user?.ativo;
  registrarTentativa(chave, ok);

  if (!ok) {
    await auditar("LOGIN_FALHOU", { entidade: "User", entidadeId: user?.id, detalhe: email, usuario: null, ip });
    // mesma mensagem para e-mail inexistente e senha errada
    return NextResponse.json({ erro: "e-mail ou senha incorretos" }, { status: 401 });
  }

  const { token, expiraEm } = await criarSessao(user.id, ip);
  await db.user.update({ where: { id: user.id }, data: { ultimoLoginEm: new Date() } });
  await auditar("LOGIN", { entidade: "User", entidadeId: user.id, usuario: user, ip });

  const r = NextResponse.json({ usuario: publico(user) });
  r.cookies.set(COOKIE_SESSAO, token, opcoesCookie(expiraEm));
  return r;
}
