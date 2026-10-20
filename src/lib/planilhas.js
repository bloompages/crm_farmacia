import { db } from "./db.js";
import { ETAPAS, MOTIVOS_REJEICAO, ORIGENS, labelEtapa, labelMotivo } from "./constantes.js";
import { gerarCsv, lerCsv, mapearColunas, chaveCabecalho, numeroCsv, dataCsv, lerData, lerSimNao } from "./csv.js";
import { normalizarTelefone, formatarTelefone } from "./telefone.js";
import { buscaLead, paraBusca } from "./busca.js";
import { etiquetasParaTexto, listaEtiquetas } from "./etiquetas.js";
import { lerValorBR } from "./conversa.js";

/**
 * Importação e exportação em planilha (CSV do Excel). As colunas exportadas são
 * as mesmas que a importação reconhece: dá para exportar, ajustar no Excel e
 * importar de volta.
 */

export const LIMITE_LINHAS = 5000;
export const LIMITE_BYTES = 3 * 1024 * 1024;
/** Cada lote de 200 linhas é uma transação; num banco na nuvem 200 inserções passam dos 5 s padrão do Prisma. */
const TX_LOTE = { timeout: 60000, maxWait: 15000 };

const simNao = (v) => (v ? "sim" : "não");

/* ====================================================================== exportação */

const COLUNAS_LEAD = [
  { titulo: "Nome", valor: (l) => l.nome },
  { titulo: "Telefone", valor: (l) => formatarTelefone(l.telefone) ?? "" },
  { titulo: "E-mail", valor: (l) => l.email },
  { titulo: "CPF/CNPJ", valor: (l) => l.documento },
  { titulo: "Tipo", valor: (l) => l.tipo },
  { titulo: "Empresa", valor: (l) => l.empresa },
  { titulo: "Origem", valor: (l) => l.origem.toLowerCase() },
  { titulo: "Etapa", valor: (l) => labelEtapa(l.etapa) },
  { titulo: "Motivo da perda", valor: (l) => (l.motivoPerda ? labelMotivo(l.motivoPerda) : "") },
  { titulo: "Temperatura", valor: (l) => l.temperatura.toLowerCase() },
  { titulo: "Score", valor: (l) => l.score },
  { titulo: "Etiquetas", valor: (l) => listaEtiquetas(l.etiquetas).join(", ") },
  { titulo: "Interesses", valor: (l) => l.interesses },
  { titulo: "Aniversário", valor: (l) => dataCsv(l.dataNascimento) },
  { titulo: "Convênio", valor: (l) => l.convenio },
  { titulo: "Responsável", valor: (l) => l.responsavel?.nome },
  { titulo: "Consentimento marketing", valor: (l) => simNao(l.consentimentoMarketing) },
  { titulo: "Valor aprovado", valor: (l) => numeroCsv(l.valorAprovado) },
  { titulo: "Primeiro contato", valor: (l) => dataCsv(l.primeiroContatoEm, true) },
  { titulo: "Último contato", valor: (l) => dataCsv(l.ultimoContatoEm, true) },
  { titulo: "Observações", valor: (l) => l.observacoes },
];

const COLUNAS_ORCAMENTO = [
  { titulo: "Número", valor: (o) => o.numero },
  { titulo: "Criado em", valor: (o) => dataCsv(o.createdAt, true) },
  { titulo: "Cliente", valor: (o) => o.lead?.nome },
  { titulo: "Telefone", valor: (o) => formatarTelefone(o.lead?.telefone) ?? "" },
  { titulo: "Status", valor: (o) => o.status.toLowerCase() },
  { titulo: "Itens", valor: (o) => o.itens.map((i) => `${i.quantidade}x ${i.descricao}`).join(" | ") },
  { titulo: "Desconto", valor: (o) => numeroCsv(o.desconto) },
  { titulo: "Total", valor: (o) => numeroCsv(o.total) },
  { titulo: "Validade", valor: (o) => dataCsv(o.validadeEm) },
  { titulo: "Enviado em", valor: (o) => dataCsv(o.enviadoEm, true) },
  { titulo: "Fechado em", valor: (o) => dataCsv(o.fechadoEm, true) },
  { titulo: "Motivo da rejeição", valor: (o) => (o.motivoRejeicao ? labelMotivo(o.motivoRejeicao) : "") },
  { titulo: "Detalhe da rejeição", valor: (o) => o.detalheRejeicao },
  { titulo: "Concorrente", valor: (o) => o.concorrente },
  { titulo: "Preço do concorrente", valor: (o) => numeroCsv(o.precoConcorrente) },
  { titulo: "Responsável", valor: (o) => o.responsavel?.nome },
];

