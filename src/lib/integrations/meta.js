import { credenciaisMeta } from "../configuracao.js";

/**
 * Provedor oficial Meta: WhatsApp Cloud API + Instagram Messaging.
 * As credenciais vêm de Configurações › Farmácia e integrações (ou das variáveis antigas).
 *
 * Webhook a cadastrar no painel da Meta:
 *   WhatsApp  -> https://SEU_DOMINIO/api/webhooks/whatsapp
 *   Instagram -> https://SEU_DOMINIO/api/webhooks/instagram
 * Token de verificação: gerado pelo CRM e mostrado na tela de configuração
 * Assinatura (recomendado): META_APP_SECRET — valida o header X-Hub-Signature-256.
 *
 * O que este provedor entende:
 *  - TODOS os tipos de mensagem do WhatsApp (texto, imagem, áudio, vídeo, documento,
 *    figurinha, localização, contato, resposta de botão/lista, reação, pedido) —
 *    nada é descartado em silêncio; o que não tem corpo vira uma mensagem descritiva.
 *  - Anexos do Instagram (imagem, vídeo, áudio, arquivo, compartilhamento).
 *  - Eventos de status (enviada/entregue/lida/falhou) para as mensagens de saída.
 *  - Envio de template (única forma de falar com o cliente após 24h sem resposta).
 */
const GRAPH = "https://graph.facebook.com/v21.0";

const TIPO_META = {
  text: "TEXTO",
  image: "IMAGEM",
  audio: "AUDIO",
  video: "VIDEO",
  document: "DOCUMENTO",
  sticker: "FIGURINHA",
  location: "LOCALIZACAO",
  contacts: "CONTATO",
  interactive: "INTERATIVA",
  button: "INTERATIVA",
  reaction: "REACAO",
  order: "PEDIDO",
};

/** Mensagens de erro da API traduzidas para o atendente. */
const ERROS_CONHECIDOS = {
  131047: "Janela de 24h fechada: o cliente não fala com a farmácia há mais de 24h. Use um template aprovado para reabrir a conversa.",
  131026: "Número não recebe mensagens (pode não ter WhatsApp ou bloqueou a farmácia).",
  131030: "Número não está na lista de destinatários permitidos do app em modo de testes.",
  131051: "Tipo de mensagem não suportado pelo WhatsApp.",
  130429: "Limite de envio atingido no momento. Tente novamente em instantes.",
  131056: "Muitas mensagens para o mesmo número em pouco tempo. Aguarde alguns segundos.",
  100: "Requisição inválida para a API da Meta (verifique credenciais e número).",
  190: "Token de acesso inválido ou expirado. Gere um novo token no painel da Meta.",
};

function traduzirErro(json) {
  const e = json?.error;
  if (!e) return "Falha desconhecida na API da Meta.";
  return ERROS_CONHECIDOS[e.code] ?? `${e.message ?? "Erro"} (código ${e.code ?? "?"})`;
}

async function credenciais(canal) {
  const { id, token, wabaId } = await credenciaisMeta(canal);
  if (!id || !token) {
    throw new Error(`${canal === "WHATSAPP" ? "WhatsApp" : "Instagram"} não configurado: o gerente conecta em Configurações › Farmácia e integrações.`);
  }
  return { id, token, wabaId };
}

