import { db } from "./db.js";
import { obterProvedor } from "./integrations/index.js";
import { analisarIntencao, temperaturaPorScore, scoreEsfriado, CORTE_OPORTUNIDADE } from "./intencao.js";
import { normalizarTelefone } from "./telefone.js";
import { paraBusca, buscaLead, buscaConversa } from "./busca.js";
import { descreverMensagem, janela24h } from "./conversa.js";
import { normalizarTexto } from "./formatacao.js";
import { alertasConfiguracao } from "./configuracao.js";

/**
 * Ingestão de mensagem recebida (qualquer tipo: texto, mídia, botão, localização…):
 *  1. acha/cria a conversa do canal
 *  2. classifica a intenção comercial (pelo texto/legenda)
 *  3. identifica um NOVO LEAD quando o contato ainda não existe no CRM
 *  4. atualiza score/temperatura do lead e registra a atividade
 *  5. reabre a janela de 24h da conversa
 */
export async function receberMensagem(msg) {
  const canal = msg.canal === "INSTAGRAM" ? "INSTAGRAM" : "WHATSAPP";
  const contato = String(msg.contatoExterno);
  const texto = normalizarTexto(msg.texto ?? "");
  const tipo = msg.tipo ?? "TEXTO";
  const { intencao, score } = analisarIntencao(texto);

  // Dedup ANTES de mexer em qualquer coisa: a Meta reenvia webhooks quando não recebe 200.
  if (msg.idExterno) {
    const existente = await db.mensagem.findUnique({ where: { idExterno: msg.idExterno }, select: { conversaId: true } });
    if (existente) return { duplicada: true, conversaId: existente.conversaId };
  }

  let conversa = await db.conversa.findUnique({
    where: { canal_contatoExterno: { canal, contatoExterno: contato } },
    include: { lead: true },
  });

  let leadCriado = false;

  if (!conversa) {
    const lead = await identificarLead({ canal, contato, nome: msg.nomeExibicao, score });
    leadCriado = true;
    conversa = await db.conversa.create({
      data: {
        canal,
        contatoExterno: contato,
        nomeExibicao: msg.nomeExibicao ?? contato,
        busca: buscaConversa({ nomeExibicao: msg.nomeExibicao ?? contato, contatoExterno: contato }),
        leadId: lead.id,
      },
      include: { lead: true },
    });
  }

  const enviadoEm = msg.enviadoEm ?? new Date();
  const gravada = await db.mensagem.create({
    data: {
      conversaId: conversa.id,
      direcao: "ENTRADA",
      tipo,
      texto,
      textoBusca: paraBusca(texto),
      status: "RECEBIDA",
      idExterno: msg.idExterno ?? null,
      intencao,
      scoreIntencao: score,
      midiaId: msg.midia?.id ?? null,
      midiaMime: msg.midia?.mime ?? null,
      midiaNome: msg.midia?.nome ?? null,
      midiaTamanho: msg.midia?.tamanho ?? null,
      midiaUrl: msg.midia?.url ?? null,
      enviadoEm,
    },
  });

  await db.conversa.update({
    where: { id: conversa.id },
    data: {
      naoLidas: { increment: 1 },
      ultimaMsgEm: enviadoEm,
      // a janela de 24h conta a partir da última mensagem DO CLIENTE
      ultimaMsgClienteEm: enviadoEm,
      status: "ABERTA",
      nomeExibicao: conversa.nomeExibicao ?? msg.nomeExibicao ?? contato,
    },
  });

  if (conversa.leadId) {
    const lead = await db.lead.findUnique({ where: { id: conversa.leadId } });
    // soma ao score de hoje (já esfriado), não ao de semanas atrás
    const atual = lead ? scoreEsfriado(lead.scoreBase, lead.scoreEm) : 0;
    const novoScore = Math.min(100, atual + Math.round(score / 2));
    await db.lead.update({
      where: { id: conversa.leadId },
      data: {
        score: novoScore,
        scoreBase: novoScore,
        scoreEm: new Date(),
        temperatura: temperaturaPorScore(novoScore),
        ultimoContatoEm: enviadoEm,
      },
    });

    await db.atividade.create({
      data: {
        leadId: conversa.leadId,
        tipo: "MENSAGEM",
        descricao: `[${canal}] ${descreverMensagem(gravada).slice(0, 160)}${score >= CORTE_OPORTUNIDADE ? ` — sinal de ${intencao.toLowerCase()} (score ${score})` : ""}`,
      },
    });
  }

  return {
    duplicada: false,
    conversaId: conversa.id,
    mensagemId: gravada.id,
    leadId: conversa.leadId,
    leadCriado,
    tipo,
    intencao,
    score,
    oportunidade: score >= CORTE_OPORTUNIDADE,
  };
}

/** Atualiza o status de uma mensagem enviada (entregue / lida / falhou) a partir do webhook. */
export async function atualizarStatusMensagem({ idExterno, status, erro }) {
  if (!idExterno || !status) return { ignorado: true };
  const atual = await db.mensagem.findUnique({ where: { idExterno }, select: { id: true, status: true } });
  if (!atual) return { ignorado: true, motivo: "mensagem desconhecida" };
  // nunca regride (LIDA não volta para ENTREGUE se os eventos chegarem fora de ordem)
  const ordem = ["ENVIANDO", "ENVIADA", "ENTREGUE", "LIDA"];
  if (status !== "FALHOU" && ordem.indexOf(status) < ordem.indexOf(atual.status)) return { ignorado: true, motivo: "status anterior" };
  await db.mensagem.update({ where: { id: atual.id }, data: { status, erro: status === "FALHOU" ? erro ?? "Falha na entrega" : null } });
  return { atualizado: true, id: atual.id, status };
}