const COLUNAS_PRODUTO = [
  { titulo: "Nome", valor: (p) => p.nome },
  { titulo: "Categoria", valor: (p) => p.categoria },
  { titulo: "Preço", valor: (p) => numeroCsv(p.preco) },
  { titulo: "Ativo", valor: (p) => simNao(p.ativo) },
];

export const EXPORTACOES = {
  leads: {
    titulo: "Leads / contatos",
    arquivo: "leads",
    async gerar(where = {}) {
      const leads = await db.lead.findMany({
        where: { ...where, anonimizadoEm: null },
        orderBy: { createdAt: "asc" },
        include: { responsavel: { select: { nome: true } } },
      });
      return { csv: gerarCsv(COLUNAS_LEAD, leads), total: leads.length };
    },
  },
  orcamentos: {
    titulo: "Orçamentos",
    arquivo: "orcamentos",
    async gerar(where = {}) {
      const orcamentos = await db.orcamento.findMany({
        where,
        orderBy: { numero: "asc" },
        include: { itens: true, lead: { select: { nome: true, telefone: true } }, responsavel: { select: { nome: true } } },
      });
      return { csv: gerarCsv(COLUNAS_ORCAMENTO, orcamentos), total: orcamentos.length };
    },
  },
  produtos: {
    titulo: "Catálogo de produtos",
    arquivo: "produtos",
    async gerar() {
      const produtos = await db.produto.findMany({ orderBy: [{ categoria: "asc" }, { nome: "asc" }] });
      return { csv: gerarCsv(COLUNAS_PRODUTO, produtos), total: produtos.length };
    },
  },
};

/* ====================================================================== importação */

/** Cabeçalhos aceitos (comparados sem acento, caixa e pontuação — ver chaveCabecalho). */
export const APELIDOS_LEAD = {
  nome: ["nome", "nome completo", "cliente", "contato", "razao social", "name"],
  telefone: ["telefone", "whatsapp", "celular", "fone", "tel", "telefone whatsapp", "whatsapp telefone", "phone"],
  email: ["e mail", "email"],
  documento: ["cpf cnpj", "cpf", "cnpj", "documento"],
  tipo: ["tipo", "pf pj"],
  empresa: ["empresa"],
  origem: ["origem", "canal"],
  etapa: ["etapa", "etapa do funil", "fase"],
  motivoPerda: ["motivo da perda", "motivo perda"],
  etiquetas: ["etiquetas", "etiqueta", "tags", "tag"],
  interesses: ["interesses", "interesse"],
  dataNascimento: ["aniversario", "data de nascimento", "nascimento", "data nascimento"],
  convenio: ["convenio", "plano", "plano de saude"],
  responsavel: ["responsavel", "atendente", "vendedor"],
  consentimento: ["consentimento marketing", "consentimento", "aceita contato", "autoriza contato"],
  observacoes: ["observacoes", "observacao", "obs", "notas"],
};

export const APELIDOS_PRODUTO = {
  nome: ["nome", "produto", "descricao"],
  categoria: ["categoria"],
  preco: ["preco", "valor", "preco r", "preco de venda"],
  ativo: ["ativo"],
};

