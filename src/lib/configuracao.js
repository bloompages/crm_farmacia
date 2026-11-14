import { randomBytes } from "node:crypto";
import { db } from "./db.js";
import { cifrar, decifrar, criptografiaDisponivel } from "./cripto.js";

/**
 * Configuração da instalação: dados da farmácia e integrações com a Meta.
 *
 * Cada farmácia tem a própria instância do CRM, e o gerente preenche tudo pela tela
 * /configuracoes/farmacia, sem mexer na Vercel. Para manter a compatibilidade, as
 * variáveis antigas (WHATSAPP_TOKEN, PRIVACIDADE_* etc.) ainda valem quando o campo
 * correspondente está vazio no banco. O valor do banco sempre tem prioridade.
 *
 * Continuam só na Vercel, porque são da instalação e não da farmácia:
 *   DATABASE_URL, CHAVE_CRIPTOGRAFIA, META_APP_SECRET (do app da Meta do fornecedor).
 */

const producao = () => process.env.NODE_ENV === "production";
const env = (k) => process.env[k]?.trim() || null;

const CACHE_MS = 30_000;
let cache = null; // { valor, em }

export function limparCacheConfiguracao() {
  cache = null;
}

/**
 * Linha única de configuração (criada na primeira leitura, já com o token de verificação).
 * Fica 30s em memória; chamadas simultâneas na mesma página compartilham a mesma consulta.
 */
export async function obterConfiguracao() {
  if (cache && Date.now() - cache.em < CACHE_MS) return cache.valor;
  const promessa = carregarConfiguracao();
  cache = { valor: promessa, em: Date.now() };
  try {
    return await promessa;
  } catch (e) {
    if (cache?.valor === promessa) cache = null; // não guarda a falha
    throw e;
  }
}

async function carregarConfiguracao() {
  const cfg = await db.configuracao.findUnique({ where: { id: "unica" } });
  if (!cfg) return db.configuracao.upsert({ where: { id: "unica" }, create: { id: "unica", metaVerifyToken: novoTokenVerificacao() }, update: {} });
  if (!cfg.metaVerifyToken) return db.configuracao.update({ where: { id: "unica" }, data: { metaVerifyToken: novoTokenVerificacao() } });
  return cfg;
}

const novoTokenVerificacao = () => randomBytes(18).toString("base64url");

/* ------------------------------------------------------------ leitura */

/** Credenciais da Meta para o canal: banco primeiro, variável de ambiente depois. */
export function credenciaisDe(cfg, canal) {
  if (canal === "WHATSAPP") {
    return {
      id: cfg?.whatsappPhoneNumberId || env("WHATSAPP_PHONE_NUMBER_ID"),
      token: decifrar(cfg?.whatsappToken) || env("WHATSAPP_TOKEN"),
      wabaId: cfg?.whatsappWabaId || env("WHATSAPP_WABA_ID"),
    };
  }
  return {
    id: cfg?.instagramAccountId || env("INSTAGRAM_ACCOUNT_ID"),
    token: decifrar(cfg?.instagramToken) || env("INSTAGRAM_TOKEN"),
  };
}

export async function credenciaisMeta(canal) {
  return credenciaisDe(await obterConfiguracao(), canal);
}

const temCredenciais = (c) => Boolean(c.id && c.token);

/**
 * mock (simulador) ou meta. PROVEDOR_MENSAGERIA, se definida, manda (é o jeito de forçar
 * o simulador no desenvolvimento). Sem ela, usa a Meta assim que houver WhatsApp ou
 * Instagram configurado.
 */
export function nomeProvedorDe(cfg) {
  const forcado = env("PROVEDOR_MENSAGERIA")?.toLowerCase();
  if (forcado === "meta" || forcado === "mock") return forcado;
  return temCredenciais(credenciaisDe(cfg, "WHATSAPP")) || temCredenciais(credenciaisDe(cfg, "INSTAGRAM")) ? "meta" : "mock";
}

