/**
 * Sistema de cores do CRM — única fonte de verdade.
 *
 * Regra: cor carrega SIGNIFICADO, não decoração. Só quatro famílias:
 *   neutro   (slate)   -> tudo que é apenas informação
 *   marca    (emerald) -> ação primária, positivo, ganho
 *   atencao  (amber)   -> aguardando alguém / precisa de ação
 *   negativo (rose)    -> perda, erro, urgência
 *
 * Chips, badges e gráficos importam daqui. Nenhum componente deve escolher
 * uma cor "nova" (sky, violet, fuchsia…) por conta própria.
 */

/** Classes de chip por tom semântico. */
export const TOM = {
  neutro:   "border-slate-200 bg-slate-100 text-slate-700",
  neutroClaro: "border-slate-200 bg-white text-slate-500",
  marca:    "border-emerald-200 bg-emerald-50 text-emerald-700",
  marcaForte: "border-emerald-600 bg-emerald-600 text-white",
  atencao:  "border-amber-200 bg-amber-50 text-amber-700",
  negativo: "border-rose-200 bg-rose-50 text-rose-700",
};

/** Chip de filtro/aba: selecionado x não selecionado. */
export const chipFiltro = (ativo) => (ativo ? TOM.marca : TOM.neutroClaro);

/**
 * Etapas do funil: Novo (neutro) -> Orçamento enviado (espera o cliente: atenção)
 * -> Aprovado (positivo, verde forte) | Perdido (negativo).
 */
export const COR_ETAPA = {
  NOVO:      TOM.neutro,
  ORCAMENTO: TOM.atencao,
  APROVADO:  TOM.marcaForte,
  PERDIDO:   TOM.negativo,
};

export const COR_STATUS_ORCAMENTO = {
  RASCUNHO:  TOM.neutro,
  ENVIADO:   TOM.atencao,
  ACEITO:    TOM.marca,
  REJEITADO: TOM.negativo,
  EXPIRADO:  TOM.neutroClaro,
};

/** Temperatura do lead: só o QUENTE grita; morno é atenção; frio é neutro. */
export const COR_TEMPERATURA = {
  QUENTE: TOM.negativo,
  MORNO:  TOM.atencao,
  FRIO:   TOM.neutroClaro,
};
export const PONTO_TEMPERATURA = { QUENTE: "bg-rose-500", MORNO: "bg-amber-400", FRIO: "bg-slate-300" };

/**
 * Canais: o chip é neutro (não compete com os botões verdes); a identidade
 * vem do rótulo + um ponto colorido pequeno.
 */
export const CANAL = {
  WHATSAPP:  { rotulo: "WhatsApp",  ponto: "bg-emerald-500", chip: TOM.neutro },
  INSTAGRAM: { rotulo: "Instagram", ponto: "bg-rose-400",    chip: TOM.neutro },
};

/**
 * Cores dos gráficos (hex, para SVG). Mesmos hues da interface.
 * Validado com o validador de paleta (modo claro, superfície branca):
 *   ganho #059669 x perda #f43f5e — ΔE CVD 8.3 (deutan), visão normal 33.3, contraste >= 3:1.
 *   A posição (acima/abaixo do zero) e os rótulos diretos são a codificação secundária.
 * Rampa do funil: um único hue (emerald), luminosidade monotônica.
 */
export const GRAFICO = {
  ganho:      "#059669", // emerald-600
  perda:      "#f43f5e", // rose-500
  atencao:    "#f59e0b", // amber-500
  neutro:     "#cbd5e1", // slate-300
  grade:      "#e2e8f0", // slate-200
  eixo:       "#cbd5e1", // slate-300
  mudo:       "#94a3b8", // slate-400
  secundario: "#475569", // slate-600
  tinta:      "#0f172a", // slate-900
  superficie: "#ffffff",
  trilha:     "#f1f5f9", // slate-100
  rampa:      ["#6ee7b7", "#10b981", "#047857"], // emerald 300 -> 700 (uma cor por etapa em progressão)
};
