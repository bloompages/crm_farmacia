import { NextResponse } from "next/server";
import { COOKIE_SESSAO, encerrarSessao } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";

export async function POST(req) {
  await auditar("LOGOUT");
  await encerrarSessao(req.cookies.get(COOKIE_SESSAO)?.value);
  const r = NextResponse.json({ ok: true });
  r.cookies.delete(COOKIE_SESSAO);
  return r;
}
