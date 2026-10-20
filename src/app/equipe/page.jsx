import Link from "next/link";
import { db } from "@/lib/db";
import { dataHora } from "@/lib/constantes";
import { usuarioAtual, ehGerente } from "@/lib/usuario";
import { ROTULO_ACAO } from "@/lib/auditoria";
import { RETENCAO_WEBHOOK_DIAS } from "@/lib/manutencao";
import { chipFiltro } from "@/lib/tema";
import TrocarSenha from "@/components/TrocarSenha";
import GestaoEquipe from "@/components/GestaoEquipe";

export const dynamic = "force-dynamic";

const ENTIDADE_LINK = { Lead: (id) => `/leads/${id}`, Orcamento: (id) => `/orcamentos/${id}` };

export default async function Equipe({ searchParams }) {
  const sp = await searchParams;
  const usuario = await usuarioAtual();
  const gerente = ehGerente(usuario);

  const [usuarios, registros] = gerente
    ? await Promise.all([
        db.user.findMany({
          orderBy: [{ ativo: "desc" }, { nome: "asc" }],
          select: { id: true, nome: true, email: true, cargo: true, papel: true, ativo: true, ultimoLoginEm: true, senhaHash: true },
        }),
        db.auditoria.findMany({
          where: sp?.acao ? { acao: sp.acao } : {},
          orderBy: { createdAt: "desc" },
          take: 150,
          include: { user: { select: { nome: true } } },
        }),
      ])
    : [[], []];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{gerente ? "Equipe e LGPD" : "Minha conta"}</h1>
        <p className="text-sm text-slate-500">
          {usuario.nome} · {usuario.email}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <TrocarSenha />
        </div>

        {gerente && (
          <div className="lg:col-span-2">
            <GestaoEquipe
              usuarioId={usuario.id}
              usuarios={usuarios.map(({ senhaHash, ...u }) => ({ ...u, semSenha: !senhaHash }))}
            />
          </div>
        )}
      </div>

      {gerente && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
            <div>
              <h2 className="text-sm font-semibold">Registro de acesso a dados pessoais</h2>
              <p className="text-xs text-slate-500">
                Logins, fichas abertas, anexos (receitas) vistos, exportações e exclusões. Payloads de webhook são apagados após{" "}
                {RETENCAO_WEBHOOK_DIAS} dias.
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Link href="/equipe" className={`chip ${chipFiltro(!sp?.acao)}`}>todos</Link>
              {["LOGIN_FALHOU", "VER_ANEXO", "EXPORTAR_TITULAR", "ANONIMIZAR_TITULAR", "EXCLUIR_LEAD"].map((a) => (
                <Link
                  key={a}
                  href={`/equipe?acao=${a}`}
                  className={`chip ${chipFiltro(sp?.acao === a)}`}
                >
                  {ROTULO_ACAO[a]}
                </Link>
              ))}
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Quando</th>
                <th className="px-4 py-2 font-medium">Quem</th>
                <th className="px-4 py-2 font-medium">O quê</th>
                <th className="px-4 py-2 font-medium">Detalhe</th>
                <th className="px-4 py-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registros.map((r) => {
                const link = r.entidadeId && ENTIDADE_LINK[r.entidade]?.(r.entidadeId);
                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-500">{dataHora(r.createdAt)}</td>
                    <td className="px-4 py-2">{r.user?.nome ?? "—"}</td>
                    <td className={`px-4 py-2 ${r.acao === "LOGIN_FALHOU" ? "text-rose-600" : ""}`}>{ROTULO_ACAO[r.acao] ?? r.acao}</td>
                    <td className="max-w-xs truncate px-4 py-2 text-slate-500">
                      {link ? <Link href={link} className="hover:text-emerald-700">{r.detalhe ?? "abrir"}</Link> : r.detalhe ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-400">{r.ip ?? "—"}</td>
                  </tr>
                );
              })}
              {registros.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Nenhum registro.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
