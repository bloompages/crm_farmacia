import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db } from "./db.js";

const scrypt = promisify(scryptCb);

export const COOKIE_SESSAO = "crm_sessao";
export const HEADER_USUARIO = "x-crm-usuario"; // preenchido pelo middleware; nunca aceito vindo do navegador
const DURACAO_MS = 12 * 3600 * 1000; // um turno; renovada enquanto a pessoa usa
const RENOVAR_ANTES_MS = 6 * 3600 * 1000;

export const PAPEIS = [
  { id: "GERENTE", label: "Gerente", descricao: "tudo, inclusive equipe, exclusões, LGPD e auditoria" },
  { id: "ATENDENTE", label: "Atendente", descricao: "leads, orçamentos e mensagens" },
];

/* ------------------------------------------------------------------ senha */

/** "scrypt$<sal>$<hash>" — scrypt nativo do Node, sem dependência externa. */
export async function hashSenha(senha) {
  const sal = randomBytes(16);
  const hash = await scrypt(String(senha), sal, 64);
  return `scrypt$${sal.toString("base64")}$${hash.toString("base64")}`;
}

export async function verificarSenha(senha, guardado) {
  const [alg, sal, hash] = String(guardado ?? "").split("$");
  if (alg !== "scrypt" || !sal || !hash) {
    await scrypt("x", "sal-fixo-para-tempo-constante", 64); // não revela pelo tempo se o usuário existe
    return false;
  }
  const esperado = Buffer.from(hash, "base64");
  const obtido = await scrypt(String(senha), Buffer.from(sal, "base64"), esperado.length);
  return timingSafeEqual(esperado, obtido);
}

/** Regras mínimas: 8+ caracteres e não só números. */
export function problemaNaSenha(senha) {
  if (typeof senha !== "string" || senha.length < 8) return "a senha precisa ter ao menos 8 caracteres";
  if (/^\d+$/.test(senha)) return "a senha não pode ter só números";
  return null;
}

/* ------------------------------------------------------------------ sessão */

/** id da Sessao no banco = sha256 do token do cookie (vazar o banco não entrega sessões válidas). */
export const hashToken = (token) => createHash("sha256").update(token).digest("hex");

export async function criarSessao(userId, ip) {
  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + DURACAO_MS);
  await db.sessao.create({ data: { id: hashToken(token), userId, expiraEm, ip: ip ?? null } });
  return { token, expiraEm };
}

/** Usuário ativo dono do token, ou null. Renova a sessão quando passou da metade. */
export async function validarSessao(token) {
  if (!token) return null;
  const sessao = await db.sessao.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!sessao) return null;
  if (sessao.expiraEm < new Date() || !sessao.user.ativo) {
    await db.sessao.delete({ where: { id: sessao.id } }).catch(() => {});
    return null;
  }
  if (sessao.expiraEm.getTime() - Date.now() < RENOVAR_ANTES_MS) {
    await db.sessao.update({ where: { id: sessao.id }, data: { expiraEm: new Date(Date.now() + DURACAO_MS) } }).catch(() => {});
  }
  return publico(sessao.user);
}

export async function encerrarSessao(token) {
  if (token) await db.sessao.deleteMany({ where: { id: hashToken(token) } });
}

export const opcoesCookie = (expiraEm) => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  expires: expiraEm,
});

/** Campos do usuário que podem circular pela aplicação (nunca o hash da senha). */
export const publico = (u) => u && { id: u.id, nome: u.nome, email: u.email, cargo: u.cargo, papel: u.papel };

/* ------------------------------------------------------------------ limite de tentativas */

const tentativas = globalThis.__crmTentativasLogin ?? (globalThis.__crmTentativasLogin = new Map());
const JANELA_TENTATIVAS_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS = 5;

/** Bloqueia força bruta: 5 erros por e-mail+IP em 15 min. */
export function loginBloqueado(chave) {
  const t = tentativas.get(chave);
  if (!t || Date.now() - t.desde > JANELA_TENTATIVAS_MS) return 0;
  return t.erros >= MAX_TENTATIVAS ? Math.ceil((t.desde + JANELA_TENTATIVAS_MS - Date.now()) / 60000) : 0;
}

export function registrarTentativa(chave, sucesso) {
  if (sucesso) return tentativas.delete(chave);
  const t = tentativas.get(chave);
  if (!t || Date.now() - t.desde > JANELA_TENTATIVAS_MS) tentativas.set(chave, { erros: 1, desde: Date.now() });
  else t.erros += 1;
}

export const ipDaRequisicao = (req) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || null;
