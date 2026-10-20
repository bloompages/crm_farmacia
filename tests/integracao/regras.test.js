import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { PATCH as patchLead, DELETE as deleteLead } from "@/app/api/leads/[id]/route";
import { POST as postLead } from "@/app/api/leads/route";
import { POST as postOrcamento } from "@/app/api/orcamentos/route";
import { PATCH as patchOrcamento } from "@/app/api/orcamentos/[id]/route";
import { expirarOrcamentos, esfriarLeads, aplicarRetencao } from "@/lib/manutencao";
import { criarLead, criarOrcamento, criarUsuario, json, params, req } from "./apoio.mjs";

let gerente, atendente;

beforeAll(async () => {
  // garante que a suíte roda no schema descartável, nunca no banco de desenvolvimento
  expect(process.env.DATABASE_URL).toMatch(/[?&]schema=teste/);
  gerente = await criarUsuario("GERENTE");
  atendente = await criarUsuario("ATENDENTE");
});
beforeEach(() => comoUsuario(atendente.id));

describe("autenticação nas rotas", () => {
  it("sem usuário: 401", async () => {
    comoUsuario(null);
    expect((await postLead(req({ nome: "x" }))).status).toBe(401);
  });

  it("excluir lead é só do gerente", async () => {
    const lead = await criarLead();
    expect((await deleteLead(req(), params(lead.id))).status).toBe(403);
    comoUsuario(gerente.id);
    expect((await deleteLead(req(), params(lead.id))).status).toBe(200);
    expect(await db.auditoria.findFirst({ where: { acao: "EXCLUIR_LEAD", entidadeId: lead.id, userId: gerente.id } })).toBeTruthy();
  });

  it("excluir lead com conversa não quebra (conversa é desvinculada)", async () => {
    const lead = await criarLead();
    const conversa = await db.conversa.create({ data: { canal: "WHATSAPP", contatoExterno: `55119${Date.now()}`.slice(0, 13), leadId: lead.id } });
    comoUsuario(gerente.id);
    expect((await deleteLead(req(), params(lead.id))).status).toBe(200);
    expect((await db.conversa.findUnique({ where: { id: conversa.id } })).leadId).toBeNull();
  });
});

describe("lead", () => {
  it("cadastro normaliza o telefone, grava o responsável e barra duplicado", async () => {
    const a = await json(await postLead(req({ nome: "Maria Conceição", telefone: "(21) 98888-1111" })));
    expect(a.corpo).toMatchObject({ telefone: "5521988881111", responsavelId: atendente.id, busca: "maria conceicao" });
    const b = await json(await postLead(req({ nome: "Outra", telefone: "552188881111" })));
    expect(b.status).toBe(409);
    expect(b.corpo.leadId).toBe(a.corpo.id);
  });

  it("perdido exige motivo e rejeita os orçamentos em aberto com ele", async () => {
    const lead = await criarLead({ etapa: "ORCAMENTO" });
    const o1 = await criarOrcamento(lead.id);
    const o2 = await criarOrcamento(lead.id, { status: "RASCUNHO" });

    expect((await patchLead(req({ etapa: "PERDIDO" }), params(lead.id))).status).toBe(400);
    expect((await patchLead(req({ etapa: "PERDIDO", motivoPerda: "INVENTADO" }), params(lead.id))).status).toBe(400);

    const r = await patchLead(req({ etapa: "PERDIDO", motivoPerda: "PRECO" }), params(lead.id));
    expect(r.status).toBe(200);
    for (const o of [o1, o2]) {
      expect(await db.orcamento.findUnique({ where: { id: o.id } })).toMatchObject({ status: "REJEITADO", motivoRejeicao: "PRECO" });
    }
    const atividade = await db.atividade.findFirst({ where: { leadId: lead.id, tipo: "ETAPA" } });
    expect(atividade.autorId).toBe(atendente.id);
  });

  it("consentimento guarda a data", async () => {
    const lead = await criarLead();
    await patchLead(req({ consentimentoMarketing: true }), params(lead.id));
    const depois = await db.lead.findUnique({ where: { id: lead.id } });
    expect(depois.consentimentoMarketing).toBe(true);
    expect(depois.consentimentoEm).toBeInstanceOf(Date);
  });
});

describe("orçamento", () => {
  it("rejeição exige motivo válido; o último rejeitado leva o lead a perdido", async () => {
    const lead = await criarLead({ etapa: "ORCAMENTO" });
    const o = await criarOrcamento(lead.id);
    expect((await patchOrcamento(req({ status: "REJEITADO" }), params(o.id))).status).toBe(400);
    expect((await patchOrcamento(req({ status: "QUALQUER" }), params(o.id))).status).toBe(400);
    expect((await patchOrcamento(req({ status: "REJEITADO", motivoRejeicao: "CONCORRENCIA", precoConcorrente: "89.999" }), params(o.id))).status).toBe(200);
    expect(await db.orcamento.findUnique({ where: { id: o.id } })).toMatchObject({ precoConcorrente: 90 });
    expect(await db.lead.findUnique({ where: { id: lead.id } })).toMatchObject({ etapa: "PERDIDO", motivoPerda: "CONCORRENCIA" });
  });

  it("criados ao mesmo tempo recebem números diferentes", async () => {
    const lead = await criarLead();
    const corpo = { leadId: lead.id, itens: [{ descricao: "Dipirona", quantidade: 3, precoUnit: 0.1 }] };
    const respostas = await Promise.all(Array.from({ length: 6 }, () => postOrcamento(req(corpo)).then(json)));
    expect(respostas.every((r) => r.status === 200)).toBe(true);
    expect(new Set(respostas.map((r) => r.corpo.numero)).size).toBe(6);
    expect(respostas[0].corpo.total).toBe(0.3);
    expect(respostas[0].corpo.responsavelId).toBe(atendente.id);
  });

  it("validade no passado é recusada", async () => {
    const lead = await criarLead();
    const r = await postOrcamento(req({ leadId: lead.id, itens: [{ descricao: "x", precoUnit: 1 }], validadeEm: "2020-01-01" }));
    expect(r.status).toBe(400);
  });
});

describe("manutenção", () => {
  it("expira orçamento vencido", async () => {
    const lead = await criarLead();
    const o = await criarOrcamento(lead.id, { validadeEm: new Date(Date.now() - 60000) });
    await expirarOrcamentos();
    expect((await db.orcamento.findUnique({ where: { id: o.id } })).status).toBe("EXPIRADO");
  });

  it("esfria o score sem acumular (rodar duas vezes dá o mesmo)", async () => {
    const lead = await criarLead({ score: 80, scoreBase: 80, scoreEm: new Date(Date.now() - 60 * 86400000), temperatura: "QUENTE" });
    await esfriarLeads();
    await esfriarLeads();
    expect(await db.lead.findUnique({ where: { id: lead.id } })).toMatchObject({ score: 20, temperatura: "FRIO" });
  });

  it("apaga payload de webhook antigo e mantém o recente", async () => {
    const velho = await db.eventoWebhook.create({ data: { canal: "WHATSAPP", provedor: "mock", payload: "{}", status: "OK", recebidoEm: new Date(Date.now() - 40 * 86400000) } });
    const novo = await db.eventoWebhook.create({ data: { canal: "WHATSAPP", provedor: "mock", payload: "{}", status: "OK" } });
    await aplicarRetencao();
    expect(await db.eventoWebhook.findUnique({ where: { id: velho.id } })).toBeNull();
    expect(await db.eventoWebhook.findUnique({ where: { id: novo.id } })).toBeTruthy();
  });
});
