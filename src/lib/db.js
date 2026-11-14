import { PrismaClient } from "@prisma/client";

/**
 * Na Vercel cada função serverless é um processo próprio, e o Prisma abre por padrão
 * várias conexões por processo. Quando muitas páginas carregam juntas (login, prefetch
 * do menu, deploy novo), isso estoura o limite de conexões do Prisma Postgres
 * ("too many connections"). Lá, cada processo usa uma conexão só.
 */
function urlDoBanco() {
  const url = process.env.DATABASE_URL;
  if (!url || !process.env.VERCEL || /[?&]connection_limit=/.test(url) || !/^postgres(ql)?:\/\//.test(url)) return undefined;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=1&pool_timeout=20`;
}

const globalForPrisma = globalThis;
const datasourceUrl = urlDoBanco();
export const db = globalForPrisma.prisma ?? new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
