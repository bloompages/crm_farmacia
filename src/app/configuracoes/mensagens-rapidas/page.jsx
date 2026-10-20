import Link from "next/link";
import { db } from "@/lib/db";
import GestaoMensagensRapidas from "@/components/GestaoMensagensRapidas";

export const dynamic = "force-dynamic";

export default async function MensagensRapidas() {
  const lista = await db.mensagemRapida.findMany({ orderBy: { atalho: "asc" }, select: { id: true, atalho: true, texto: true } });
  return (
    <div className="max-w-3xl space-y-4">
      <header>
        <Link href="/configuracoes" className="text-xs text-slate-400 hover:text-slate-600">← Configurações</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Mensagens rápidas</h1>
        <p className="text-sm text-slate-500">
          Na conversa, digite <b>/</b> e o atalho (ex.: <code className="rounded bg-slate-100 px-1">/pix</code>) e aperte Tab ou Enter.
          Use <code className="rounded bg-slate-100 px-1">{"{nome}"}</code> para o primeiro nome do cliente.
        </p>
      </header>
      <GestaoMensagensRapidas inicial={lista} />
    </div>
  );
}
