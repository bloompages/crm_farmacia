import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ETAPAS, MOTIVOS_REJEICAO, labelEtapa, labelMotivo } from "@/lib/constantes";
import { normalizarTelefone } from "@/lib/telefone";
import { STATUS_ABERTOS, centavos, comNumeroSequencial } from "@/lib/orcamento";
import { buscaLead } from "@/lib/busca";
import { exigirUsuario } from "@/lib/usuario";
import { auditar } from "@/lib/auditoria";
import { etiquetasParaTexto } from "@/lib/etiquetas";
import { lerData } from "@/lib/csv";

export async function PATCH(req, { params }) {
  const { usuario, resposta } = await exigirUsuario();
  if (resposta) return resposta;
  const { id } = await params;
  const b = await req.json();
  const atual = await db.lead.findUnique({ where: { id } });
  if (!atual) return NextResponse.json({ erro: "lead não encontrado" }, { status: 404 });
  if (atual.anonimizadoEm) return NextResponse.json({ erro: "lead anonimizado a pedido do titular" }, { status: 409 });

  const data = {};
  for (const campo of ["nome", "email", "empresa", "documento", "convenio", "tipo", "origem", "interesses", "observacoes", "temperatura"]) {
    if (b[campo] !== undefined) data[campo] = (typeof b[campo] === "string" ? b[campo].trim() : b[campo]) || null;
  }
  if (data.nome === null) return NextResponse.json({ erro: "nome obrigatório" }, { status: 400 });
  if (data.interesses === null) data.interesses = "";
  if (b.etiquetas !== undefined) data.etiquetas = etiquetasParaTexto(b.etiquetas);
  if (b.dataNascimento !== undefined) {
    const d = lerData(b.dataNascimento);
    if (d === undefined) return NextResponse.json({ erro: "data de nascimento inválida" }, { status: 400 });
    data.dataNascimento = d;
  }
  if (data.nome !== undefined || data.empresa !== undefined || data.email !== undefined) {
    data.busca = buscaLead({ ...atual, ...data });
  }
  if (b.responsavelId !== undefined) {
    if (b.responsavelId && !(await db.user.findFirst({ where: { id: b.responsavelId, ativo: true } }))) {
      return NextResponse.json({ erro: "responsável inválido" }, { status: 400 });
    }
    data.responsavelId = b.responsavelId || null;
  }
  // consentimento LGPD para contato ativo: guarda quando foi dado/retirado
  if (b.consentimentoMarketing !== undefined && !!b.consentimentoMarketing !== atual.consentimentoMarketing) {
    data.consentimentoMarketing = !!b.consentimentoMarketing;
    data.consentimentoEm = new Date();
  }
  if (b.telefone !== undefined) {
    data.telefone = normalizarTelefone(b.telefone);
    const dono = data.telefone && (await db.lead.findUnique({ where: { telefone: data.telefone }, select: { id: true, nome: true } }));
    if (dono && dono.id !== id) {
      return NextResponse.json({ erro: `telefone já cadastrado em ${dono.nome}`, leadId: dono.id }, { status: 409 });
    }
  }
  if (b.etapa && !ETAPAS.some((e) => e.id === b.etapa)) {
    return NextResponse.json({ erro: `etapa inválida: ${b.etapa}` }, { status: 400 });
  }
  if (b.etapa && b.etapa !== atual.etapa) {
    data.etapa = b.etapa;
    if (b.etapa !== "PERDIDO") data.motivoPerda = null;
  }
  // assim como na rejeição de orçamento, nenhuma perda entra no funil sem motivo
  const perdendo = data.etapa === "PERDIDO";
  if (perdendo || (b.motivoPerda !== undefined && atual.etapa === "PERDIDO")) {
    if (!MOTIVOS_REJEICAO.some((m) => m.id === b.motivoPerda)) {
      return NextResponse.json({ erro: "motivo da perda é obrigatório" }, { status: 400 });
    }
    data.motivoPerda = b.motivoPerda;
  }

  // valor aprovado: vem do botão "Aprovar" da conversa (soma dos "Total" ou editado pelo atendente)
  let valorAprovado;
  if (b.valorAprovado !== undefined) {
    valorAprovado = b.valorAprovado === null || b.valorAprovado === "" ? null : Number(b.valorAprovado);
    if (valorAprovado !== null && (!Number.isFinite(valorAprovado) || valorAprovado < 0)) {
      return NextResponse.json({ erro: "valor aprovado inválido" }, { status: 400 });
    }
    if (valorAprovado !== null) valorAprovado = centavos(valorAprovado);
    data.valorAprovado = valorAprovado;
  }

  const aprovando = (data.etapa ?? atual.etapa) === "APROVADO" && (data.etapa || valorAprovado !== undefined);

  // tudo ou nada: lead, orçamentos e timeline não podem ficar desencontrados
  const lead = await comNumeroSequencial(async (tx, proximoNumero) => {
    const lead = await tx.lead.update({ where: { id }, data });

    if (data.etapa) {
      await tx.atividade.create({
        data: {
          leadId: id,
          autorId: usuario.id,
          tipo: "ETAPA",
          descricao: `Etapa alterada: ${labelEtapa(atual.etapa)} → ${labelEtapa(lead.etapa)}${lead.motivoPerda ? ` (motivo: ${labelMotivo(lead.motivoPerda)})` : ""}`,
        },
      });
    }

    // Perdido no funil = orçamentos em aberto rejeitados com o mesmo motivo,
    // senão o valor continua "em aberto" e a perda não aparece no relatório.
    if (perdendo) {
      const abertos = await tx.orcamento.findMany({ where: { leadId: id, status: { in: STATUS_ABERTOS } } });
      for (const o of abertos) {
        await tx.orcamento.update({
          where: { id: o.id },
          data: {
            status: "REJEITADO",
            fechadoEm: new Date(),
            motivoRejeicao: data.motivoPerda,
            detalheRejeicao: o.detalheRejeicao ?? "Lead marcado como perdido no funil",
          },
        });
        await tx.atividade.create({
          data: { leadId: id, autorId: usuario.id, tipo: "ORCAMENTO", descricao: `Orçamento #${o.numero} rejeitado — ${labelMotivo(data.motivoPerda)}` },
        });
      }
    }

    // Ao aprovar (ou ao editar o valor de um lead já aprovado), o orçamento acompanha:
    // o orçamento em aberto vira ACEITO com o valor aprovado; sem orçamento, cria um ACEITO —
    // assim o valor entra nos relatórios de resultado.
    if (aprovando) {
      const orc = await sincronizarOrcamentoAprovado(tx, lead, valorAprovado, proximoNumero);
      if (orc) {
        await tx.atividade.create({
          data: {
            leadId: id,
            autorId: usuario.id,
            tipo: "ORCAMENTO",
            descricao: `Orçamento #${orc.numero} aceito — total R$ ${orc.total.toFixed(2)}${valorAprovado !== undefined ? " (valor definido na conversa)" : ""}`,
          },
        });
      }
    }

    if (data.consentimentoMarketing !== undefined) {
      await tx.atividade.create({
        data: {
          leadId: id,
          autorId: usuario.id,
          tipo: "NOTA",
          descricao: data.consentimentoMarketing ? "Cliente autorizou contato ativo (lembretes e ofertas)." : "Cliente retirou a autorização de contato ativo.",
        },
      });
    }
    if (b.nota?.trim()) {
      await tx.atividade.create({ data: { leadId: id, autorId: usuario.id, tipo: "NOTA", descricao: b.nota.trim() } });
    }
    return lead;
  });

  return NextResponse.json(lead);
}

