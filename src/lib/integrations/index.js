import { provedorMock } from "./mock.js";
import { provedorMeta } from "./meta.js";

/**
 * Camada de integração de mensageria.
 * Todo o CRM fala com esta interface; trocar de provedor é só mudar
 * PROVEDOR_MENSAGERIA no .env (mock -> meta) e preencher as credenciais.
 *
 * Contrato do provedor:
 *   nome: string
 *   enviar({ canal, destino, texto, template? }) -> { idExterno }   (lança Error legível se falhar)
 *   baixarMidia({ canal, midiaId, midiaUrl })    -> { corpo: ReadableStream, mime, tamanho }
 *   normalizarWebhook(payload, canal) -> lista de eventos:
 *     { tipoEvento: "MENSAGEM", canal, contatoExterno, nomeExibicao, texto, tipo, midia, idExterno, enviadoEm }
 *     { tipoEvento: "STATUS",   canal, idExterno, status, erro, em }
 */
export function obterProvedor() {
  const escolhido = (process.env.PROVEDOR_MENSAGERIA || "mock").toLowerCase();
  return escolhido === "meta" ? provedorMeta : provedorMock;
}
