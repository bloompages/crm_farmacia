import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Banco só dos testes: o schema "teste" do Postgres (DATABASE_URL_TESTE no .env) é
 * apagado e recriado com o schema atual. Recusa qualquer URL sem "schema=teste" —
 * assim um .env errado nunca mexe no schema de desenvolvimento ou de produção.
 */
export const ehBancoDeTeste = (url) => /[?&]schema=teste(&|$)/.test(url ?? "");

export default async function () {
  const url = process.env.DATABASE_URL_TESTE; // o globalSetup não recebe o `test.env` do vitest.config
  if (!ehBancoDeTeste(url)) {
    throw new Error('Defina DATABASE_URL_TESTE no .env apontando para um schema exclusivo de testes (termina em "?schema=teste" ou "&schema=teste").');
  }
  // só o schema "teste" é apagado — o resto do banco não é tocado
  const db = new PrismaClient({ datasourceUrl: url });
  await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS "teste" CASCADE');
  await db.$disconnect();
  execSync("npx prisma db push --skip-generate", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
}
