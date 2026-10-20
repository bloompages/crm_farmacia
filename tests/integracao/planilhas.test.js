import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { GET as exportar } from "@/app/api/exportar/[tipo]/route";
import { POST as importar } from "@/app/api/importar/[tipo]/route";
import { PATCH as patchConversa } from "@/app/api/conversas/[id]/route";
import { PATCH as patchEtiquetas } from "@/app/api/etiquetas/route";
import { PATCH as patchLead } from "@/app/api/leads/[id]/route";
import { POST as postRapida } from "@/app/api/mensagens-rapidas/route";
import { lerCsv } from "@/lib/csv";
import { filtroEtiqueta } from "@/lib/etiquetas";
import { criarLead, criarUsuario, json, req } from "./apoio.mjs";

let gerente, atendente;
const tipo = (t) => ({ params: Promise.resolve({ tipo: t }) });
const id = (v) => ({ params: Promise.resolve({ id: v }) });
const sufixo = () => String(Date.now()).slice(-6) + String(Math.floor(Math.random() * 90 + 10));

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toMatch(/[?&]schema=teste/);
  gerente = await criarUsuario("GERENTE");
  atendente = await criarUsuario("ATENDENTE");
});
beforeEach(() => comoUsuario(gerente.id));

describe("importação de leads", () => {
  it("é só do gerente", async () => {
    comoUsuario(atendente.id);
    expect((await importar(req({ conteudo: "Nome\nA" }), tipo("leads"))).status).toBe(403);
    expect((await exportar(new Request("http://t/api/exportar/leads"), tipo("leads"))).status).toBe(403);
  });

  it("simula sem gravar, depois grava; acusa erros por linha", async () => {
    const s = sufixo();
    const conteudo = [
      "Nome;Celular;E-mail;Etiquetas;Aniversário;Convênio;Etapa;Coluna estranha",
      `Paula ${s};(11) 9${s.slice(0, 4)}-${s.slice(4, 8)};paula${s}@x.com;VIP, Recompra;20/05/1985;Unimed;Novo lead;?`,
      `;11 98888-0000;;;;;;`,
      `Rui ${s};abc;;;;;;`,
      `Duplicada ${s};(11) 9${s.slice(0, 4)}-${s.slice(4, 8)};;;;;;`,
      `Lia ${s};;;;31/02/1990;;;`,
      `Téo ${s};;teo${s}@x.com;;;;Perdido;`,
    ].join("\r\n");

    const sim = await json(await importar(req({ conteudo, arquivo: "contatos.csv" }), tipo("leads")));
    expect(sim.status).toBe(200);
    expect(sim.corpo).toMatchObject({ total: 6, novos: 1, gravado: false });
    expect(sim.corpo.erros.map((e) => e.linha)).toEqual([3, 4, 5, 6, 7]);
    expect(sim.corpo.colunas.ignoradas).toEqual(["Coluna estranha"]);
    expect(await db.lead.count({ where: { nome: `Paula ${s}` } })).toBe(0);

    const gravado = await json(await importar(req({ conteudo, arquivo: "contatos.csv", gravar: true }), tipo("leads")));
    expect(gravado.corpo).toMatchObject({ novos: 1, gravado: true });
    const paula = await db.lead.findFirst({ where: { nome: `Paula ${s}` }, include: { atividades: true } });
    expect(paula).toMatchObject({ telefone: `55119${s.slice(0, 8)}`, etiquetas: "vip,recompra", convenio: "Unimed", etapa: "NOVO", busca: expect.stringContaining("paula") });
    expect(paula.dataNascimento.getFullYear()).toBe(1985);
    expect(paula.atividades[0].descricao).toContain("contatos.csv");
    expect(await db.auditoria.findFirst({ where: { acao: "IMPORTAR_CSV", userId: gerente.id } })).toBeTruthy();
  });

  it("contato existente: ignora por padrão; com atualizar completa a ficha sem mudar etapa", async () => {
    const s = sufixo();
    const tel = `55119${s.slice(0, 8)}`;
    const lead = await criarLead({ nome: `Velho ${s}`, telefone: tel, etapa: "ORCAMENTO", etiquetas: "pj" });
    const conteudo = `Nome;Telefone;Etiquetas;Convênio;Etapa\nNovo Nome ${s};${tel};vip;Amil;Aprovado`;

    const ign = await json(await importar(req({ conteudo, gravar: true }), tipo("leads")));
    expect(ign.corpo).toMatchObject({ novos: 0, ignorados: 1 });
    expect((await db.lead.findUnique({ where: { id: lead.id } })).convenio).toBeNull();

    const atu = await json(await importar(req({ conteudo, gravar: true, atualizar: true }), tipo("leads")));
    expect(atu.corpo).toMatchObject({ atualizados: 1 });
    const depois = await db.lead.findUnique({ where: { id: lead.id } });
    expect(depois).toMatchObject({ nome: `Novo Nome ${s}`, convenio: "Amil", etiquetas: "pj,vip", etapa: "ORCAMENTO" });
  });

  it("não reimporta titular anonimizado (LGPD)", async () => {
    const s = sufixo();
    const tel = `55119${s.slice(0, 8)}`;
    await criarLead({ nome: "Titular anonimizado", telefone: tel, anonimizadoEm: new Date() });
    const r = await json(await importar(req({ conteudo: `Nome;Telefone\nVolta ${s};${tel}`, gravar: true, atualizar: true }), tipo("leads")));
    expect(r.corpo.erros[0].motivo).toMatch(/LGPD/);
    expect(await db.lead.count({ where: { nome: `Volta ${s}` } })).toBe(0);
  });

  it("sem coluna Nome: erro geral", async () => {
    const r = await json(await importar(req({ conteudo: "Telefone\n11999999999" }), tipo("leads")));
    expect(r.status).toBe(400);
    expect(r.corpo.erro).toMatch(/nome/);
  });
});

