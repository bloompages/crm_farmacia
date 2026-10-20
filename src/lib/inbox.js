import { db } from "./db.js";
import { paraBusca } from "./busca.js";

export const POR_PAGINA = 100;

const LEAD = {
  select: { id: true, nome: true, etapa: true, valorAprovado: true, temperatura: true, score: true, etiquetas: true, responsavel: { select: { id: true, nome: true } } },
};

/**
 * Lista do inbox: cada conversa vem só com a ÚLTIMA mensagem (prévia, "precisa
 * responder", janela de 24h). As mensagens completas vêm de mensagensDaConversa
 * quando a conversa é aberta — o polling não carrega mais o histórico inteiro.
 * Nunca esconde conversa por idade: só ordena e, se pedido, filtra por texto.
 */
export async function listarConversas({ q = "", limite = 300 } = {}) {
  const termo = paraBusca(q);
  const digitos = q.replace(/\D/g, "");
  const where = termo
    ? {
        OR: [
          { busca: { contains: termo } },
          ...(digitos.length >= 4 ? [{ contatoExterno: { contains: digitos } }] : []),
          { mensagens: { some: { textoBusca: { contains: termo } } } },
        ],
      }
    : {};
  return db.conversa.findMany({
    where,
    orderBy: { ultimaMsgEm: "desc" },
    take: Math.min(1000, Number(limite) || 300),
    include: { mensagens: { orderBy: { enviadoEm: "desc" }, take: 1 }, lead: LEAD },
  });
}

/**
 * As mensagens MAIS RECENTES da conversa, em ordem cronológica. `antes` (id da mais
 * antiga já carregada) pagina para trás no "carregar anteriores" — cursor por id,
 * para não pular mensagens com o mesmo horário.
 */
export async function mensagensDaConversa(conversaId, { antes, limite = POR_PAGINA } = {}) {
  const lote = await db.mensagem.findMany({
    where: { conversaId },
    orderBy: [{ enviadoEm: "desc" }, { id: "desc" }],
    ...(antes ? { cursor: { id: antes }, skip: 1 } : {}),
    take: limite + 1,
    include: { autor: { select: { nome: true } } },
  });
  return { mensagens: lote.slice(0, limite).reverse(), temMais: lote.length > limite };
}
