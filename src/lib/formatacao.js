/** Normaliza quebras de linha (\r\n -> \n), remove espaços à direita e limita linhas em branco. */
export function normalizarTexto(texto) {
  return String(texto ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Versão de uma linha para prévias (lista de conversas, painel). */
export function previaTexto(texto, max = 80) {
  const t = normalizarTexto(texto).replace(/\s*\n+\s*/g, " · ").replace(/[*_~`]/g, "");
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}
