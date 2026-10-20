import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { receberMensagem } from "@/lib/mensageria";
import { listarConversas, mensagensDaConversa } from "@/lib/inbox";
import { GET as getTitular, POST as anonimizar } from "@/app/api/leads/[id]/titular/route";
import { criarLead, criarUsuario, params, req } from "./apoio.mjs";

let gerente;
beforeAll(async () => {
  gerente = await criarUsuario("GERENTE");
});

const msg = (extra) => ({ canal: "WHATSAPP", contatoExterno: "552177776666", nomeExibicao: "José Ávila", texto: "Qual o preço da insulina?", ...extra });

describe("ingestão", () => {
  it("contato sem o 9º dígito cai no lead cadastrado à mão", async () => {
    const lead = await criarLead({ nome: "José Ávila", telefone: "5521977776666" });
    const r = await receberMensagem(msg({ idExterno: "wamid.a1" }));
    expect(r.leadId).toBe(lead.id);
  });

  it("mensagem repetida (reenvio da Meta) não duplica", async () => {
    const r = await receberMensagem(msg({ idExterno: "wamid.a1" }));
    expect(r.duplicada).toBe(true);
    expect(await db.mensagem.count({ where: { idExterno: "wamid.a1" } })).toBe(1);
  });
});

describe("inbox", () => {
  it("busca sem acento e lista só com a última mensagem", async () => {
    await receberMensagem(msg({ idExterno: "wamid.a2", texto: "E o orçamento da seringa?" }));
    const [c] = await listarConversas({ q: "jose avila" });
    expect(c.nomeExibicao).toBe("José Ávila");
    expect(c.mensagens).toHaveLength(1);
    expect(c.mensagens[0].texto).toBe("E o orçamento da seringa?");
    expect(await listarConversas({ q: "orcamento da seringa" })).toHaveLength(1);
  });

  it("traz as mensagens MAIS RECENTES e pagina para trás sem pular nenhuma", async () => {
    const conversa = await db.conversa.create({ data: { canal: "WHATSAPP", contatoExterno: "5511900000000" } });
    const mesmoHorario = new Date();
    await db.mensagem.createMany({
      data: Array.from({ length: 130 }, (_, i) => ({ conversaId: conversa.id, direcao: "ENTRADA", texto: `m${i}`, enviadoEm: i < 40 ? mesmoHorario : new Date(mesmoHorario.getTime() + i * 1000) })),
    });
    const p1 = await mensagensDaConversa(conversa.id);
    expect(p1.mensagens).toHaveLength(100);
    expect(p1.mensagens.at(-1).texto).toBe("m129");
    expect(p1.temMais).toBe(true);
    const p2 = await mensagensDaConversa(conversa.id, { antes: p1.mensagens[0].id });
    expect(p2.temMais).toBe(false);
    const todas = new Set([...p1.mensagens, ...p2.mensagens].map((m) => m.texto));
    expect(todas.size).toBe(130);
  });
});

describe("LGPD", () => {
  it("anonimização apaga dados pessoais, conversas e payloads, e mantém o orçamento", async () => {
    await receberMensagem({ canal: "WHATSAPP", contatoExterno: "5531955554444", nomeExibicao: "Titular Teste", texto: "oi", idExterno: "wamid.lgpd" });
    await db.eventoWebhook.create({ data: { canal: "WHATSAPP", provedor: "mock", payload: '{"de":"5531955554444"}', status: "OK" } });
    const lead = await db.lead.findUnique({ where: { telefone: "5531955554444" } });
    const { _max } = await db.orcamento.aggregate({ _max: { numero: true } });
    await db.orcamento.create({ data: { numero: (_max.numero ?? 0) + 1, leadId: lead.id, status: "ACEITO", total: 50 } });

    comoUsuario(gerente.id);
    const exportado = await (await getTitular(req(), params(lead.id))).json();
    expect(exportado.titular.conversas[0].mensagens[0].texto).toBe("oi");

    expect((await anonimizar(req({ confirmacao: "APAGAR" }), params(lead.id))).status).toBe(200);
    const depois = await db.lead.findUnique({ where: { id: lead.id }, include: { conversas: true, orcamentos: true } });
    expect(depois).toMatchObject({ nome: "Titular anonimizado", telefone: null, conversas: [] });
    expect(depois.orcamentos[0].total).toBe(50);
    expect(await db.eventoWebhook.count({ where: { payload: { contains: "5531955554444" } } })).toBe(0);
    expect(await db.auditoria.count({ where: { entidadeId: lead.id, detalhe: { not: null } } })).toBe(0);
  });
});
