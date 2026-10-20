/**
 * Cria (ou redefine a senha de) um usuário pela linha de comando — é assim que o
 * primeiro gerente entra num banco de produção, que não tem os usuários do seed.
 *
 *   npm run usuario:criar -- --email gerente@farmacia.com.br --nome "Fulana" --gerente
 *
 * A senha é gerada aleatoriamente e mostrada uma única vez; troque em "Minha conta".
 */
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashSenha } from "../src/lib/auth.js";

const arg = (nome) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const email = arg("email")?.trim().toLowerCase();
const nome = arg("nome")?.trim();
const papel = process.argv.includes("--gerente") ? "GERENTE" : "ATENDENTE";

if (!email) {
  console.error('uso: npm run usuario:criar -- --email pessoa@farmacia.com.br [--nome "Nome"] [--gerente]');
  process.exit(1);
}

const db = new PrismaClient();
const senha = randomBytes(9).toString("base64url");
const senhaHash = await hashSenha(senha);
const existente = await db.user.findUnique({ where: { email } });

const user = existente
  ? await db.user.update({ where: { email }, data: { senhaHash, ativo: true, ...(process.argv.includes("--gerente") ? { papel } : {}) } })
  : await db.user.create({ data: { email, nome: nome || email.split("@")[0], papel, cargo: papel === "GERENTE" ? "Gerente" : "Atendente", senhaHash } });
if (existente) await db.sessao.deleteMany({ where: { userId: user.id } });

console.log(`${existente ? "Senha redefinida" : "Usuário criado"}: ${user.email} (${user.papel})`);
console.log(`Senha: ${senha}`);
await db.$disconnect();