/** Tokens aceitos na verificação do webhook (GET da Meta). */
export function tokensVerificacaoDe(cfg) {
  const lista = [cfg?.metaVerifyToken, env("META_VERIFY_TOKEN")].filter(Boolean);
  if (!lista.length && !producao()) lista.push("crm-farmacia-verify");
  return lista;
}

/** Dados da farmácia para a política de privacidade e o cabeçalho. */
export function dadosFarmaciaDe(cfg) {
  return {
    nomeFantasia: cfg?.nomeFantasia || null,
    nome: cfg?.razaoSocial || cfg?.nomeFantasia || env("PRIVACIDADE_CONTROLADOR"),
    cnpj: cfg?.cnpj || env("PRIVACIDADE_CNPJ"),
    endereco: cfg?.endereco || env("PRIVACIDADE_ENDERECO"),
    email: cfg?.emailPrivacidade || env("PRIVACIDADE_EMAIL"),
    telefone: cfg?.telefone || env("PRIVACIDADE_TELEFONE"),
  };
}

/**
 * Nome exibido no menu, no login e na aba do navegador: o nome fantasia que a farmácia
 * cadastra na tela. NOME_PADRAO só aparece enquanto ele não foi preenchido.
 */
export const NOME_PADRAO = "CRM";

export async function nomeExibicao() {
  try {
    const cfg = await obterConfiguracao();
    return cfg.nomeFantasia || cfg.razaoSocial || NOME_PADRAO;
  } catch {
    return NOME_PADRAO; // banco fora do ar não pode derrubar o título da página
  }
}

export const templateReaberturaDe = (cfg) => cfg?.whatsappTemplateReabertura || env("WHATSAPP_TEMPLATE_REABERTURA");

const mascarar = (token) => (token ? `••••${token.slice(-4)}` : null);

/** O que a tela de configuração pode ver: os tokens nunca saem inteiros do servidor. */
export function configuracaoPublica(cfg) {
  const wa = credenciaisDe(cfg, "WHATSAPP");
  const ig = credenciaisDe(cfg, "INSTAGRAM");
  const tokenIlegivel = (campo) => Boolean(cfg?.[campo]) && !decifrar(cfg[campo]);
  return {
    nomeFantasia: cfg.nomeFantasia ?? "",
    razaoSocial: cfg.razaoSocial ?? "",
    cnpj: cfg.cnpj ?? "",
    endereco: cfg.endereco ?? "",
    emailPrivacidade: cfg.emailPrivacidade ?? "",
    telefone: cfg.telefone ?? "",
    whatsappPhoneNumberId: cfg.whatsappPhoneNumberId ?? "",
    whatsappWabaId: cfg.whatsappWabaId ?? "",
    whatsappTemplateReabertura: cfg.whatsappTemplateReabertura ?? "",
    whatsappToken: mascarar(decifrar(cfg.whatsappToken)),
    whatsappTokenIlegivel: tokenIlegivel("whatsappToken"),
    whatsappDaVercel: !cfg.whatsappPhoneNumberId && temCredenciais(wa),
    whatsappNumeroExibicao: cfg.whatsappNumeroExibicao ?? null,
    whatsappTestadoEm: cfg.whatsappTestadoEm ?? null,
    instagramAccountId: cfg.instagramAccountId ?? "",
    instagramToken: mascarar(decifrar(cfg.instagramToken)),
    instagramTokenIlegivel: tokenIlegivel("instagramToken"),
    instagramDaVercel: !cfg.instagramAccountId && temCredenciais(ig),
    instagramUsuario: cfg.instagramUsuario ?? null,
    instagramTestadoEm: cfg.instagramTestadoEm ?? null,
    metaVerifyToken: cfg.metaVerifyToken,
    provedor: nomeProvedorDe(cfg),
    criptografiaDisponivel: criptografiaDisponivel(),
  };
}

/* ------------------------------------------------------------ gravação */

const TEXTOS = { nomeFantasia: 120, razaoSocial: 160, endereco: 300, telefone: 40 };
const TOKENS = ["whatsappToken", "instagramToken"];

/**
 * Valida o que veio da tela. Campo ausente = não mexe; texto vazio = apaga.
 * Token: vazio = mantém o atual (a tela nunca recebe o token de volta); para apagar,
 * mande o nome do campo em `remover`.
 */
