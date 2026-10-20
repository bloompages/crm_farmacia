import Link from "next/link";
import { db } from "@/lib/db";
import { contarEtiquetas } from "@/lib/etiquetas";
import { usuarioAtual, ehGerente } from "@/lib/usuario";
import GestaoEtiquetas from "@/components/GestaoEtiquetas";

export const dynamic = "force-dynamic";

export default async function EtiquetasConfig() {
  const [usuario, comEtiqueta] = await Promise.all([
    usuarioAtual(),
    db.lead.findMany({ where: { etiquetas: { not: "" } }, select: { etiquetas: true } }),
  ]);
  return (
    <div className="max-w-3xl space-y-4">
      <header>
        <Link href="/configuracoes" className="text-xs text-slate-400 hover:text-slate-600">← Configurações</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Etiquetas</h1>
        <p className="text-sm text-slate-500">
          Etiquetas são criadas na hora, no "+ etiqueta" da conversa ou da ficha do lead. Aqui dá para renomear, juntar duas
          (renomeie uma com o nome da outra) e remover de todos os leads.
        </p>
      </header>
      <GestaoEtiquetas inicial={contarEtiquetas(comEtiqueta)} gerente={ehGerente(usuario)} />
    </div>
  );
}
