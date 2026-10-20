import { filtroEtiqueta } from "./etiquetas.js";

/**
 * O `contains` do banco diferencia acento (e, no Postgres, maiúsculas) ("orcamento" não acha "orçamento").
 * Leads, conversas e mensagens guardam uma coluna `busca`/`textoBusca` já
 * normalizada, e a consulta é normalizada do mesmo jeito.
 */
export const paraBusca = (...partes) =>
  partes
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const buscaLead = (l) => paraBusca(l.nome, l.empresa, l.email);
export const buscaConversa = (c) => paraBusca(c.nomeExibicao, c.contatoExterno);

/**
 * `where` da lista de leads (tela /leads e exportação CSV usam o mesmo filtro).
 * nome/empresa/e-mail: coluna sem acento ("joao" acha "João");
 * telefone é gravado só com dígitos: "(11) 98765" busca por "1198765".
 */
export function filtroLeads({ etapa, origem, q, meus, etiqueta } = {}, usuarioId) {
  const digitos = (q ?? "").replace(/\D/g, "");
  const e = []; // condições com OR próprio vão num AND para não se sobrescreverem
  if (q) e.push({ OR: [{ busca: { contains: paraBusca(q) } }, ...(digitos.length >= 4 ? [{ telefone: { contains: digitos } }] : [])] });
  if (etiqueta) e.push(filtroEtiqueta(etiqueta));
  return {
    ...(etapa ? { etapa } : {}),
    ...(origem ? { origem } : {}),
    ...(meus ? { responsavelId: usuarioId ?? "-" } : {}),
    ...(e.length ? { AND: e } : {}),
  };
}