const CATEGORIAS = ["Medicamento", "Manipulado", "Dermocosmético", "Suplemento", "Perfumaria"];

const porChave = (lista, rotulo) => {
  const k = chaveCabecalho(rotulo);
  return lista.find((x) => [x.id, x.label].some((v) => chaveCabecalho(v) === k));
};

/** Resultado vazio de uma importação; `amostra` são as primeiras linhas já interpretadas. */
const novoResultado = (colunas) => ({ total: 0, novos: 0, atualizados: 0, ignorados: 0, erros: [], avisos: [], amostra: [], colunas });

function lerPlanilha(texto, apelidos, obrigatorio) {
  if (!texto?.trim()) return { erro: "arquivo vazio" };
  if (texto.length > LIMITE_BYTES) return { erro: `arquivo grande demais (máximo ${LIMITE_BYTES / 1024 / 1024} MB)` };
  const { cabecalho, linhas } = lerCsv(texto);
  const mapa = mapearColunas(cabecalho, apelidos);
  if (mapa[obrigatorio] === undefined) {
    return { erro: `coluna "${obrigatorio}" não encontrada no cabeçalho (colunas lidas: ${cabecalho.join(", ") || "nenhuma"})` };
  }
  if (linhas.length > LIMITE_LINHAS) return { erro: `máximo de ${LIMITE_LINHAS} linhas por arquivo (este tem ${linhas.length})` };
  const usadas = new Set(Object.values(mapa));
  const colunas = {
    reconhecidas: Object.entries(mapa).map(([campo, i]) => ({ campo, coluna: cabecalho[i] })),
    ignoradas: cabecalho.filter((c, i) => c && !usadas.has(i)),
  };
  const valor = (l, campo) => (mapa[campo] === undefined ? undefined : l.valores[mapa[campo]] ?? "");
  return { linhas, colunas, valor };
}

/**
 * Converte uma linha da planilha nos dados do lead. Campo ausente na planilha = undefined
 * (não mexe no lead existente); presente e vazio = "" / null.
 * @returns {{ dados?, erro?, avisos: string[] }}
 */
export function interpretarLinhaLead(valor, { usuarios = [] } = {}) {
  const avisos = [];
  const txt = (campo) => {
    const v = valor(campo);
    return v === undefined ? undefined : v.trim() || null;
  };

  const nome = txt("nome");
  if (!nome) return { erro: "nome vazio", avisos };

  const dados = { nome };
  const telBruto = txt("telefone");
  if (telBruto !== undefined) {
    dados.telefone = normalizarTelefone(telBruto);
    if (telBruto && (!dados.telefone || dados.telefone.length < 10)) return { erro: `telefone inválido: ${telBruto}`, avisos };
  }
  for (const campo of ["email", "documento", "empresa", "convenio", "observacoes"]) {
    const v = txt(campo);
    if (v !== undefined) dados[campo] = v;
  }
  if (dados.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) return { erro: `e-mail inválido: ${dados.email}`, avisos };
  if (txt("interesses") !== undefined) dados.interesses = txt("interesses") ?? "";
  if (txt("etiquetas") !== undefined) dados.etiquetas = etiquetasParaTexto(txt("etiquetas"));

  const tipo = txt("tipo");
  if (tipo !== undefined) dados.tipo = /^(pj|pessoa juridica|juridica|empresa)$/.test(chaveCabecalho(tipo)) ? "PJ" : "PF";
  else if ((dados.documento ?? "").replace(/\D/g, "").length === 14) dados.tipo = "PJ";

  const origem = txt("origem");
  if (origem) {
    const o = ORIGENS.find((x) => chaveCabecalho(x) === chaveCabecalho(origem));
    if (o) dados.origem = o;
    else { dados.origem = "MANUAL"; avisos.push(`origem "${origem}" não existe no CRM — gravada como manual`); }
  }

  const etapa = txt("etapa");
  if (etapa) {
    const e = porChave(ETAPAS, etapa) ?? (chaveCabecalho(etapa).startsWith("orcamento") ? ETAPAS[1] : null);
    if (!e) return { erro: `etapa desconhecida: ${etapa} (use ${ETAPAS.map((x) => x.label).join(", ")})`, avisos };
    dados.etapa = e.id;
    if (e.id === "PERDIDO") {
      // nenhuma perda entra no CRM sem motivo — a mesma regra das telas
      const m = txt("motivoPerda") && porChave(MOTIVOS_REJEICAO, txt("motivoPerda"));
      if (!m) return { erro: "lead perdido precisa de \"Motivo da perda\" válido", avisos };
      dados.motivoPerda = m.id;
    }
  }

  const nasc = txt("dataNascimento");
  if (nasc !== undefined) {
    const d = lerData(nasc);
    if (d === undefined) return { erro: `aniversário inválido: ${nasc} (use dd/mm/aaaa)`, avisos };
    dados.dataNascimento = d;
  }

  const resp = txt("responsavel");
  if (resp) {
    const k = paraBusca(resp);
    const u = usuarios.find((x) => paraBusca(x.nome) === k || x.email.toLowerCase() === resp.toLowerCase());
    if (u) dados.responsavelId = u.id;
    else avisos.push(`responsável "${resp}" não é usuário ativo — lead fica sem responsável`);
  }

  const cons = txt("consentimento");
  if (cons !== undefined) dados.consentimentoMarketing = lerSimNao(cons);

  return { dados, avisos };
}

