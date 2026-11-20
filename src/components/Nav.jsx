"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", label: "Painel", icone: "▦" },
  { href: "/leads", label: "Leads", icone: "☰" },
  { href: "/pipeline", label: "Funil", icone: "⇥" },
  { href: "/orcamentos", label: "Orçamentos", icone: "₿" },
  { href: "/inbox", label: "Mensagens", icone: "✉" },
  { href: "/relatorios", label: "Perdas", icone: "◔" },
];

/**
 * Navegação principal. Em telas grandes (lg+) é a barra lateral fixa; abaixo
 * disso vira uma barra superior com o nome da empresa e um menu gaveta.
 */
export default function Nav({ usuario, empresa }) {
  const path = usePathname();
  const [aberto, setAberto] = useState(false);
  const itens = [
    ...ITENS,
    { href: "/configuracoes", label: "Configurações", icone: "⚙" },
    { href: "/equipe", label: usuario.papel === "GERENTE" ? "Equipe e LGPD" : "Minha conta", icone: "☺" },
  ];
  const atual = itens.find((i) => (i.href === "/" ? path === "/" : path.startsWith(i.href)));

  // fecha a gaveta ao navegar e trava a rolagem da página enquanto ela está aberta
  useEffect(() => setAberto(false), [path]);
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const aoTeclar = (e) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("keydown", aoTeclar);
    return () => { document.body.style.overflow = anterior; document.removeEventListener("keydown", aoTeclar); };
  }, [aberto]);

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/login");
  }

  const marca = (
    <div className="min-w-0">
      <div className="truncate text-lg font-semibold tracking-tight text-emerald-700" title={empresa || undefined}>{empresa || "CRM"}</div>
      <div className="text-xs text-slate-400">comercial + atendimento</div>
    </div>
  );

  const conteudo = (
    <>
      <nav className="space-y-1">
        {itens.map((i) => {
          const ativo = i === atual;
          return (
            <Link
              key={i.href}
              prefetch={false} // pré-carregar as 8 páginas de uma vez abria conexões demais no banco
              href={i.href}
              aria-current={ativo ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm lg:py-2 ${
                ativo ? "bg-emerald-50 font-medium text-emerald-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="w-4 text-center opacity-60">{i.icone}</span>
              {i.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-slate-100 px-2 pt-3 text-xs">
        <div className="truncate font-medium text-slate-700">{usuario.nome}</div>
        <div className="truncate text-slate-400">{usuario.papel === "GERENTE" ? "Gerente" : usuario.cargo}</div>
        <button onClick={sair} className="mt-2 py-1 text-emerald-700 hover:underline">Sair</button>
      </div>
    </>
  );

  return (
    <>
      {/* barra superior: celular e tablet */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl text-slate-600 hover:bg-slate-100"
          aria-label="Abrir menu"
          aria-expanded={aberto}
        >
          ☰
        </button>
        <div className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-emerald-700">{empresa || "CRM"}</div>
        {atual && <div className="shrink-0 text-sm text-slate-500">{atual.label}</div>}
      </header>

      {/* gaveta: celular e tablet */}
      {aberto && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setAberto(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-white p-4 shadow-xl">
            <div className="mb-6 flex items-start gap-2 px-2">
              <div className="min-w-0 flex-1">{marca}</div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Fechar menu"
              >
                ✕
              </button>
            </div>
            {conteudo}
          </aside>
        </div>
      )}

      {/* barra lateral: desktop */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white p-4 lg:flex">
        <div className="mb-6 px-2">{marca}</div>
        {conteudo}
      </aside>
    </>
  );
}