export function validarConfiguracao(entrada = {}) {
  const dados = {};
  const erros = [];
  const tem = (k) => Object.prototype.hasOwnProperty.call(entrada, k);
  const texto = (k) => String(entrada[k] ?? "").replace(/\s+/g, " ").trim();

  for (const [k, max] of Object.entries(TEXTOS)) {
    if (!tem(k)) continue;
    const v = texto(k);
    if (v.length > max) erros.push(`${k}: no máximo ${max} caracteres`);
    dados[k] = v || null;
  }

  if (tem("cnpj")) {
    const digitos = texto("cnpj").replace(/\D/g, "");
    if (digitos && !cnpjValido(digitos)) erros.push("CNPJ inválido");
    dados.cnpj = digitos ? digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : null;
  }

  if (tem("emailPrivacidade")) {
    const v = texto("emailPrivacidade").toLowerCase();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) erros.push("e-mail inválido");
    dados.emailPrivacidade = v || null;
  }

  const NOMES_ID = {
    whatsappPhoneNumberId: "Identificação do número de telefone",
    whatsappWabaId: "Identificação da conta do WhatsApp Business",
    instagramAccountId: "ID da conta do Instagram",
  };
  for (const [k, nome] of Object.entries(NOMES_ID)) {
    if (!tem(k)) continue;
    const v = texto(k).replace(/\s/g, "");
    if (v && !/^\d{5,25}$/.test(v)) erros.push(`${nome}: só números (copie do painel da Meta)`);
    dados[k] = v || null;
  }

  if (tem("whatsappTemplateReabertura")) {
    const v = texto("whatsappTemplateReabertura");
    if (v && !/^[a-z0-9_]{1,512}$/.test(v)) erros.push("nome do template: só letras minúsculas, números e _ (igual ao cadastrado na Meta)");
    dados.whatsappTemplateReabertura = v || null;
  }

  for (const k of TOKENS) {
    const v = texto(k).replace(/^Bearer\s+/i, "").replace(/\s/g, "");
    if (v) {
      if (v.length < 20) erros.push(`${k === "whatsappToken" ? "token do WhatsApp" : "token do Instagram"} curto demais: copie o token inteiro`);
      dados[k] = v; // cifrado em salvarConfiguracao
    }
  }
  for (const k of Array.isArray(entrada.remover) ? entrada.remover : []) {
    if (TOKENS.includes(k)) dados[k] = null;
  }

  return { dados, erros };
}

