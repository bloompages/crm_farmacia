import { NextResponse } from "next/server";
import { COOKIE_SESSAO, HEADER_USUARIO, validarSessao } from "./lib/auth.js";

/**
 * Porta de entrada única: toda página e API exige sessão válida, exceto o login
 * e os webhooks da Meta (que têm assinatura própria). Roda no runtime Node para
 * validar a sessão no banco — desativar um usuário corta o acesso na hora.
 */
const PUBLICAS = [/^\/login$/, /^\/api\/auth\/login$/, /^\/api\/webhooks\/(whatsapp|instagram)$/];

export async function middleware(req) {
  const { pathname, search } = req.nextUrl;
  const repassar = new Headers(req.headers);
  repassar.delete(HEADER_USUARIO); // nunca confiar no que o navegador manda com esse nome

  if (PUBLICAS.some((r) => r.test(pathname))) {
    return NextResponse.next({ request: { headers: repassar } });
  }

  const usuario = await validarSessao(req.cookies.get(COOKIE_SESSAO)?.value).catch((e) => {
    console.error("[middleware] falha ao validar sessão", e);
    return null;
  });

  if (!usuario) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ erro: "faça login" }, { status: 401 });
    const login = new URL("/login", req.url);
    if (pathname !== "/") login.searchParams.set("voltar", pathname + search);
    const r = NextResponse.redirect(login);
    r.cookies.delete(COOKIE_SESSAO);
    return r;
  }

  repassar.set(HEADER_USUARIO, usuario.id);
  return NextResponse.next({ request: { headers: repassar } });
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