/** Cria o lead a partir de um contato novo — o "radar" de novos leads. */
async function identificarLead({ canal, contato, nome, score }) {
  // o wa_id pode vir sem o 9º dígito; o lead guarda a forma canônica (cadastro manual cai no mesmo registro)
  const telefone = canal === "WHATSAPP" ? normalizarTelefone(`+${contato}`) : null; // wa_id sempre traz o DDI
  if (telefone) {
    const existente = await db.lead.findUnique({ where: { telefone } });
    if (existente) return existente;
  }
  const nomeLead = nome || (canal === "INSTAGRAM" ? `@${contato}` : contato);
  const lead = await db.lead.create({
    data: {
      nome: nomeLead,
      busca: buscaLead({ nome: nomeLead }),
      telefone,
      origem: canal,
      etapa: "NOVO",
      score,
      scoreBase: score,
      temperatura: temperaturaPorScore(score),
    },
  });
  await db.atividade.create({
    data: {
      leadId: lead.id,
      tipo: "NOTA",
      descricao: `Lead identificado automaticamente pelo canal ${canal}.`,
    },
  });
  return lead;
}

/**
 * Envia resposta pelo canal da conversa e registra no histórico.
 * A mensagem é gravada ANTES de chamar o provedor (status ENVIANDO); se o envio
 * falhar ela fica como FALHOU com o motivo — nunca desaparece — e pode ser reenviada.
 */
export async function enviarMensagem({ conversaId, texto, template, autorId = null }) {
  const conversa = await db.conversa.findUnique({ where: { id: conversaId } });
  if (!conversa) throw new Error("Conversa não encontrada");

  const corpo = template ? `Template "${template.nome}" enviado para reabrir a conversa.` : normalizarTexto(texto);
  const mensagem = await db.mensagem.create({
    data: { conversaId, direcao: "SAIDA", tipo: template ? "TEMPLATE" : "TEXTO", texto: corpo, textoBusca: paraBusca(corpo), status: "ENVIANDO", autorId },
  });
  return despachar(mensagem, conversa, template);
}

/** Tenta de novo uma mensagem que ficou como FALHOU. */
export async function reenviarMensagem(mensagemId) {
  const mensagem = await db.mensagem.findUnique({ where: { id: mensagemId }, include: { conversa: true } });
  if (!mensagem || mensagem.direcao !== "SAIDA") throw new Error("Mensagem não encontrada");
  await db.mensagem.update({ where: { id: mensagemId }, data: { status: "ENVIANDO", erro: null } });
  return despachar(mensagem, mensagem.conversa, null);
}

async function despachar(mensagem, conversa, template) {
  const provedor = obterProvedor();
  const janela = janela24h(conversa);

  // Aviso antecipado: fora da janela o WhatsApp só aceita template. Ainda assim tentamos —
  // se a API recusar, o motivo fica registrado na mensagem.
  let idExterno = null;
  let erro = null;
  try {
    ({ idExterno } = await provedor.enviar({
      canal: conversa.canal,
      destino: conversa.contatoExterno,
      texto: mensagem.texto,
      template,
    }));
  } catch (e) {
    erro = e?.message || "Falha ao enviar";
    if (!janela.aberta && conversa.canal === "WHATSAPP" && !template && !/24h/.test(erro)) {
      erro += " (a janela de 24h desta conversa está fechada)";
    }
  }

  const atualizada = await db.mensagem.update({
    where: { id: mensagem.id },
    data: {
      status: erro ? "FALHOU" : "ENVIADA",
      erro,
      idExterno: idExterno ?? mensagem.idExterno ?? null,
      enviadoEm: new Date(),
    },
  });

  await db.conversa.update({
    where: { id: conversa.id },
    data: { naoLidas: 0, ultimaMsgEm: new Date(), status: erro ? conversa.status : "AGUARDANDO" },
  });

  if (!erro && conversa.leadId) {
    await db.lead.update({ where: { id: conversa.leadId }, data: { ultimoContatoEm: new Date() } });
    // quem responde primeiro um lead sem dono assume o atendimento
    if (mensagem.autorId) {
      await db.lead.updateMany({ where: { id: conversa.leadId, responsavelId: null }, data: { responsavelId: mensagem.autorId } });
    }
  }
  return atualizada;
}

/** Diagnóstico de sincronização exibido no inbox. */
export async function saudeSincronizacao() {
  const ha24h = new Date(Date.now() - 24 * 3600 * 1000);
  const [ultimoEvento, errosEventos, mensagensFalhas, ultimaRecebida] = await Promise.all([
    db.eventoWebhook.findFirst({ orderBy: { recebidoEm: "desc" }, select: { recebidoEm: true, status: true } }),
    db.eventoWebhook.count({ where: { status: "ERRO" } }),
    db.mensagem.count({ where: { direcao: "SAIDA", status: "FALHOU", enviadoEm: { gte: ha24h } } }),
    db.mensagem.findFirst({ where: { direcao: "ENTRADA" }, orderBy: { enviadoEm: "desc" }, select: { enviadoEm: true } }),
  ]);
  return {
    provedor: obterProvedor().nome,
    ultimoWebhookEm: ultimoEvento?.recebidoEm ?? null,
    ultimaRecebidaEm: ultimaRecebida?.enviadoEm ?? null,
    eventosComErro: errosEventos,
    alertas: alertasConfiguracao(),
    mensagensFalhas,
    agora: new Date(),
  };
}
