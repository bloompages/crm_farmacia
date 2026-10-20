import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizarTelefone } from "@/lib/telefone";
import { buscaLead } from "@/lib/busca";
import { exigirUsuario } from "@/lib/usuario";
import { etiquetasParaTexto } from "@/lib/etiquetas";
import { lerData } from "@/lib/csv";

export async function POST(req) {
  const { usuario, resposta } = await exigirUsuario();
  if (resposta) return resposta;
  const b = await req.json();
  if (!b.nome?.trim()) return NextResponse.json({ erro: "nome obrigatório" }, { status: 400 });
  // "(11) 98765-4321" e o wa_id "5511987654321" precisam cair no mesmo lead
  const telefone = normalizarTelefone(b.telefone);
  const existente = telefone && (await db.lead.findUnique({ where: { telefone }, select: { id: true, nome: true } }));
  if (existente) {
    return NextResponse.json({ erro: `telefone já cadastrado em ${existente.nome}`, leadId: existente.id }, { status: 409 });
  }
  if (b.etapa === "PERDIDO") return NextResponse.json({ erro: "cadastre o lead e depois marque a perda com o motivo" }, { status: 400 });
  const dataNascimento = lerData(b.dataNascimento);
  if (dataNascimento === undefined) return NextResponse.json({ erro: "data de nascimento inválida" }, { status: 400 });
  const dados = { nome: b.nome.trim(), empresa: b.empresa?.trim() || null, email: b.email?.trim() || null };
  const lead = await db.lead.create({
    data: {
      ...dados,
      busca: buscaLead(dados),
      responsavelId: usuario.id,
      telefone,
      tipo: b.tipo || "PF",
      origem: b.origem || "MANUAL",
      etapa: b.etapa || "NOVO",
      interesses: b.interesses || "",
      etiquetas: etiquetasParaTexto(b.etiquetas),
      documento: b.documento?.trim() || null,
      convenio: b.convenio?.trim() || null,
      dataNascimento,
      observacoes: b.observacoes || null,
    },
  });
  await db.atividade.create({
    data: { leadId: lead.id, tipo: "NOTA", autorId: usuario.id, descricao: `Lead cadastrado manualmente (origem ${lead.origem}).` },
  });
  return NextResponse.json(lead);
}
