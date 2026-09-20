import { db } from "@/lib/db";
import { saudeSincronizacao } from "@/lib/mensageria";
import Inbox from "@/components/Inbox";

export const dynamic = "force-dynamic";

export default async function InboxPage({ searchParams }) {
  const sp = await searchParams;
  const [conversas, sincronizacao] = await Promise.all([
    db.conversa.findMany({
      orderBy: { ultimaMsgEm: "desc" },
      take: 300,
      include: { mensagens: { orderBy: { enviadoEm: "asc" }, take: 200 }, lead: { select: { id: true, nome: true, etapa: true, valorAprovado: true } } },
    }),
    saudeSincronizacao(),
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
      />
    </div>
  );
}
