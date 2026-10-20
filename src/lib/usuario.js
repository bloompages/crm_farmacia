import { cache } from "react";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "./db.js";
import { HEADER_USUARIO, publico } from "./auth.js";

/**
 * Usuário da requisição atual. O middleware já validou a sessão e repassa o id
 * num header interno (o que vier do navegador com esse nome é descartado).
 */
export const usuarioAtual = cache(async () => {
  const id = (await headers()).get(HEADER_USUARIO);
  if (!id) return null;
  return publico(await db.user.findFirst({ where: { id, ativo: true } }));
});

export const ehGerente = (u) => u?.papel === "GERENTE";

/**
 * Para rotas de API: devolve { usuario } ou { resposta } com 401/403 pronta.
 *   const { usuario, resposta } = await exigirUsuario("GERENTE"); if (resposta) return resposta;
 */
export async function exigirUsuario(papel) {
  const usuario = await usuarioAtual();
  if (!usuario) return { resposta: NextResponse.json({ erro: "faça login" }, { status: 401 }) };
  if (papel && usuario.papel !== papel) {
    return { resposta: NextResponse.json({ erro: "ação restrita ao gerente" }, { status: 403 }) };
  }
  return { usuario };
}

/** IP do cliente para a auditoria (o middleware não altera estes headers). */
export async function ipAtual() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
}
