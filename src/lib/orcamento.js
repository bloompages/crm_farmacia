import { db } from "./db.js";

/** Valores em R$ sempre gravados com 2 casas — evita lixo de ponto flutuante nas somas. */
export const centavos = (v) => Math.round((Number(v) || 0) * 100) / 100;

export const STATUS_ABERTOS = ["RASCUNHO", "ENVIADO"];

/**
 * Executa `criar(tx, numero)` numa transação com o próximo número sequencial.
 * Dois orçamentos criados ao mesmo tempo podem ler o mesmo `max + 1`; o índice
 * único de `numero` barra o segundo e a operação é refeita com o número seguinte.
 */
export async function comNumeroSequencial(criar, tentativas = 5) {
  for (let i = 1; ; i++) {
    try {
      return await db.$transaction(async (tx) => {
        const { _max } = await tx.orcamento.aggregate({ _max: { numero: true } });
        return criar(tx, (_max.numero ?? 0) + 1);
      });
    } catch (e) {
      const conflitoDeNumero = e?.code === "P2002" && String(e.meta?.target ?? "").includes("numero");
      if (!conflitoDeNumero || i >= tentativas) throw e;
    }
  }
}
