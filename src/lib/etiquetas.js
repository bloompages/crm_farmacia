/**
 * Etiquetas do lead ("vip", "recompra mensal", "receita controlada"…): texto livre,
 * guardado em Lead.etiquetas como "vip,recompra mensal". Sempre minúsculas e sem
 * repetição, para "VIP" e "vip" não virarem duas etiquetas no filtro.
 */

export const MAX_ETIQUETA = 30;

export function normalizarEtiquetas(valor) {
  const lista = Array.isArray(valor) ? valor : String(valor ?? "").split(/[,;|]/);
  const vistas = new Set();
  for (const bruto of lista) {
    const e = String(bruto ?? "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, MAX_ETIQUETA);
    if (e) vistas.add(e);
  }
  return [...vistas];
}

export const etiquetasParaTexto = (valor) => normalizarEtiquetas(valor).join(",");
export const listaEtiquetas = (texto) => normalizarEtiquetas(texto);

/**
 * `where` do Prisma para leads que têm exatamente essa etiqueta (não basta conter:
 * "vip" não pode achar "vip ouro").
 */
export function filtroEtiqueta(etiqueta) {
  const e = normalizarEtiquetas(etiqueta)[0];
  if (!e) return {};
  return {
    OR: [
      { etiquetas: e },
      { etiquetas: { startsWith: `${e},` } },
      { etiquetas: { endsWith: `,${e}` } },
      { etiquetas: { contains: `,${e},` } },
    ],
  };
}

/** Contagem de uso de cada etiqueta, da mais usada para a menos usada. */
export function contarEtiquetas(leads) {
  const cont = new Map();
  for (const l of leads) for (const e of listaEtiquetas(l.etiquetas)) cont.set(e, (cont.get(e) ?? 0) + 1);
  return [...cont].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
}
