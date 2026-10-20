import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PAPEIS, hashSenha, problemaNaSenha, publico } from "@/lib/auth";
import { exigirUsuario } from "@/lib/usuario";
import { auditar } from "@/lib/auditoria";

/**
 * Altera papel, cargo, nome, ativo ou redefine a senha. Desativar ou trocar a senha
 * derruba as sessões abertas da pessoa. A farmácia nunca fica sem gerente ativo.
 */
export async function PATCH(req, { params }) {
  const { usuario, resposta } = await exigirUsuario("GERENTE");
  if (resposta) return resposta;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const alvo = await db.user.findUnique({ where: { id } });
  if (!alvo) return NextResponse.json({ erro: "usuário não encontrado" }, { status: 404 });

  const data = {};
  if (b.nome !== undefined) data.nome = String(b.nome).trim() || alvo.nome;
  if (b.cargo !== undefined) data.cargo = String(b.cargo).trim() || alvo.cargo;
  if (b.papel !== undefined) {
    if (!PAPEIS.some((p) => p.id === b.papel)) return NextResponse.json({ erro: "papel inválido" }, { status: 400 });
    data.papel = b.papel;
  }
  if (b.ativo !== undefined) data.ativo = !!b.ativo;
  if (b.senha !== undefined) {
    const problema = problemaNaSenha(b.senha);
    if (problema) return NextResponse.json({ erro: problema }, { status: 400 });
    data.senhaHash = await hashSenha(b.senha);
  }

  const deixaDeSerGerenteAtivo =
    alvo.papel === "GERENTE" && alvo.ativo && (data.papel === "ATENDENTE" || data.ativo === false);
  if (deixaDeSerGerenteAtivo) {
    const outros = await db.user.count({ where: { papel: "GERENTE", ativo: true, id: { not: id } } });
    if (!outros) return NextResponse.json({ erro: "é preciso manter ao menos um gerente ativo" }, { status: 400 });
  }
  if (id === usuario.id && data.ativo === false) {
    return NextResponse.json({ erro: "você não pode desativar o próprio acesso" }, { status: 400 });
  }

  const derrubarSessoes = data.ativo === false || data.senhaHash || data.papel;
  const [user] = await db.$transaction([
    db.user.update({ where: { id }, data }),
    ...(derrubarSessoes && id !== usuario.id ? [db.sessao.deleteMany({ where: { userId: id } })] : []),
  ]);

  const mudou = Object.keys(data).map((k) => (k === "senhaHash" ? "senha redefinida" : `${k}: ${data[k]}`)).join(", ");
  await auditar("USUARIO_ALTERADO", { entidade: "User", entidadeId: id, detalhe: `${alvo.email} — ${mudou}` });
  return NextResponse.json(publico(user));
}
