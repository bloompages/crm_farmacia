import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "./db.js";
import { obterProvedor } from "./integrations/index.js";
import { receberMensagem, atualizarStatusMensagem } from "./mensageria.js";

/**
 * Tratamento de webhook resistente a falhas — a raiz dos "erro de sincronização"
 * e "chegou no WhatsApp mas não foi pro CRM":
 *
 *  1. o corpo bruto é gravado em EventoWebhook ANTES de qualquer processamento;
 *  2. cada mensagem do lote é processada isoladamente (uma falha não derruba as outras);
 *  3. a resposta é SEMPRE 200 — a Meta desativa o webhook após falhas seguidas;
 *  4. eventos com erro ficam listados no inbox e podem ser reprocessados
 *     (a deduplicação por idExterno garante que nada fica em dobro).
 */
export async function tratarWebhook(req, canal) {
  const bruto = await req.text();

  if (!assinaturaValida(bruto, req.headers.get("x-hub-signature-256"))) {
    await db.eventoWebhook.create({
      data: { canal, provedor: obterProvedor().nome, payload: bruto.slice(0, 20000), status: "IGNORADO", erro: "Assinatura X-Hub-Signature-256 inválida" },
    });
    return new Response("assinatura inválida", { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(bruto);
  } catch {
    await db.eventoWebhook.create({
      data: { canal, provedor: obterProvedor().nome, payload: bruto.slice(0, 20000), status: "IGNORADO", erro: "Corpo não é JSON" },
    });
    return NextResponse.json({ erro: "json inválido" }, { status: 200 });
  }

  const evento = await db.eventoWebhook.create({
    data: { canal, provedor: obterProvedor().nome, payload: bruto },
  });

  const resultado = await processarEvento(evento.id, payload, canal);
  return NextResponse.json(resultado, { status: 200 });
}

/** Processa (ou reprocessa) um evento gravado. Idempotente graças ao idExterno. */
export async function processarEvento(eventoId, payload, canal) {
  let eventos = [];
  const erros = [];
  const resultados = [];

  try {
    eventos = obterProvedor().normalizarWebhook(payload, canal);
  } catch (e) {
    erros.push(`normalização: ${e?.message ?? e}`);
  }

  for (const ev of eventos) {
    try {
      if (ev.tipoEvento === "STATUS") {
        resultados.push(await atualizarStatusMensagem(ev));
      } else {
        resultados.push(await receberMensagem(ev));
      }
    } catch (e) {
      const ref = ev.idExterno ?? ev.contatoExterno ?? "?";
      erros.push(`${ref}: ${e?.message ?? e}`);
      console.error(`[webhook:${canal}] falha ao processar ${ref}`, e);
    }
  }

  const mensagens = eventos.filter((e) => e.tipoEvento !== "STATUS").length;
  await db.eventoWebhook.update({
    where: { id: eventoId },
    data: {
      status: erros.length ? "ERRO" : mensagens || eventos.length ? "OK" : "IGNORADO",
      mensagens,
      erro: erros.length ? erros.join(" | ").slice(0, 2000) : null,
      tentativas: { increment: 1 },
      processadoEm: new Date(),
    },
  });

  return { eventoId, recebidas: mensagens, resultados, erros };
}

export async function reprocessarEvento(eventoId) {
  const evento = await db.eventoWebhook.findUnique({ where: { id: eventoId } });
  if (!evento) throw new Error("Evento não encontrado");
  let payload;
  try {
    payload = JSON.parse(evento.payload);
  } catch {
    throw new Error("Payload gravado não é JSON válido");
  }
  return processarEvento(evento.id, payload, evento.canal);
}

/** Verificação do webhook exigida pela Meta (GET com hub.challenge). */
export function verificarWebhook(req) {
  const p = new URL(req.url).searchParams;
  if (p.get("hub.verify_token") === (process.env.META_VERIFY_TOKEN || "crm-farmacia-verify")) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("token inválido", { status: 403 });
}

/** Com META_APP_SECRET preenchido, só aceita payloads assinados pela Meta. Sem ele, aceita tudo (dev/mock). */
function assinaturaValida(bruto, header) {
  const segredo = process.env.META_APP_SECRET;
  if (!segredo) return true;
  if (!header?.startsWith("sha256=")) return false;
  const esperado = createHmac("sha256", segredo).update(bruto, "utf8").digest("hex");
  const recebido = header.slice(7);
  if (esperado.length !== recebido.length) return false;
  return timingSafeEqual(Buffer.from(esperado, "hex"), Buffer.from(recebido, "hex"));
}
