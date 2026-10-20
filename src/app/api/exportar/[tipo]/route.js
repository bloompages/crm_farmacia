import { NextResponse } from "next/server";
import { EXPORTACOES } from "@/lib/planilhas";
import { respostaCsv } from "@/lib/csv";
import { filtroLeads } from "@/lib/busca";
import { STATUS_ORCAMENTO } from "@/lib/constantes";
import { exigirUsuario } from "@/lib/usuario";
import { auditar } from "@/lib/auditoria";

export const dynamic = "force-dynamic";

/**
 * Download em CSV (abre direto no Excel). Só gerente: a planilha leva dados pessoais
 * em massa para fora do CRM, e cada exportação fica na auditoria.
 *   /api/exportar/leads?etapa=&origem=&q=&etiqueta=&meus=1   (mesmos filtros da tela de leads)
 *   /api/exportar/orcamentos?status=ENVIADO
 *   /api/exportar/produtos
 */
export async function GET(req, { params }) {
  const { usuario, resposta } = await exigirUsuario("GERENTE");
  if (resposta) return resposta;
  const { tipo } = await params;
  const exp = EXPORTACOES[tipo];
  if (!exp) return NextResponse.json({ erro: "exportação desconhecida" }, { status: 404 });

  const p = Object.fromEntries(new URL(req.url).searchParams);
  const where =
    tipo === "leads" ? filtroLeads(p, usuario.id)
    : tipo === "orcamentos" && STATUS_ORCAMENTO.includes(p.status) ? { status: p.status }
    : {};
  const { csv, total } = await exp.gerar(where);
  const filtros = Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(" ");
  await auditar("EXPORTAR_CSV", { entidade: tipo, detalhe: `${total} registro(s)${filtros ? ` · ${filtros}` : ""}` });
  return respostaCsv(csv, exp.arquivo);
}
