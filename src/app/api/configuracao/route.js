import { NextResponse } from "next/server";
import { exigirUsuario } from "@/lib/usuario";
import { auditar } from "@/lib/auditoria";
import { obterConfiguracao, salvarConfiguracao, configuracaoPublica } from "@/lib/configuracao";

export const dynamic = "force-dynamic";

/** Configuração da farmácia (só gerente). Os tokens voltam mascarados. */
export async function GET() {
  const { resposta } = await exigirUsuario("GERENTE");
  if (resposta) return resposta;
  return NextResponse.json(configuracaoPublica(await obterConfiguracao()));
}

/** Atualiza só os campos enviados. Ver validarConfiguracao para as regras. */
export async function PATCH(req) {
  const { resposta } = await exigirUsuario("GERENTE");
  if (resposta) return resposta;
  const corpo = await req.json().catch(() => ({}));
  try {
    const { cfg, alterados } = await salvarConfiguracao(corpo);
    // registra quais campos mudaram, nunca os valores (tokens são segredo)
    if (alterados.length) await auditar("CONFIGURACAO_ALTERADA", { entidade: "Configuracao", entidadeId: "unica", detalhe: alterados.join(", ") });
    return NextResponse.json(configuracaoPublica(cfg));
  } catch (e) {
    return NextResponse.json({ erro: e.message }, { status: e.validacao ? 400 : 500 });
  }
}