/**
 * Importa leads de um CSV.
 *   gravar=false  só simula (mostra o que vai acontecer)
 *   atualizar     telefone/e-mail já cadastrado: completa a ficha existente em vez de ignorar
 * Ao atualizar, só os campos com valor na planilha mudam; etiquetas são somadas; etapa e
 * telefone do lead existente nunca mudam por planilha (etapa tem regras de orçamento).
 */
export async function importarLeads(texto, { gravar = false, atualizar = false, usuario, arquivo = "planilha" } = {}) {
  const lido = lerPlanilha(texto, APELIDOS_LEAD, "nome");
  if (lido.erro) return { erro: lido.erro };
  const r = novoResultado(lido.colunas);
  const usuarios = await db.user.findMany({ where: { ativo: true }, select: { id: true, nome: true, email: true } });

  const validas = [];
  const vistosTel = new Map();
  const vistosEmail = new Map();
  for (const l of lido.linhas) {
    r.total++;
    const { dados, erro, avisos } = interpretarLinhaLead((campo) => lido.valor(l, campo), { usuarios });
    for (const a of avisos) r.avisos.push({ linha: l.numero, motivo: a });
    if (erro) { r.erros.push({ linha: l.numero, motivo: erro }); continue; }
    const email = dados.email?.toLowerCase();
    const repetida = (dados.telefone && vistosTel.get(dados.telefone)) || (!dados.telefone && email && vistosEmail.get(email));
    if (repetida) { r.erros.push({ linha: l.numero, motivo: `contato repetido na planilha (mesmo da linha ${repetida})` }); continue; }
    if (dados.telefone) vistosTel.set(dados.telefone, l.numero);
    if (email) vistosEmail.set(email, l.numero);
    validas.push({ linha: l.numero, dados });
  }

  // quem já está no CRM: pelo telefone canônico ou, sem telefone, pelo e-mail
  const tels = validas.map((v) => v.dados.telefone).filter(Boolean);
  const emails = validas.filter((v) => !v.dados.telefone && v.dados.email).map((v) => v.dados.email);
  const existentes = [];
  for (let i = 0; i < tels.length; i += 500) existentes.push(...(await db.lead.findMany({ where: { telefone: { in: tels.slice(i, i + 500) } } })));
  for (let i = 0; i < emails.length; i += 500) existentes.push(...(await db.lead.findMany({ where: { email: { in: emails.slice(i, i + 500) } } })));
  const porTel = new Map(existentes.filter((e) => e.telefone).map((e) => [e.telefone, e]));
  const porEmail = new Map(existentes.filter((e) => e.email).map((e) => [e.email.toLowerCase(), e]));

  const criar = [];
  const alterar = [];
  for (const v of validas) {
    const existente = v.dados.telefone ? porTel.get(v.dados.telefone) : porEmail.get(v.dados.email?.toLowerCase());
    const acao = !existente ? "novo" : existente.anonimizadoEm ? "anonimizado" : atualizar ? "atualizar" : "ignorar";
    if (r.amostra.length < 10) r.amostra.push({ linha: v.linha, acao, nome: v.dados.nome, telefone: formatarTelefone(v.dados.telefone) ?? "", etapa: labelEtapa(v.dados.etapa ?? existente?.etapa ?? "NOVO"), etiquetas: v.dados.etiquetas ?? "" });
    if (acao === "anonimizado") {
      r.erros.push({ linha: v.linha, motivo: "contato pertence a um titular que pediu a exclusão dos dados (LGPD) — não reimportado" });
    } else if (acao === "novo") {
      r.novos++;
      criar.push(v);
    } else if (acao === "atualizar") {
      r.atualizados++;
      alterar.push({ ...v, existente });
    } else r.ignorados++;
  }

  if (!gravar) return r;

  const agora = new Date();
  const nota = `Importado da planilha "${String(arquivo).slice(0, 80)}" por ${usuario?.nome ?? "—"}.`;
  for (let i = 0; i < criar.length; i += 200) {
    await db.$transaction(async (tx) => {
      for (const { dados } of criar.slice(i, i + 200)) {
        const { consentimentoMarketing, ...resto } = dados;
        const lead = await tx.lead.create({
          data: {
            ...resto,
            origem: dados.origem ?? "MANUAL",
            busca: buscaLead(dados),
            ...(consentimentoMarketing ? { consentimentoMarketing: true, consentimentoEm: agora } : {}),
          },
        });
        await tx.atividade.create({ data: { leadId: lead.id, tipo: "NOTA", autorId: usuario?.id ?? null, descricao: nota } });
      }
    }, TX_LOTE);
  }
  for (let i = 0; i < alterar.length; i += 200) {
    await db.$transaction(async (tx) => {
      for (const { dados, existente } of alterar.slice(i, i + 200)) {
        const { etapa, motivoPerda, telefone, consentimentoMarketing, etiquetas, ...resto } = dados;
        const data = Object.fromEntries(Object.entries(resto).filter(([, v]) => v !== null && v !== undefined && v !== ""));
        if (etiquetas) data.etiquetas = etiquetasParaTexto([...listaEtiquetas(existente.etiquetas), ...listaEtiquetas(etiquetas)]);
        if (consentimentoMarketing !== undefined && consentimentoMarketing !== existente.consentimentoMarketing) {
          data.consentimentoMarketing = consentimentoMarketing;
          data.consentimentoEm = agora;
        }
        data.busca = buscaLead({ ...existente, ...data });
        await tx.lead.update({ where: { id: existente.id }, data });
        await tx.atividade.create({ data: { leadId: existente.id, tipo: "NOTA", autorId: usuario?.id ?? null, descricao: `Ficha atualizada pela planilha "${String(arquivo).slice(0, 80)}".` } });
      }
    }, TX_LOTE);
  }
  return r;
}

