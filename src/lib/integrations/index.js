import { provedorMock } from "./mock.js";
import { provedorMeta } from "./meta.js";
import { obterConfiguracao, nomeProvedorDe } from "../configuracao.js";

/**
 * Camada de integração de mensageria.
 * Todo o CRM fala com esta interface. A Meta entra sozinha assim que o gerente conecta o
 * WhatsApp ou o Instagram em Configurações › Farmácia e integrações. PROVEDOR_MENSAGERIA
 * (mock | meta), quando definida, força um dos dois (ver nomeProvedorDe).
 *
 * Contrato do provedor:
 *   nome: string
 *   enviar({ canal, destino, texto, template? }) -> { idExterno }   (lança Error legível se falhar)
 *   baixarMidia({ canal, midiaId, midiaUrl })    -> { corpo: ReadableStream, mime, tamanho }
 *   normalizarWebhook(payload, canal) -> lista de eventos:
 *     { tipoEvento: "MENSAGEM", canal, contatoExterno, nomeExibicao, texto, tipo, midia, idExterno, enviadoEm }
 *     { tipoEvento: "STATUS",   canal, idExterno, status, erro, em }
 */
export async function obterProvedor() {
  return nomeProvedorDe(await obterConfiguracao()) === "meta" ? provedorMeta : provedorMock;
}
