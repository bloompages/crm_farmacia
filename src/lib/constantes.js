import { COR_ETAPA, TOM } from "./tema.js";

export const ETAPAS = [
  { id: "NOVO", label: "Novo lead", cor: COR_ETAPA.NOVO },
  { id: "ORCAMENTO", label: "Orçamento enviado", cor: COR_ETAPA.ORCAMENTO },
  { id: "APROVADO", label: "Aprovado", cor: COR_ETAPA.APROVADO },
  { id: "PERDIDO", label: "Perdido", cor: COR_ETAPA.PERDIDO },
];

export const MOTIVOS_REJEICAO = [
  { id: "PRECO", label: "Preço acima do esperado", acao: "Rever margem / oferecer genérico ou similar" },
  { id: "CONCORRENCIA", label: "Comprou do concorrente", acao: "Mapear preço praticado e criar contra-oferta" },
  { id: "SEM_ESTOQUE", label: "Sem estoque no prazo", acao: "Ajustar compras e curva ABC do item" },
  { id: "PRAZO_ENTREGA", label: "Prazo de entrega longo", acao: "Revisar logística / entrega no mesmo dia" },
  { id: "SEM_RESPOSTA", label: "Cliente não respondeu", acao: "Cadência de follow-up em 24h/72h/7d" },
  { id: "DESISTIU", label: "Desistiu da compra", acao: "Pesquisar motivo real na régua de reativação" },
  { id: "CONVENIO", label: "Conseguiu pelo convênio/SUS", acao: "Ofertar itens fora da cobertura" },
  { id: "OUTRO", label: "Outro motivo", acao: "Detalhar na observação" },
];

export const ORIGENS = ["WHATSAPP", "INSTAGRAM", "INDICACAO", "BALCAO", "SITE", "MANUAL"];
export const CANAIS = ["WHATSAPP", "INSTAGRAM"];
export const STATUS_ORCAMENTO = ["RASCUNHO", "ENVIADO", "ACEITO", "REJEITADO", "EXPIRADO"];

export const labelEtapa = (id) => ETAPAS.find((e) => e.id === id)?.label ?? id;
export const corEtapa = (id) => ETAPAS.find((e) => e.id === id)?.cor ?? TOM.neutro;
export const labelMotivo = (id) => MOTIVOS_REJEICAO.find((m) => m.id === id)?.label ?? id ?? "—";

export const brl = (v) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dataHora = (d) =>
  d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export const dataCurta = (d) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

/** "há 5 min", "há 3 h", "há 2 d" — para indicar recência sem poluir com data completa. */
export const tempoRelativo = (d) => {
  if (!d) return "—";
  const seg = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (seg < 60) return "agora";
  if (seg < 3600) return `há ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`;
  return `há ${Math.floor(seg / 86400)} d`;
};
