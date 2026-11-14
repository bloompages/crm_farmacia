import { NextResponse } from "next/server";
import { COOKIE_SESSAO, HEADER_USUARIO, validarSessao } from "./lib/auth.js";

/**
 * Porta de entrada única: toda página e API exige sessão válida, exceto o login, a política de
 * privacidade (exigida pela Meta) e os webhooks da Meta (que têm assinatura própria). Roda no runtime Node para
 * validar a sessão no banco — desativar um usuário corta o acesso na hora.
 */
const PUBLICAS = [/^\/login$/, /^\/privacidade$/, /^\/api\/auth\/login$/, /^\/api\/webhooks\/(whatsapp|instagram)$/];

export async function middleware(req) {
  const { pathname, search } = req.nextUrl;
  const repassar = new Headers(req.headers);
  repassar.delete(HEADER_USUARIO); // nunca confiar no que o navegador manda com esse nome

  if (PUBLICAS.some((r) => r.test(pathname))) {
    return NextResponse.next({ request: { headers: repassar } });
  }

  // Banco fora do ar por um instante não é sessão inválida: tenta de novo e, se continuar
  // falhando, responde 503 sem apagar o cookie (senão a pessoa seria deslogada à toa).
  const token = req.cookies.get(COOKIE_SESSAO)?.value;
  let usuario = null;
  let falhou = false;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      usuario = await validarSessao(token);
      falhou = false;
      break;
    } catch (e) {
      falhou = true;
      console.error(`[middleware] falha ao validar sessão (tentativa ${tentativa + 1})`, e);
      if (tentativa === 0) await new Promise((r) => setTimeout(r, 400));
    }
  }

  if (falhou) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ erro: "banco de dados indisponível, tente de novo em instantes" }, { status: 503 });
    return new NextResponse(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CRM indisponível</title>' +
        '<body style="font-family:system-ui;padding:2rem;color:#334155"><p>O CRM não conseguiu falar com o banco de dados agora.</p>' +
        '<p><a href="" style="color:#047857">Tentar de novo</a></p>',
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Retry-After": "5" } }
    );
  }

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