async function graph(caminho, token, opcoes = {}) {
  const r = await fetch(`${GRAPH}/${caminho}`, { ...opcoes, headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!r) throw new Error("Não foi possível falar com a Meta agora. Tente de novo em instantes.");
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(traduzirErro(json));
  return json;
}

/**
 * Confere as credenciais direto na Meta, sem enviar mensagem. Devolve
 * { rotulo, avisos }: o rótulo que a tela mostra (o número com o nome verificado, ou o @
 * do Instagram) e, no WhatsApp, o que ainda impede a farmácia de atender. Lança Error
 * legível só quando o número ou o token não funcionam.
 */
export async function testarConexaoMeta(canal) {
  const { id, token, wabaId } = await credenciais(canal);
  if (canal !== "WHATSAPP") {
    const json = await graph(`${id}?fields=username,name`, token);
    return { rotulo: json.username ? `@${json.username}` : json.name || id, avisos: [] };
  }
  const json = await graph(`${id}?fields=display_phone_number,verified_name,health_status`, token);
  const rotulo = [json.display_phone_number, json.verified_name].filter(Boolean).join(" · ") || id;
  const inscricao = await inscreverWaba(id, token, wabaId);
  return {
    rotulo: inscricao.ok ? `${rotulo} · recebendo mensagens` : rotulo,
    avisos: [...(inscricao.ok ? [] : [inscricao.aviso]), ...avisosDeSaude(json.health_status)],
  };
}

/**
 * Inscreve a conta de WhatsApp Business (WABA) dona do número no app. Sem isso a Meta
 * só entrega os testes do painel: as mensagens reais dos clientes nunca chegam ao webhook.
 * Usa a WABA informada na tela; sem ela, tenta descobrir pelo próprio token (debug_token),
 * o que nem todo token permite. Nunca lança: devolve { ok } ou { ok: false, aviso }.
 */
export async function inscreverWaba(phoneId, token, wabaId) {
  const falha = (motivo) => ({ ok: false, aviso: `Mensagens dos clientes não vão chegar: ${motivo}` });
  try {
    let waba = wabaId;
    if (waba) {
      const numeros = await graph(`${waba}/phone_numbers?fields=id`, token);
      if (!numeros?.data?.some((n) => n.id === phoneId)) {
        return falha("este número não pertence à conta do WhatsApp Business informada. Confira os dois IDs no painel da Meta.");
      }
    } else {
      const dbg = await graph(`debug_token?input_token=${encodeURIComponent(token)}`, token);
      const wabas = [...new Set(
        (dbg?.data?.granular_scopes ?? [])
          .filter((s) => s.scope === "whatsapp_business_management" || s.scope === "whatsapp_business_messaging")
          .flatMap((s) => s.target_ids ?? []),
      )];
      for (const w of wabas) {
        const numeros = wabas.length === 1 ? null : await graph(`${w}/phone_numbers?fields=id`, token).catch(() => null);
        if (wabas.length === 1 || numeros?.data?.some((n) => n.id === phoneId)) { waba = w; break; }
      }
      if (!waba) return falha("preencha a Identificação da conta do WhatsApp Business (fica ao lado do Phone Number ID no painel da Meta) e teste de novo.");
    }
    await graph(`${waba}/subscribed_apps`, token, { method: "POST" });
    return { ok: true };
  } catch (e) {
    return falha(`a Meta recusou a inscrição do app na conta (${e.message})`);
  }
}

/** Bloqueios que a Meta informa no health_status, traduzidos com o que a farmácia precisa fazer. */
const BLOQUEIOS = {
  141006: "Falta forma de pagamento na conta do WhatsApp Business. No Meta Business Suite: Configurações › Contas do WhatsApp › Pagamentos.",
  141010: "A empresa ainda não foi verificada pela Meta. No Meta Business Suite: Configurações › Central de segurança › Verificação da empresa (pede cartão CNPJ e comprovante de endereço).",
  131000: "Perfil da empresa incompleto na Meta (razão social, país e site). No Meta Business Suite: Configurações › Informações da empresa.",
};

export function avisosDeSaude(saude) {
  if (!saude || saude.can_send_message === "AVAILABLE") return [];
  const erros = (saude.entities ?? []).flatMap((e) => (e.can_send_message === "AVAILABLE" ? [] : e.errors ?? []));
  const codigos = [...new Set(erros.map((e) => e.error_code))].filter((c) => !String(c).startsWith("138")); // 138xxx: chamadas de voz, não afeta mensagens
  const textos = codigos.map((c) => BLOQUEIOS[c] ?? erros.find((e) => e.error_code === c)?.error_description ?? `Bloqueio ${c}`);
  if (!textos.length) return [];
  return [
    "A Meta está bloqueando mensagens iniciadas pela farmácia (templates e conversas com mais de 24h sem resposta do cliente). Responder quem escreveu nas últimas 24h funciona normalmente. Para liberar:",
    ...textos.map((t) => `• ${t}`),
  ];
}

export const provedorMeta = {
  nome: "meta",

  /**
   * Envia texto ou template. `template = { nome, idioma, parametros? }` só no WhatsApp.
   * Lança Error com mensagem legível quando a API recusa.
   */
  async enviar({ canal, destino, texto, template }) {
    const { id, token } = await credenciais(canal);

    if (canal === "WHATSAPP") {
      const corpo = template
        ? {
            messaging_product: "whatsapp",
            to: destino,
            type: "template",
            template: {
              name: template.nome,
              language: { code: template.idioma ?? "pt_BR" },
              ...(template.parametros?.length
                ? { components: [{ type: "body", parameters: template.parametros.map((t) => ({ type: "text", text: String(t) })) }] }
                : {}),
            },
          }
        : { messaging_product: "whatsapp", to: destino, type: "text", text: { body: texto, preview_url: true } };

      const r = await fetch(`${GRAPH}/${id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(traduzirErro(json));
      return { idExterno: json.messages?.[0]?.id };
    }

    const r = await fetch(`${GRAPH}/${id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: destino }, message: { text: texto } }),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(traduzirErro(json));
    return { idExterno: json.message_id };
  },

  /**
   * Baixa uma mídia recebida pelo WhatsApp (o link da Meta expira em minutos,
   * por isso o CRM baixa sob demanda e serve com o mime/nome corretos).
   */
  async baixarMidia({ canal, midiaId, midiaUrl }) {
    const { token } = await credenciais(canal);
    let url = midiaUrl;
    let mime = null;
    let tamanho = null;
    if (canal === "WHATSAPP" || !url) {
      const meta = await fetch(`${GRAPH}/${midiaId}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await meta.json().catch(() => ({}));
      if (!meta.ok) throw new Error(traduzirErro(json));
      url = json.url;
      mime = json.mime_type ?? null;
      tamanho = json.file_size ?? null;
    }
    const r = await fetch(url, { headers: canal === "WHATSAPP" ? { Authorization: `Bearer ${token}` } : {} });
    if (!r.ok) throw new Error(`Download da mídia falhou (${r.status})`);
    return {
      corpo: r.body,
      mime: mime ?? r.headers.get("content-type"),
      tamanho: tamanho ?? (Number(r.headers.get("content-length")) || null),
    };
  },

  /**
   * Converte o payload da Meta em eventos do CRM:
   *   { tipoEvento: "MENSAGEM", canal, contatoExterno, nomeExibicao, texto, tipo, midia, idExterno, enviadoEm }
   *   { tipoEvento: "STATUS",   canal, idExterno, status, erro, em }
   */
  normalizarWebhook(payload, canal) {
    const saida = [];
    for (const entry of payload?.entry ?? []) {
      // --- WhatsApp Cloud API ---
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const perfis = new Map((value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));

        for (const msg of value.messages ?? []) {
          saida.push({
            tipoEvento: "MENSAGEM",
            canal: "WHATSAPP",
            contatoExterno: msg.from,
            nomeExibicao: perfis.get(msg.from) ?? null,
            idExterno: msg.id,
            enviadoEm: msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date(),
            respostaA: msg.context?.id ?? null,
            ...extrairConteudoWhatsApp(msg),
          });
        }

        for (const st of value.statuses ?? []) {
          saida.push({
            tipoEvento: "STATUS",
            canal: "WHATSAPP",
            idExterno: st.id,
            status: { sent: "ENVIADA", delivered: "ENTREGUE", read: "LIDA", failed: "FALHOU" }[st.status] ?? null,
            erro: st.errors?.length ? (ERROS_CONHECIDOS[st.errors[0].code] ?? st.errors[0].title ?? st.errors[0].message) : null,
            em: st.timestamp ? new Date(Number(st.timestamp) * 1000) : new Date(),
          });
        }
      }

      // --- Instagram Messaging ---
      for (const ev of entry.messaging ?? []) {
        if (ev.message && !ev.message.is_echo) {
          saida.push({
            tipoEvento: "MENSAGEM",
            canal: "INSTAGRAM",
            contatoExterno: ev.sender?.id,
            nomeExibicao: ev.sender?.username ?? null,
            idExterno: ev.message.mid,
            enviadoEm: ev.timestamp ? new Date(Number(ev.timestamp)) : new Date(),
            ...extrairConteudoInstagram(ev.message),
          });
        }
        if (ev.read?.mid) {
          saida.push({ tipoEvento: "STATUS", canal: "INSTAGRAM", idExterno: ev.read.mid, status: "LIDA", em: new Date(Number(ev.timestamp ?? Date.now())) });
        }
      }
    }
    return saida.filter((e) => e.tipoEvento === "STATUS" ? e.idExterno && e.status : e.contatoExterno);
  },
};

function extrairConteudoWhatsApp(msg) {
  const tipo = TIPO_META[msg.type] ?? "OUTRO";
  const base = { tipo, texto: "", midia: null };

  switch (msg.type) {
    case "text":
      return { ...base, texto: msg.text?.body ?? "" };
    case "image":
    case "video":
    case "audio":
    case "document":
    case "sticker": {
      const m = msg[msg.type] ?? {};
      return {
        ...base,
        texto: m.caption ?? "",
        midia: {
          id: m.id ?? null,
          mime: m.mime_type ?? null,
          nome: m.filename ?? null,
          tamanho: m.file_size ?? null,
          url: null,
        },
      };
    }
    case "location": {
      const l = msg.location ?? {};
      const rotulo = [l.name, l.address].filter(Boolean).join(" — ");
      return { ...base, texto: rotulo, midia: { id: null, mime: "geo", nome: null, tamanho: null, url: `https://www.google.com/maps?q=${l.latitude},${l.longitude}` } };
    }
    case "contacts": {
      const nomes = (msg.contacts ?? []).map((c) => {
        const tel = c.phones?.[0]?.wa_id ?? c.phones?.[0]?.phone;
        return `${c.name?.formatted_name ?? "contato"}${tel ? ` (${tel})` : ""}`;
      });
      return { ...base, texto: nomes.join(", ") };
    }
    case "interactive": {
      const i = msg.interactive ?? {};
      const escolha = i.button_reply ?? i.list_reply ?? {};
      return { ...base, texto: escolha.title ?? escolha.description ?? "" };
    }
    case "button":
      return { ...base, texto: msg.button?.text ?? "" };
    case "reaction":
      return { ...base, texto: msg.reaction?.emoji ?? "", respostaA: msg.reaction?.message_id ?? null };
    case "order": {
      const itens = (msg.order?.product_items ?? []).map((p) => `${p.quantity}x ${p.product_retailer_id}`);
      return { ...base, texto: `Pedido pelo catálogo: ${itens.join(", ")}` };
    }
    default: {
      // "unsupported" e outros: a Meta manda um array `errors` explicando
      const motivo = msg.errors?.[0]?.title ?? msg.errors?.[0]?.message ?? `tipo "${msg.type}"`;
      return { ...base, tipo: "OUTRO", texto: `Mensagem não suportada pelo WhatsApp (${motivo}). Peça para o cliente reenviar.` };
    }
  }
}

function extrairConteudoInstagram(message) {
  const texto = message.text ?? "";
  const anexo = message.attachments?.[0];
  if (!anexo) return { tipo: "TEXTO", texto, midia: null };
  const tipo = { image: "IMAGEM", video: "VIDEO", audio: "AUDIO", file: "DOCUMENTO", share: "OUTRO", story_mention: "OUTRO", reel: "VIDEO" }[anexo.type] ?? "OUTRO";
  const descricao = { share: "Compartilhou uma publicação", story_mention: "Mencionou a farmácia em um story" }[anexo.type];
  return {
    tipo,
    texto: texto || descricao || "",
    midia: { id: null, mime: null, nome: anexo.payload?.title ?? null, tamanho: null, url: anexo.payload?.url ?? null },
  };
}
