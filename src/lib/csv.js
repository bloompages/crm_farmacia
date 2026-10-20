/**
 * CSV no formato que o Excel brasileiro abre com dois cliques: separador ";",
 * vírgula decimal, UTF-8 com BOM (sem o BOM o Excel mostra "JoÃ£o") e CRLF.
 * Puro (sem banco) — usado nas rotas de exportação/importação e nos testes.
 */

const BOM = "﻿";
export const SEPARADOR = ";";

/**
 * Célula que começa com = + - @ vira fórmula no Excel ("injeção de CSV").
 * Valores que são claramente número/telefone ("-12,50", "+55 11 9…") ficam como estão.
 */
function protegerFormula(t) {
  if (!/^[=+\-@\t\r]/.test(t)) return t;
  if (/^[+-]?[\d\s().,/-]+$/.test(t)) return t;
  return `'${t}`;
}

function celula(v) {
  if (v === null || v === undefined) return "";
  const t = protegerFormula(String(v));
  return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/**
 * colunas: [{ titulo, valor: (linha) => any }]
 * Devolve o texto pronto para download (com BOM).
 */
export function gerarCsv(colunas, linhas) {
  const cab = colunas.map((c) => celula(c.titulo)).join(SEPARADOR);
  const corpo = linhas.map((l) => colunas.map((c) => celula(c.valor(l))).join(SEPARADOR));
  return BOM + [cab, ...corpo].join("\r\n") + "\r\n";
}

/** Resposta HTTP de download com nome de arquivo datado. */
export function respostaCsv(texto, prefixo) {
  const hoje = new Date().toISOString().slice(0, 10);
  return new Response(texto, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${prefixo}-${hoje}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Separador mais provável, olhando a primeira linha fora de aspas: ; , ou tab. */
export function detectarSeparador(texto) {
  const primeira = [];
  let aspas = false;
  for (const ch of texto) {
    if (ch === '"') aspas = !aspas;
    else if (!aspas && (ch === "\n" || ch === "\r")) break;
    else if (!aspas) primeira.push(ch);
  }
  const conta = (s) => primeira.filter((c) => c === s).length;
  const candidatos = [[";", conta(";")], ["\t", conta("\t")], [",", conta(",")]];
  candidatos.sort((a, b) => b[1] - a[1]);
  return candidatos[0][1] > 0 ? candidatos[0][0] : SEPARADOR;
}

/**
 * Lê CSV (RFC 4180: aspas, aspas duplicadas, quebra de linha dentro de aspas).
 * Devolve { cabecalho: string[], linhas: [{ numero, valores: string[] }] } —
 * `numero` é a linha da planilha (cabeçalho = 1), para mensagens de erro.
 * Linhas totalmente vazias são descartadas.
 */
export function lerCsv(texto, separador) {
  const t = String(texto ?? "").replace(/^﻿/, "");
  const sep = separador ?? detectarSeparador(t);
  const registros = [];
  let campo = "";
  let registro = [];
  let aspas = false;
  let linha = 1;
  let inicio = 1;

  const fecharCampo = () => { registro.push(campo); campo = ""; };
  const fecharRegistro = () => {
    fecharCampo();
    registros.push({ numero: inicio, valores: registro });
    registro = [];
  };

  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (aspas) {
      if (ch === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; }
        else aspas = false;
      } else {
        if (ch === "\n") linha++;
        campo += ch;
      }
      continue;
    }
    if (ch === '"' && campo === "") aspas = true;
    else if (ch === sep) fecharCampo();
    else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      fecharRegistro();
      linha++;
      inicio = linha;
    } else campo += ch;
  }
  if (campo !== "" || registro.length) fecharRegistro();

  const naoVazios = registros.filter((r) => r.valores.some((v) => v.trim() !== ""));
  const [cab, ...linhas] = naoVazios;
  return {
    separador: sep,
    cabecalho: (cab?.valores ?? []).map((c) => c.trim()),
    linhas: linhas.map((r) => ({ numero: r.numero, valores: r.valores.map((v) => v.trim()) })),
  };
}

/** "Telefone / WhatsApp" -> "telefone whatsapp": para casar cabeçalhos escritos de jeitos diferentes. */
export const chaveCabecalho = (t) =>
  String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Associa cada campo interno a uma coluna da planilha pelos apelidos aceitos.
 *   mapearColunas(["Nome", "Celular"], { nome: ["nome"], telefone: ["telefone", "celular"] })
 *   -> { nome: 0, telefone: 1 }
 */
export function mapearColunas(cabecalho, apelidos) {
  const chaves = cabecalho.map(chaveCabecalho);
  const mapa = {};
  for (const [campo, nomes] of Object.entries(apelidos)) {
    const i = chaves.findIndex((c) => nomes.includes(c));
    if (i >= 0) mapa[campo] = i;
  }
  return mapa;
}

/* ------------------------------------------------------------------ valores */

/** Número no formato do Excel brasileiro: 1234,5 (sem milhar, para o Excel ler como número). */
export const numeroCsv = (v) => (v === null || v === undefined ? "" : String(Math.round(Number(v) * 100) / 100).replace(".", ","));

/** Data dd/mm/aaaa (ou dd/mm/aaaa hh:mm), no fuso local. */
export function dataCsv(d, comHora = false) {
  if (!d) return "";
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, "0");
  const data = `${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()}`;
  return comHora ? `${data} ${p(x.getHours())}:${p(x.getMinutes())}` : data;
}

/**
 * "25/12/1980", "25/12/80", "1980-12-25" ou número de série do Excel (29580) -> Date (meio-dia local,
 * para não virar o dia anterior em outro fuso). Vazio -> null. Inválido -> undefined.
 */
export function lerData(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  let a, m, d;
  let r;
  if ((r = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s.*)?$/.exec(t))) {
    [d, m, a] = [Number(r[1]), Number(r[2]), Number(r[3])];
    if (a < 100) a += a > (new Date().getFullYear() % 100) ? 1900 : 2000;
  } else if ((r = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t))) {
    [a, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  } else if (/^\d{4,5}$/.test(t)) {
    // data serial do Excel (dias desde 30/12/1899)
    const x = new Date(Date.UTC(1899, 11, 30) + Number(t) * 86400000);
    [a, m, d] = [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()];
  } else return undefined;
  const data = new Date(a, m - 1, d, 12);
  if (data.getFullYear() !== a || data.getMonth() !== m - 1 || data.getDate() !== d) return undefined;
  return data;
}

/** "sim", "s", "x", "1", "true", "yes" -> true; vazio/"não" -> false. */
export const lerSimNao = (t) => /^(s|sim|x|1|true|yes|y|verdadeiro)$/i.test(String(t ?? "").trim());
