import { saudeSincronizacao } from "@/lib/mensageria";
import { listarConversas } from "@/lib/inbox";
import Inbox from "@/components/Inbox";
import { db } from "@/lib/db";
import { usuarioAtual } from "@/lib/usuario";
import { contarEtiquetas } from "@/lib/etiquetas";

export const dynamic = "force-dynamic";

export default async function InboxPage({ searchParams }) {
  const sp = await searchParams;
  const [conversas, sincronizacao, usuario, mensagensRapidas, comEtiqueta] = await Promise.all([
    listarConversas(),
    saudeSincronizacao(),
    usuarioAtual(),
    db.mensagemRapida.findMany({ orderBy: { atalho: "asc" }, select: { id: true, atalho: true, texto: true } }),
    db.lead.findMany({ where: { etiquetas: { not: "" } }, select: { etiquetas: true } }),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mensagens</h1>
        <p className="text-sm text-slate-500">
          WhatsApp e Instagram no mesmo lugar — cada contato novo vira lead automaticamente. Nenhuma conversa é escondida.
        </p>
      </header>
      <Inbox
        conversasIniciais={JSON.parse(JSON.stringify(conversas))}
        sincronizacaoInicial={JSON.parse(JSON.stringify(sincronizacao))}
        selecionadaId={sp?.c ?? null}
        templateReabertura={process.env.WHATSAPP_TEMPLATE_REABERTURA || null}
        usuarioId={usuario?.id ?? null}
        mensagensRapidas={mensagensRapidas}
        etiquetasEmUso={contarEtiquetas(comEtiqueta).map((e) => e.nome)}
      />
    </div>
  );
}
