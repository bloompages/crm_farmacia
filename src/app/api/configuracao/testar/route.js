import { NextResponse } from "next/server";
import { exigirUsuario } from "@/lib/usuario";
import { testarConexaoMeta } from "@/lib/integrations/meta";
import { registrarTeste, obterConfiguracao, configuracaoPublica } from "@/lib/configuracao";

export const dynamic = "force-dynamic";

/** { canal: "WHATSAPP" | "INSTAGRAM" } — confere as credenciais na Meta sem enviar mensagem. */
export async function POST(req) {
  const { resposta } = await exigirUsuario("GERENTE");
  if (resposta) return resposta;
  const { canal } = await req.json().catch(() => ({}));
  if (canal !== "WHATSAPP" && canal !== "INSTAGRAM") return NextResponse.json({ erro: "canal inválido" }, { status: 400 });
  try {
    const { rotulo, avisos } = await testarConexaoMeta(canal);
    await registrarTeste(canal, rotulo);
    return NextResponse.json({ ok: true, rotulo, avisos, configuracao: configuracaoPublica(await obterConfiguracao()) });
  } catch (e) {
    return NextResponse.json({ erro: e.message }, { status: 400 });
  }
}
