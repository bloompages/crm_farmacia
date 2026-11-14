import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cifra os tokens das integrações guardados no banco (AES-256-GCM). A chave vem de
 * CHAVE_CRIPTOGRAFIA, uma variável da Vercel diferente em cada instalação. Assim, quem
 * vê só o banco (um backup, por exemplo) não consegue usar o token do WhatsApp da farmácia.
 *
 * Fora de produção, sem a variável, usa uma chave fixa de desenvolvimento.
 */
const PREFIXO = "v1";

function chave() {
  const segredo = process.env.CHAVE_CRIPTOGRAFIA?.trim();
  if (!segredo) {
    if (process.env.NODE_ENV === "production") return null;
    return createHash("sha256").update("crm-farmacia-chave-de-desenvolvimento").digest();
  }
  return createHash("sha256").update(segredo).digest();
}

export const criptografiaDisponivel = () => chave() !== null;

export function cifrar(texto) {
  const k = chave();
  if (!k) throw new Error("CHAVE_CRIPTOGRAFIA não configurada na Vercel: não é possível guardar tokens com segurança.");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const dados = Buffer.concat([c.update(String(texto), "utf8"), c.final()]);
  return [PREFIXO, iv.toString("base64"), c.getAuthTag().toString("base64"), dados.toString("base64")].join(":");
}

/** Texto original, ou null se não der para decifrar (chave trocada ou valor corrompido). */
export function decifrar(guardado) {
  if (!guardado) return null;
  const [prefixo, iv, tag, dados] = String(guardado).split(":");
  const k = chave();
  if (prefixo !== PREFIXO || !iv || !tag || !dados || !k) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(dados, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