/** Importa/atualiza o catálogo de produtos. O produto é identificado pelo nome (sem diferenciar acento/caixa). */
export async function importarProdutos(texto, { gravar = false, atualizar = true } = {}) {
  const lido = lerPlanilha(texto, APELIDOS_PRODUTO, "nome");
  if (lido.erro) return { erro: lido.erro };
  if (!lido.colunas.reconhecidas.some((c) => c.campo === "preco")) return { erro: 'coluna "preço" não encontrada no cabeçalho' };
  const r = novoResultado(lido.colunas);

  const atuais = await db.produto.findMany();
  const porNome = new Map(atuais.map((p) => [paraBusca(p.nome), p]));
  const vistos = new Map();
  const ops = [];

  for (const l of lido.linhas) {
    r.total++;
    const nome = lido.valor(l, "nome")?.trim();
    if (!nome) { r.erros.push({ linha: l.numero, motivo: "nome vazio" }); continue; }
    const preco = lerValorBR(lido.valor(l, "preco"));
    if (preco === null || preco < 0) { r.erros.push({ linha: l.numero, motivo: `preço inválido: ${lido.valor(l, "preco") || "(vazio)"}` }); continue; }
    const k = paraBusca(nome);
    if (vistos.has(k)) { r.erros.push({ linha: l.numero, motivo: `produto repetido na planilha (mesmo da linha ${vistos.get(k)})` }); continue; }
    vistos.set(k, l.numero);

    const catBruta = lido.valor(l, "categoria")?.trim();
    let categoria;
    if (catBruta) {
      categoria = CATEGORIAS.find((c) => paraBusca(c) === paraBusca(catBruta));
      if (!categoria) { categoria = catBruta.slice(0, 40); r.avisos.push({ linha: l.numero, motivo: `categoria nova: ${categoria}` }); }
    }
    const ativoBruto = lido.valor(l, "ativo");
    const dados = { nome, preco, ...(categoria ? { categoria } : {}), ...(ativoBruto?.trim() ? { ativo: lerSimNao(ativoBruto) } : {}) };
    const existente = porNome.get(k);
    const acao = !existente ? "novo" : atualizar ? "atualizar" : "ignorar";
    if (r.amostra.length < 10) r.amostra.push({ linha: l.numero, acao, nome, preco: numeroCsv(preco), categoria: categoria ?? existente?.categoria ?? "Medicamento" });
    if (acao === "novo") { r.novos++; ops.push(() => db.produto.create({ data: dados })); }
    else if (acao === "atualizar") { r.atualizados++; ops.push(() => db.produto.update({ where: { id: existente.id }, data: dados })); }
    else r.ignorados++;
  }

  if (gravar && ops.length) await db.$transaction(ops.map((op) => op()));
  return r;
}

