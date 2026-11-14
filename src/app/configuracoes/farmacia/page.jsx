import Link from "next/link";
import { headers } from "next/headers";
import { usuarioAtual, ehGerente } from "@/lib/usuario";
import { obterConfiguracao, configuracaoPublica, etapasImplantacao } from "@/lib/configuracao";
import ConfiguracaoFarmacia from "@/components/ConfiguracaoFarmacia";

export const dynamic = "force-dynamic";

export default async function FarmaciaIntegracoes() {
  const usuario = await usuarioAtual();
  const voltar = <Link href="/configuracoes" className="text-xs text-slate-400 hover:text-slate-600">← Configurações</Link>;
  if (!ehGerente(usuario)) {
    return (
      <div className="max-w-3xl space-y-4">
        <header>{voltar}<h1 className="text-2xl font-semibold tracking-tight">Farmácia e integrações</h1></header>
        <div className="aviso aviso-neutro">Os dados da farmácia e a conexão com o WhatsApp só podem ser alterados pelo gerente.</div>
      </div>
    );
  }

  const [cfg, implantacao] = await Promise.all([obterConfiguracao(), etapasImplantacao()]);
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const protocolo = h.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  const origem = `${protocolo}://${host}`;

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        {voltar}
        <h1 className="text-2xl font-semibold tracking-tight">Farmácia e integrações</h1>
        <p className="text-sm text-slate-500">
          Tudo o que a farmácia precisa para começar a atender pelo CRM. As alterações valem na hora, sem precisar de técnico.
        </p>
      </header>
      <ConfiguracaoFarmacia inicial={JSON.parse(JSON.stringify(configuracaoPublica(cfg)))} implantacao={implantacao} origem={origem} />
    </div>
  );
}
