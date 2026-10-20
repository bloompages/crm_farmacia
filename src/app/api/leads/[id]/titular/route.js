import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/usuario";
import { auditar } from "@/lib/auditoria";

export const dynamic = "force-dynamic";

/** Direito de acesso/portabilidade (LGPD art. 18, II e V): tudo que o CRM guarda sobre a pessoa, em JSON. */
export async function GET(_req, { params }) {
  const { resposta } = await exigirUsuario("GERENTE");
  if (resposta) return resposta;
  const { id } = await params;

  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      orcamentos: { include: { itens: true } },
      atividades: { orderBy: { createdAt: "asc" } },
      conversas: { include: { mensagens: { orderBy: { enviadoEm: "asc" } } } },
      responsavel: { select: { nome: true } },
    },
  });
  if (!lead) return NextResponse.json({ erro: "lead não encontrado" }, { status: 404 });

  await auditar("EXPORTAR_TITULAR", { entidade: "Lead", entidadeId: id, detalhe: lead.nome });
  const { busca, scoreBase, scoreEm, ...dados } = lead; // campos internos de cálculo ficam de fora
  const nome = `dados-titular-${id}.json`;
  return new Response(JSON.stringify({ geradoEm: new Date(), titular: dados }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Direito de eliminação (LGPD art. 18, VI). Anonimiza em vez de apagar o lead:
 * os orçamentos continuam nos relatórios (valores, motivos), sem identificar a pessoa.
 * Corpo: { confirmacao: "APAGAR" }
 */
export async function POST(req, { params }) {
  const { resposta } = await exigirUsuario("GERENTE");
  if (resposta) return resposta;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  if (b.confirmacao !== "APAGAR") return NextResponse.json({ erro: 'digite "APAGAR" para confirmar' }, { status: 400 });

  const lead = await db.lead.findUnique({ where: { id }, include: { conversas: { select: { id: true, contatoExterno: true } } } });
  if (!lead) return NextResponse.json({ erro: "lead não encontrado" }, { status: 404 });
  if (lead.anonimizadoEm) return NextResponse.json({ erro: "este lead já foi anonimizado" }, { status: 409 });

  // payloads brutos de webhook também carregam telefone/@ e o texto das mensagens
  const contatos = [lead.telefone, ...lead.conversas.map((c) => c.contatoExterno)].filter(Boolean);

  await db.$transaction([
    db.conversa.deleteMany({ where: { leadId: id } }), // mensagens e referências a anexos vão junto (cascade)
    db.atividade.deleteMany({ where: { leadId: id, tipo: { in: ["NOTA", "MENSAGEM", "LIGACAO"] } } }),
    db.orcamento.updateMany({ where: { leadId: id }, data: { detalheRejeicao: null } }),
    db.auditoria.updateMany({ where: { entidade: "Lead", entidadeId: id }, data: { detalhe: null } }),
    ...contatos.map((c) => db.eventoWebhook.deleteMany({ where: { payload: { contains: c } } })),
    db.lead.update({
      where: { id },
      data: {
        nome: "Titular anonimizado",
        telefone: null,
        email: null,
        documento: null,
        empresa: null,
        observacoes: null,
        interesses: "",
        etiquetas: "",
        dataNascimento: null,
        convenio: null,
        busca: "",
        consentimentoMarketing: false,
        anonimizadoEm: new Date(),
      },
    }),
    db.atividade.create({ data: { leadId: id, tipo: "NOTA", descricao: "Dados pessoais apagados a pedido do titular (LGPD)." } }),
  ]);

  // o registro de auditoria guarda que houve a eliminação, não os dados eliminados
  await auditar("ANONIMIZAR_TITULAR", { entidade: "Lead", entidadeId: id });
  return NextResponse.json({ ok: true });
}