export const IMPORTACOES = {
  leads: { titulo: "Leads / contatos", importar: importarLeads, colunas: COLUNAS_LEAD },
  produtos: { titulo: "Catálogo de produtos", importar: importarProdutos, colunas: COLUNAS_PRODUTO },
};

/** Planilha modelo: cabeçalho igual ao da exportação + uma linha de exemplo. */
export function modeloCsv(tipo) {
  if (tipo === "produtos") {
    return gerarCsv(COLUNAS_PRODUTO, [{ nome: "Dipirona 1g 20cp", categoria: "Medicamento", preco: 12.4, ativo: true }]);
  }
  const exemplo = {
    nome: "Maria Souza", telefone: "5511987654321", email: "maria@email.com", documento: "", tipo: "PF", empresa: "",
    origem: "WHATSAPP", etapa: "NOVO", motivoPerda: null, temperatura: "FRIO", score: 0, etiquetas: "recompra mensal,vip",
    interesses: "dermocosméticos", dataNascimento: new Date(1985, 4, 20, 12), convenio: "Unimed", responsavel: null,
    consentimentoMarketing: true, valorAprovado: null, primeiroContatoEm: null, ultimoContatoEm: null, observacoes: "",
  };
  // colunas calculadas pelo CRM não fazem sentido na planilha de entrada
  const calculadas = new Set(["Temperatura", "Score", "Valor aprovado", "Primeiro contato", "Último contato"]);
  return gerarCsv(COLUNAS_LEAD.filter((c) => !calculadas.has(c.titulo)), [exemplo]);
}
