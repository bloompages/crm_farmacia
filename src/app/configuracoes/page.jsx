import Link from "next/link";
import { db } from "@/lib/db";
import { usuarioAtual, ehGerente } from "@/lib/usuario";
import { contarEtiquetas } from "@/lib/etiquetas";

export const dynamic = "force-dynamic";

function Item({ href, icone, titulo, descricao, detalhe, bloqueado }) {
  const corpo = (
    <>
      <span className="mt-0.5 w-6 shrink-0 text-center text-lg opacity-60">{icone}</span>
      <span className="min-w-0">
        <span className="block font-medium text-slate-800">{titulo}</span>
        <span className="block text-sm text-slate-500">{descricao}</span>
        {detalhe && <span className="mt-1 block text-xs text-emerald-700">{detalhe}</span>}
        {bloqueado && <span className="mt-1 block text-xs text-slate-400">só o gerente acessa</span>}
      </span>
    </>
  );
  if (bloqueado) return <div className="card flex gap-3 p-4 opacity-60">{corpo}</div>;
  return <Link href={href} className="card flex gap-3 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/30">{corpo}</Link>;
}

function Secao({ titulo, children }) {
  return (
    <section className="space-y-2">
      <h2 className="border-l-2 border-emerald-500 pl-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{titulo}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

export default async function Configuracoes() {
  const usuario = await usuarioAtual();
  const gerente = ehGerente(usuario);
  const [rapidas, comEtiqueta, leads, produtos] = await Promise.all([
    db.mensagemRapida.count(),
    db.lead.findMany({ where: { etiquetas: { not: "" } }, select: { etiquetas: true } }),
    db.lead.count({ where: { anonimizadoEm: null } }),
    db.produto.count(),
  ]);
  const etiquetas = contarEtiquetas(comEtiqueta).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-slate-500">Atendimento, dados e equipe.</p>
      </header>

      <Secao titulo="Atendimento">
        <Item
          href="/configuracoes/mensagens-rapidas"
          icone="⚡"
          titulo="Mensagens rápidas"
          descricao='Atalhos "/texto" para inserir respostas prontas na conversa.'
          detalhe={`${rapidas} cadastrada(s)`}
        />
        <Item
          href="/configuracoes/etiquetas"
          icone="#"
          titulo="Etiquetas"
          descricao="Etiquetas dos contatos: renomear, juntar e remover."
          detalhe={`${etiquetas} em uso`}
        />
      </Secao>

      <Secao titulo="Dados">
        <Item
          href="/configuracoes/planilhas"
          icone="⇅"
          titulo="Importar e exportar planilhas"
          descricao="Leads, orçamentos e catálogo de produtos em CSV, pronto para abrir no Excel."
          detalhe={`${leads} lead(s) · ${produtos} produto(s)`}
          bloqueado={!gerente}
        />
      </Secao>

      <Secao titulo="Conta e equipe">
        <Item href="/equipe" icone="☺" titulo={gerente ? "Usuários, permissões e LGPD" : "Minha conta"} descricao={gerente ? "Convide atendentes, defina papéis e veja a auditoria de acessos." : "Altere sua própria senha."} />
      </Secao>
    </div>
  );
}