export function cnpjValido(digitos) {
  if (!/^\d{14}$/.test(digitos) || /^(\d)\1+$/.test(digitos)) return false;
  const dv = (base) => {
    let soma = 0;
    let peso = base.length - 7;
    for (const d of base) {
      soma += Number(d) * peso--;
      if (peso < 2) peso = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(digitos.slice(0, 12));
  const d2 = dv(digitos.slice(0, 12) + d1);
  return digitos.endsWith(`${d1}${d2}`);
}

/** Grava o que mudou. Devolve { cfg, alterados } ou lança Error com a lista de problemas. */
export async function salvarConfiguracao(entrada) {
  const { dados, erros } = validarConfiguracao(entrada);
  if (erros.length) throw Object.assign(new Error(erros.join("; ")), { validacao: true });

  const atual = await obterConfiguracao();
  const alterados = Object.keys(dados).filter((k) => (TOKENS.includes(k) ? true : (atual[k] ?? null) !== dados[k]));
  const gravar = Object.fromEntries(alterados.map((k) => [k, dados[k]]));
  for (const k of TOKENS) if (gravar[k]) gravar[k] = cifrar(gravar[k]);

  // trocar o número, a conta ou o token invalida o último "Testar conexão"
  if (["whatsappPhoneNumberId", "whatsappWabaId", "whatsappToken"].some((k) => alterados.includes(k))) Object.assign(gravar, { whatsappNumeroExibicao: null, whatsappTestadoEm: null });
  if (alterados.includes("instagramAccountId") || alterados.includes("instagramToken")) Object.assign(gravar, { instagramUsuario: null, instagramTestadoEm: null });

  if (!Object.keys(gravar).length) return { cfg: atual, alterados };
  const cfg = await db.configuracao.update({ where: { id: "unica" }, data: gravar });
  limparCacheConfiguracao();
  return { cfg, alterados };
}

/** Grava o resultado do "Testar conexão". */
export async function registrarTeste(canal, rotulo) {
  const data = canal === "WHATSAPP"
    ? { whatsappNumeroExibicao: rotulo, whatsappTestadoEm: new Date() }
    : { instagramUsuario: rotulo, instagramTestadoEm: new Date() };
  await db.configuracao.update({ where: { id: "unica" }, data });
  limparCacheConfiguracao();
}

/* ------------------------------------------------------------ diagnóstico */

/** Problemas exibidos na barra de sincronização do inbox. */
export async function alertasConfiguracao() {
  const cfg = await obterConfiguracao();
  const provedor = nomeProvedorDe(cfg);
  if (!producao() && provedor === "mock") return [];
  const alertas = [];
  if (provedor === "mock") {
    alertas.push(
      env("PROVEDOR_MENSAGERIA") === "mock"
        ? "PROVEDOR_MENSAGERIA=mock na Vercel: as mensagens não estão indo para o WhatsApp. Apague essa variável."
        : "WhatsApp ainda não conectado. O gerente configura em Configurações › Farmácia e integrações."
    );
  }
  if (!env("META_APP_SECRET")) {
    alertas.push(producao() ? "META_APP_SECRET ausente na Vercel: webhooks estão sendo recusados" : "META_APP_SECRET ausente: webhooks aceitos sem assinatura");
  }
  if (producao() && !criptografiaDisponivel()) alertas.push("CHAVE_CRIPTOGRAFIA ausente na Vercel: não é possível salvar tokens pela tela");
  if ((cfg.whatsappToken && !decifrar(cfg.whatsappToken)) || (cfg.instagramToken && !decifrar(cfg.instagramToken))) {
    alertas.push("Um token salvo não pode ser lido (a CHAVE_CRIPTOGRAFIA mudou?). Cadastre o token de novo em Configurações.");
  }
  return alertas;
}

/**
 * Roteiro de implantação mostrado ao gerente: o que falta para a farmácia
 * começar a atender pelo CRM.
 */
export async function etapasImplantacao() {
  const cfg = await obterConfiguracao();
  const f = dadosFarmaciaDe(cfg);
  const [webhookMeta, usuarios] = await Promise.all([
    db.eventoWebhook.findFirst({ where: { provedor: "meta", status: { in: ["OK", "IGNORADO"] }, erro: null }, orderBy: { recebidoEm: "desc" }, select: { recebidoEm: true } }),
    db.user.count({ where: { ativo: true } }),
  ]);
  const wa = credenciaisDe(cfg, "WHATSAPP");
  const etapas = [
    { id: "dados", titulo: "Dados da farmácia", feito: Boolean(f.nome && f.cnpj && f.email), dica: "Razão social, CNPJ e e-mail aparecem na política de privacidade." },
    { id: "whatsapp", titulo: "WhatsApp conectado", feito: Boolean(temCredenciais(wa) && (cfg.whatsappTestadoEm || !cfg.whatsappPhoneNumberId)), dica: "Cole a identificação do número, a da conta do WhatsApp Business e o token, e clique em Testar conexão." },
    { id: "webhook", titulo: "Mensagens chegando no CRM", feito: Boolean(webhookMeta), dica: "Cadastre a URL do webhook na Meta e mande uma mensagem de teste para o número." },
    { id: "template", titulo: "Template de reabertura", feito: Boolean(templateReaberturaDe(cfg)), dica: "Permite voltar a falar com o cliente depois de 24h sem resposta." },
    { id: "equipe", titulo: "Equipe cadastrada", feito: usuarios > 1, dica: "Crie um usuário para cada atendente em Equipe e LGPD." },
  ];
  return { etapas, feitas: etapas.filter((e) => e.feito).length, total: etapas.length };
}
