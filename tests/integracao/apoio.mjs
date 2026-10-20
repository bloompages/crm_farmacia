import { db } from "@/lib/db";

/** Requisição de teste para chamar o handler da rota direto. */
export const req = (corpo, url = "http://teste/api") =>
  new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
export const params = (id) => ({ params: Promise.resolve({ id }) });
export const json = async (resposta) => ({ status: resposta.status, corpo: await resposta.json() });

let n = 0;
export async function criarUsuario(papel = "ATENDENTE") {
  n += 1;
  return db.user.create({ data: { nome: `${papel} ${n}`, email: `${papel.toLowerCase()}${n}-${Date.now()}@teste.com`, papel } });
}

export async function criarLead(dados = {}) {
  return db.lead.create({ data: { nome: "Cliente Teste", ...dados } });
}

export async function criarOrcamento(leadId, dados = {}) {
  const { _max } = await db.orcamento.aggregate({ _max: { numero: true } });
  return db.orcamento.create({ data: { numero: (_max.numero ?? 0) + 1, leadId, status: "ENVIADO", total: 100, ...dados } });
}
