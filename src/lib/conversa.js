/**
 * Regras puras de conversa (sem banco) — usadas no servidor e no navegador.
 */

export const JANELA_MS = 24 * 60 * 60 * 1000;

/**
 * Janela de atendimento de 24h (WhatsApp e Instagram): a farmácia só pode
 * responder livremente até 24h depois da ÚLTIMA mensagem do cliente.
 * Depois disso o WhatsApp exige template aprovado. O CRM NUNCA esconde a
 * conversa — apenas sinaliza o estado da janela.
 */
export function janela24h(conversa, agora = Date.now()) {
  const base = conversa?.ultimaMsgClienteEm ? new Date(conversa.ultimaMsgClienteEm).getTime() : null;
  if (!base) return { aberta: false, semMensagemDoCliente: true, restanteMs: 0, expiraEm: null };
  const expiraEm = base + JANELA_MS;
  const restanteMs = expiraEm - agora;
  return { aberta: restanteMs > 0, semMensagemDoCliente: false, restanteMs, expiraEm: new Date(expiraEm) };
}

export function rotuloRestante(ms) {
  if (ms <= 0) return "expirada";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 48) return `${Math.floor(h / 24)} dias`;
  if (h >= 1) return `${h}h${m > 0 ? ` ${m}min` : ""}`;
  return `${m} min`;
}

/** A última mensagem é do cliente e ainda não foi respondida? */
export function aguardandoResposta(conversa) {
  const ultima = conversa?.mensagens?.at?.(-1);
  return !!ultima && ultima.direcao === "ENTRADA";
}

/** Sem resposta da farmácia há mais de 24h (o caso "a conversa some" de outros CRMs). */
export function semRespostaHa24h(conversa, agora = Date.now()) {
  return aguardandoResposta(conversa) && !janela24h(conversa, agora).aberta;
}

export const ROTULO_TIPO = {
  TEXTO: null,
  IMAGEM: "Imagem",
  AUDIO: "Áudio",
  VIDEO: "Vídeo",
  DOCUMENTO: "Documento",
  FIGURINHA: "Figurinha",
  LOCALIZACAO: "Localização",
  CONTATO: "Contato",
  INTERATIVA: "Resposta de botão",
  REACAO: "Reação",
  PEDIDO: "Pedido",
  TEMPLATE: "Template",
  OUTRO: "Mensagem não suportada",
};

/** Texto de uma linha para listas, painel e atividades. */
export function descreverMensagem(m) {
  if (!m) return "—";
  const rotulo = ROTULO_TIPO[m.tipo] ?? null;
  const corpo = (m.texto ?? "").replace(/\s+/g, " ").trim();
  if (!rotulo) return corpo || "—";
  if (m.tipo === "DOCUMENTO" && m.midiaNome) return `📎 ${m.midiaNome}${corpo ? ` — ${corpo}` : ""}`;
  return `[${rotulo}]${corpo ? ` ${corpo}` : ""}`;
}

/** Classifica o anexo para decidir como abrir: prévia inline ou download. */
export function tipoVisual(m) {
  const mime = m?.midiaMime ?? "";
  if (m?.tipo === "IMAGEM" || m?.tipo === "FIGURINHA" || mime.startsWith("image/")) return "imagem";
  if (m?.tipo === "AUDIO" || mime.startsWith("audio/")) return "audio";
  if (m?.tipo === "VIDEO" || mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  if (m?.tipo === "LOCALIZACAO") return "mapa";
  if (m?.midiaId || m?.midiaUrl) return "arquivo";
  return null;
}

/** Extensão a partir do mime — garante que o arquivo baixado abra no programa certo. */
const EXT_POR_MIME = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/amr": "amr",
  "video/mp4": "mp4", "video/3gpp": "3gp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt", "text/csv": "csv", "application/zip": "zip",
};
export function nomeArquivo(m) {
  const mime = (m?.midiaMime ?? "").split(";")[0].trim();
  const ext = EXT_POR_MIME[mime] ?? mime.split("/")[1]?.replace(/[^a-z0-9]/gi, "") ?? "bin";
  let nome = (m?.midiaNome ?? "").trim();
  if (!nome) nome = `${(m?.tipo ?? "arquivo").toLowerCase()}-${m?.id ?? "x"}`;
  if (!/\.[a-z0-9]{2,5}$/i.test(nome)) nome = `${nome}.${ext}`;
  return nome.replace(/[\\/:*?"<>|]/g, "_");
}

/* ------------------------------------------------------------------ valores */

/** "1.234,56" | "1234.56" | "259,9" -> número. Devolve null se não for um valor. */
export function lerValorBR(texto) {
  const t = String(texto ?? "").trim().replace(/^R\$\s*/i, "");
  if (!t) return null;
  let limpo = t;
  if (/,\d{1,2}$/.test(t)) limpo = t.replace(/\./g, "").replace(",", ".");   // formato brasileiro
  else if (/\.\d{1,2}$/.test(t)) limpo = t.replace(/,/g, "");                 // formato com ponto decimal
  else limpo = t.replace(/[.,]/g, "");                                        // inteiro com separador de milhar
  const n = Number(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export const formatarValorBR = (v) =>
  (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const LINHA_TOTAL = /total/i;
const VALOR = /R?\$?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?|\d+\.\d{1,2})/g;

/**
 * Procura, em todas as mensagens da conversa, linhas com a palavra "Total" e
 * soma os valores encontrados nelas. Ex.: "*Total: R$ 259,90*" -> 259.9.
 * Devolve { valor, itens: [{ mensagemId, linha, valor }] }.
 */
export function extrairTotal(mensagens = []) {
  const itens = [];
  for (const m of mensagens) {
    for (const linha of String(m.texto ?? "").split("\n")) {
      if (!LINHA_TOTAL.test(linha)) continue;
      const trecho = linha.slice(linha.search(LINHA_TOTAL));
      const achados = [...trecho.matchAll(VALOR)].map((x) => lerValorBR(x[1])).filter((v) => v !== null && v > 0);
      if (!achados.length) continue;
      // numa linha "Total: R$ 259,90" fica o primeiro valor após a palavra
      const valor = achados[0];
      itens.push({ mensagemId: m.id, linha: linha.trim(), valor });
    }
  }
  const valor = Math.round(itens.reduce((t, i) => t + i.valor, 0) * 100) / 100;
  return { valor, itens };
}
