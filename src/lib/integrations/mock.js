/**
 * Provedor simulado: grava o envio no log do servidor e devolve um id fake.
 * Recebe webhooks no formato simples usado por scripts/simular-mensagens.mjs:
 *   { canal, de, nome, texto, tipo?, arquivo?, mime?, url?, id?, enviadoEm? }
 *   { status: { id, status, erro? } }   -> evento de status de uma mensagem enviada
 * Para testar falha de envio, comece o texto com "!falha".
 */
import { pdfDemo, pngDemo } from "./mock-midia.js";

export const provedorMock = {
  nome: "mock",

  async enviar({ canal, destino, texto, template }) {
    if (texto?.startsWith("!falha")) throw new Error("Simulação: o provedor recusou a mensagem.");
    const idExterno = `mock_out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[mock:${canal}] -> ${destino}: ${template ? `template ${template.nome}` : texto}`);
    return { idExterno };
  },

  /** Mídias "demo_*" são geradas em memória; qualquer outra não existe no simulador. */
  async baixarMidia({ midiaId }) {
    if (midiaId === "demo_receita") {
      const pdf = pdfDemo("Receita medica de demonstracao - CRM Farmacia");
      return { corpo: pdf, mime: "application/pdf", tamanho: pdf.length };
    }
    if (midiaId?.startsWith("demo_")) {
      const png = pngDemo();
      return { corpo: png, mime: "image/png", tamanho: png.length };
    }
    throw new Error("O provedor simulado não hospeda esta mídia.");
  },

  normalizarWebhook(payload, canal) {
    const eventos = Array.isArray(payload) ? payload : [payload];
    return eventos
      .filter(Boolean)
      .map((e) => {
        if (e.status) {
          return { tipoEvento: "STATUS", canal: (e.canal || canal || "WHATSAPP").toUpperCase(), idExterno: e.status.id, status: e.status.status, erro: e.status.erro ?? null, em: new Date() };
        }
        const tipo = (e.tipo || "TEXTO").toUpperCase();
        return {
          tipoEvento: "MENSAGEM",
          canal: (e.canal || canal || "WHATSAPP").toUpperCase(),
          contatoExterno: String(e.de ?? e.contato ?? e.telefone ?? e.usuario ?? "desconhecido"),
          nomeExibicao: e.nome ?? null,
          tipo,
          texto: String(e.texto ?? ""),
          midia: tipo === "TEXTO" || !(e.midiaId || e.url || e.mime) ? null : { id: e.midiaId ?? null, mime: e.mime ?? null, nome: e.arquivo ?? null, tamanho: e.tamanho ?? null, url: e.url ?? null },
          idExterno: e.id ?? `mock_in_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          enviadoEm: e.enviadoEm ? new Date(e.enviadoEm) : new Date(),
        };
      })
      .filter((e) => e.tipoEvento === "STATUS" ? e.idExterno && e.status : e.texto || e.midia || (e.tipo && e.tipo !== "TEXTO" && e.tipo !== "OUTRO"));
  },
};
