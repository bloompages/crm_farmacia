"use client";
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

export default function Nav() {
  const path = usePathname();
  return (
    <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-4">
      <div className="mb-6 px-2">
        <div className="text-lg font-semibold tracking-tight text-emerald-700">CRM Farmácia</div>
        <div className="text-xs text-slate-400">comercial + atendimento</div>
      </div>
      <nav className="space-y-1">
        {ITENS.map((i) => {
          const ativo = i.href === "/" ? path === "/" : path.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                ativo ? "bg-emerald-50 font-medium text-emerald-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="w-4 text-center opacity-60">{i.icone}</span>
              {i.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