async function sincronizarOrcamentoAprovado(tx, lead, valorAprovado, numero) {
  const valor = valorAprovado ?? lead.valorAprovado ?? null;
  const existente = await tx.orcamento.findFirst({
    where: { leadId: lead.id, status: { in: [...STATUS_ABERTOS, "ACEITO"] } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }], // ACEITO < ENVIADO < RASCUNHO em ordem alfabética: prioriza o já aceito
  });

  if (existente) {
    return tx.orcamento.update({
      where: { id: existente.id },
      data: {
        status: "ACEITO",
        fechadoEm: existente.fechadoEm ?? new Date(),
        motivoRejeicao: null,
        detalheRejeicao: null,
        ...(valor !== null && valor > 0 ? { total: valor } : {}),
      },
    });
  }
  if (valor === null || valor <= 0) return null;

  return tx.orcamento.create({
    data: {
      numero,
      leadId: lead.id,
      status: "ACEITO",
      total: valor,
      enviadoEm: new Date(),
      fechadoEm: new Date(),
      itens: { create: [{ descricao: "Pedido aprovado na conversa", quantidade: 1, precoUnit: valor, subtotal: valor }] },
    },
  });
}

export async function DELETE(_req, { params }) {
  const { resposta } = await exigirUsuario("GERENTE");
  if (resposta) return resposta;
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id }, select: { nome: true } });
  if (!lead) return NextResponse.json({ erro: "lead não encontrado" }, { status: 404 });
  // conversas não têm cascade (o histórico do canal pode sobreviver ao lead): desvincula antes
  await db.$transaction([
    db.conversa.updateMany({ where: { leadId: id }, data: { leadId: null } }),
    db.lead.delete({ where: { id } }),
  ]);
  await auditar("EXCLUIR_LEAD", { entidade: "Lead", entidadeId: id, detalhe: lead.nome });
  return NextResponse.json({ ok: true });
}
