/**
 * Roda no build da Vercel, só no deploy de PRODUÇÃO (VERCEL_ENV=production):
 *   1. `prisma db push` — cria/atualiza as tabelas. Sem --accept-data-loss: uma mudança
 *      que apagaria dados derruba o build em vez de apagar.
 *   2. Primeiro gerente — se GERENTE_EMAIL e GERENTE_SENHA_INICIAL estiverem definidas e
 *      esse e-mail ainda não existir, cria o usuário. Nunca redefine senha de quem já existe.
 * Em qualquer outro lugar (local, preview) não faz nada.
 */
import { execSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production") {
  console.log("[preparar-producao] fora do deploy de produção — nada a fazer");
  process.exit(0);
}

execSync("npx prisma db push --skip-generate", { stdio: "inherit" });

const email = process.env.GERENTE_EMAIL?.trim().toLowerCase();
const senha = process.env.GERENTE_SENHA_INICIAL;
if (email && senha) {
  const { PrismaClient } = await import("@prisma/client");
  const { hashSenha } = await import("../src/lib/auth.js");
  const db = new PrismaClient();
  if (await db.user.findUnique({ where: { email } })) {
    console.log(`[preparar-producao] gerente ${email} já existe — senha não alterada`);
  } else {
    await db.user.create({
      data: { email, nome: process.env.GERENTE_NOME?.trim() || email.split("@")[0], papel: "GERENTE", cargo: "Gerente", senhaHash: await hashSenha(senha) },
    });
    console.log(`[preparar-producao] gerente ${email} criado — troque a senha no primeiro acesso`);
  }
  await db.$disconnect();
}
