/**
 * Ajuste único de dados gravados antes das correções de consistência:
 *  - telefones dos leads na forma canônica (só dígitos, DDI, 9º dígito no celular);
 *    quando dois leads caem no mesmo número, nada é alterado e o par é listado para mesclar à mão;
 *  - score base do esfriamento (scoreBase/scoreEm) a partir do score e do último contato;
 *  - validades gravadas como meia-noite UTC passam a valer até o fim do dia local;
 *  - colunas de busca sem acento (lead, conversa, mensagem) preenchidas.
 *
 *   npm run db:ajustar            mostra o que mudaria
 *   npm run db:ajustar -- --gravar
 */
import { PrismaClient } from "@prisma/client";
import { normalizarTelefone } from "../src/lib/telefone.js";
import { paraBusca, buscaLead, buscaConversa } from "../src/lib/busca.js";

const db = new PrismaClient();
const gravar = process.argv.includes("--gravar");

const leads = await db.lead.findMany({ select: { id: true, nome: true, empresa: true, email: true, busca: true, telefone: true, score: true, scoreBase: true, ultimoContatoEm: true } });

// telefones
const porTelefone = new Map(leads.filter((l) => l.telefone).map((l) => [l.telefone, l]));
const telefones = [];
const conflitos = [];
for (const l of leads) {
  const canonico = normalizarTelefone(l.telefone);
  if (!l.telefone || canonico === l.telefone) continue;
  const dono = porTelefone.get(canonico);
  if (dono && dono.id !== l.id) {
    conflitos.push([l, dono]);
    continue;
  }
  porTelefone.delete(l.telefone);
  porTelefone.set(canonico, l);
  telefones.push({ id: l.id, de: l.telefone, para: canonico });
}

// score base
const scores = leads.filter((l) => l.score > 0 && l.scoreBase === 0);

// validades à meia-noite UTC (vindas do <input type="date"> antes da correção)
const validades = (await db.orcamento.findMany({ where: { validadeEm: { not: null } }, select: { id: true, validadeEm: true } }))
  .filter((o) => o.validadeEm.toISOString().endsWith("T00:00:00.000Z"));

// colunas de busca
const buscaLeads = leads.filter((l) => !l.busca && buscaLead(l));
const buscaConversas = (await db.conversa.findMany({ where: { busca: "" }, select: { id: true, nomeExibicao: true, contatoExterno: true } }));
const buscaMensagens = await db.mensagem.count({ where: { textoBusca: "", texto: { not: "" } } });

console.log(`Telefones a normalizar: ${telefones.length}`);
for (const t of telefones) console.log(`  ${t.de} → ${t.para}`);
console.log(`Leads com score sem base: ${scores.length}`);
console.log(`Validades a mover para o fim do dia: ${validades.length}`);
console.log(`Colunas de busca a preencher: ${buscaLeads.length} lead(s), ${buscaConversas.length} conversa(s), ${buscaMensagens} mensagem(ns)`);
const semSenha = await db.user.findMany({ where: { senhaHash: null, ativo: true }, select: { email: true } });
if (semSenha.length) {
  console.log(`\n⚠ ${semSenha.length} usuário(s) sem senha não conseguem entrar. Defina com:`);
  for (const u of semSenha) console.log(`  npm run usuario:criar -- --email ${u.email} [--gerente]`);
}
if (conflitos.length) {
  console.log(`\n⚠ ${conflitos.length} lead(s) duplicado(s) pelo telefone — mescle manualmente:`);
  for (const [a, b] of conflitos) console.log(`  "${a.nome}" (${a.id}, ${a.telefone}) = "${b.nome}" (${b.id}, ${b.telefone})`);
}

if (!gravar) {
  console.log("\nNada foi gravado. Rode com --gravar para aplicar.");
} else {
  await db.$transaction([
    ...telefones.map((t) => db.lead.update({ where: { id: t.id }, data: { telefone: t.para } })),
    ...scores.map((l) => db.lead.update({ where: { id: l.id }, data: { scoreBase: l.score, scoreEm: l.ultimoContatoEm } })),
    ...validades.map((o) => {
      const [a, m, d] = o.validadeEm.toISOString().slice(0, 10).split("-").map(Number);
      return db.orcamento.update({ where: { id: o.id }, data: { validadeEm: new Date(a, m - 1, d, 23, 59, 59, 999) } });
    }),
  ]);
  await db.$transaction([
    ...buscaLeads.map((l) => db.lead.update({ where: { id: l.id }, data: { busca: buscaLead(l) } })),
    ...buscaConversas.map((c) => db.conversa.update({ where: { id: c.id }, data: { busca: buscaConversa(c) } })),
  ]);
  // mensagens podem ser muitas: em lotes
  for (;;) {
    const lote = await db.mensagem.findMany({ where: { textoBusca: "", texto: { not: "" } }, select: { id: true, texto: true }, take: 500 });
    if (!lote.length) break;
    await db.$transaction(lote.map((m) => db.mensagem.update({ where: { id: m.id }, data: { textoBusca: paraBusca(m.texto) || " " } })));
  }
  console.log("\nAjustes gravados.");
}
await db.$disconnect();
