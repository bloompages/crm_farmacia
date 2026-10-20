/**
 * Mensagens rápidas: no inbox, "/pix" + Tab insere o texto cadastrado.
 * Regras puras — usadas na API, no inbox (navegador) e nos testes.
 */

/** "/Forma de Pagamento" -> "forma-de-pagamento". Vazio quando não sobra nada válido. */
export const normalizarAtalho = (t) =>
  String(t ?? "")
    .trim()
    .replace(/^\/+/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

/** Primeiro nome do contato para o {nome}; @usuario do Instagram e número puro não viram nome. */
export function primeiroNome(nomeExibicao) {
  const n = String(nomeExibicao ?? "").trim();
  if (!n || n.startsWith("@") || /^[\d\s()+-]+$/.test(n)) return "";
  const p = n.split(/\s+/)[0];
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

/** Substitui {nome}; sem nome conhecido, some junto com o espaço/vírgula antes ("Olá, {nome}!" -> "Olá!"). */
export function aplicarModelo(texto, { nome } = {}) {
  const n = primeiroNome(nome);
  return String(texto ?? "").replace(/([ ,]*)\{nome\}/gi, (_, antes) => (n ? `${antes}${n}` : ""));
}

/**
 * Atalho sendo digitado: o texto inteiro do campo é "/algo" (sem espaço).
 * Devolve o termo (sem a barra) ou null.
 */
export function termoDigitado(texto) {
  const m = /^\/([^\s/]*)$/.exec(String(texto ?? ""));
  return m ? m[1].toLowerCase() : null;
}

/** Sugestões para o termo: começa com ele primeiro, depois contém (no atalho ou no texto). */
export function sugerir(lista, termo, max = 6) {
  const t = normalizarAtalho(termo);
  if (!t) return lista.slice(0, max);
  const comeca = lista.filter((m) => m.atalho.startsWith(t));
  const contem = lista.filter((m) => !m.atalho.startsWith(t) && (m.atalho.includes(t) || m.texto.toLowerCase().includes(termo.toLowerCase())));
  return [...comeca, ...contem].slice(0, max);
}
