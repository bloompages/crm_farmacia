import { NextResponse } from "next/server";
import { IMPORTACOES, modeloCsv } from "@/lib/planilhas";
import { respostaCsv } from "@/lib/csv";
import { exigirUsuario } from "@/lib/usuario";
import { auditar } from "@/lib/auditoria";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // planilha grande no banco da nuvem (Vercel): até 5.000 linhas

/** Planilha modelo para preencher no Excel. */
export async function GET(_req, { params }) {
  const { resposta } = await exigirUsuario("GERENTE");
  if (resposta) return resposta;
  const { tipo } = await params;
  if (!IMPORTACOES[tipo]) return NextResponse.json({ erro: "importação desconhecida" }, { status: 404 });
  return respostaCsv(modeloCsv(tipo), `modelo-${tipo}`);
}

/**
 * { conteudo, arquivo, gravar, atualizar } — o navegador lê o arquivo (UTF-8 ou o
 * ANSI do Excel) e manda o texto. gravar=false só simula; a tela mostra o resumo e
 * pede confirmação antes de gravar de verdade.
 */
export async function POST(req, { params }) {
  const { usuario, resposta } = await exigirUsuario("GERENTE");
  if (resposta) return resposta;
  const { tipo } = await params;
  const imp = IMPORTACOES[tipo];
  if (!imp) return NextResponse.json({ erro: "importação desconhecida" }, { status: 404 });
  const b = await req.json().catch(() => null);
  if (typeof b?.conteudo !== "string") return NextResponse.json({ erro: "envie o conteúdo do arquivo CSV" }, { status: 400 });

  const r = await imp.importar(b.conteudo, { gravar: !!b.gravar, atualizar: !!b.atualizar, usuario, arquivo: b.arquivo });
  if (r.erro) return NextResponse.json(r, { status: 400 });
  if (b.gravar) {
    await auditar("IMPORTAR_CSV", {
      entidade: tipo,
      detalhe: `${b.arquivo ?? "planilha"}: ${r.novos} novo(s), ${r.atualizados} atualizado(s), ${r.ignorados} ignorado(s), ${r.erros.length} com erro`,
    });
  }
  return NextResponse.json({ ...r, gravado: !!b.gravar, erros: r.erros.slice(0, 300), avisos: r.avisos.slice(0, 300) });
}