describe("exportação", () => {
  it("leads saem em CSV com filtro de etiqueta, auditado", async () => {
    const s = sufixo();
    await criarLead({ nome: `Exp ${s}`, etiquetas: `exp${s},vip`, busca: `exp ${s}` });
    await criarLead({ nome: `Exp2 ${s}`, etiquetas: `exp${s}x`, busca: `exp2 ${s}` });
    const r = await exportar(new Request(`http://t/api/exportar/leads?etiqueta=exp${s}`), tipo("leads"));
    expect(r.headers.get("content-type")).toContain("text/csv");
    expect(r.headers.get("content-disposition")).toMatch(/leads-\d{4}-\d{2}-\d{2}\.csv/);
    const { cabecalho, linhas } = lerCsv(await r.text());
    expect(cabecalho).toContain("Etiquetas");
    expect(linhas.map((l) => l.valores[0])).toEqual([`Exp ${s}`]);
    expect(await db.auditoria.findFirst({ where: { acao: "EXPORTAR_CSV", detalhe: { contains: `exp${s}` } } })).toBeTruthy();
  });

  it("produtos: exporta e importa de volta atualizando o preço", async () => {
    const s = sufixo();
    await db.produto.create({ data: { nome: `Dipirona ${s}`, preco: 10 } });
    const csv = await (await exportar(new Request("http://t/api/exportar/produtos"), tipo("produtos"))).text();
    const editado = csv.replace(new RegExp(`(Dipirona ${s};Medicamento;)10`), "$112,9");
    const r = await json(await importar(req({ conteudo: editado, gravar: true, atualizar: true }), tipo("produtos")));
    expect(r.corpo.erros).toEqual([]);
    expect((await db.produto.findFirst({ where: { nome: `Dipirona ${s}` } })).preco).toBe(12.9);
  });
});

describe("etiquetas e conversas", () => {
  it("filtro de etiqueta é exato e renomear junta as duas", async () => {
    const s = sufixo();
    const a = await criarLead({ nome: "A", etiquetas: `a${s},b${s}` });
    await criarLead({ nome: "B", etiquetas: `a${s}x` });
    expect(await db.lead.count({ where: filtroEtiqueta(`a${s}`) })).toBe(1);
    comoUsuario(atendente.id);
    expect((await patchEtiquetas(req({ de: `a${s}`, para: `b${s}` }))).status).toBe(403);
    comoUsuario(gerente.id);
    await patchEtiquetas(req({ de: `a${s}`, para: `b${s}` }));
    expect((await db.lead.findUnique({ where: { id: a.id } })).etiquetas).toBe(`b${s}`);
  });

  it("PATCH do lead grava etiquetas normalizadas, aniversário e convênio", async () => {
    comoUsuario(atendente.id);
    const lead = await criarLead();
    const r = await json(await patchLead(req({ etiquetas: ["VIP", "vip", " Uso contínuo "], dataNascimento: "1990-07-15", convenio: " SulAmérica " }), id(lead.id)));
    expect(r.corpo).toMatchObject({ etiquetas: "vip,uso contínuo", convenio: "SulAmérica" });
    expect((await json(await patchLead(req({ dataNascimento: "99/99/1990" }), id(lead.id)))).status).toBe(400);
  });

  it("resolver e reabrir conversa; mensagem nova do cliente reabre sozinha", async () => {
    comoUsuario(atendente.id);
    const lead = await criarLead();
    const c = await db.conversa.create({ data: { canal: "WHATSAPP", contatoExterno: `5511${sufixo()}`, leadId: lead.id, naoLidas: 3 } });
    expect((await json(await patchConversa(req({ status: "FECHADA" }), id(c.id)))).corpo).toMatchObject({ status: "FECHADA", naoLidas: 0 });
    expect((await patchConversa(req({ status: "LIXO" }), id(c.id))).status).toBe(400);
    const { receberMensagem } = await import("@/lib/mensageria");
    await receberMensagem({ canal: "WHATSAPP", contatoExterno: c.contatoExterno, texto: "oi de novo" });
    expect((await db.conversa.findUnique({ where: { id: c.id } })).status).toBe("ABERTA");
  });

  it("mensagem rápida: atalho normalizado e sem repetição", async () => {
    const s = sufixo();
    const r = await json(await postRapida(req({ atalho: `/Pix ${s}`, texto: "chave" })));
    expect(r.corpo.atalho).toBe(`pix-${s}`);
    expect((await postRapida(req({ atalho: `pix-${s}`, texto: "outra" }))).status).toBe(409);
  });
});
