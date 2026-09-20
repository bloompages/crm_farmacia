"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ETAPAS, brl } from "@/lib/constantes";
import { PONTO_TEMPERATURA as TEMP } from "@/lib/tema";

export default function Kanban({ leadsIniciais }) {
  const router = useRouter();
  const [leads, setLeads] = useState(leadsIniciais);
  const [arrastando, setArrastando] = useState(null);
  const [sobre, setSobre] = useState(null);

  async function mover(leadId, etapa) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.etapa === etapa) return;
    setLeads((atual) => atual.map((l) => (l.id === leadId ? { ...l, etapa } : l)));
    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etapa }),
    });
    router.refresh();
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {ETAPAS.map((etapa) => {
        const daEtapa = leads.filter((l) => l.etapa === etapa.id);
        const valor = daEtapa.reduce((t, l) => t + l.valorAberto, 0);
        return (
          <div
            key={etapa.id}
            onDragOver={(e) => { e.preventDefault(); setSobre(etapa.id); }}
            onDragLeave={() => setSobre((s) => (s === etapa.id ? null : s))}
            onDrop={(e) => { e.preventDefault(); setSobre(null); if (arrastando) mover(arrastando, etapa.id); }}
            className={`w-72 shrink-0 rounded-xl border p-2 transition ${
              sobre === etapa.id ? "border-emerald-400 bg-emerald-50/60" : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="mb-2 flex items-center justify-between px-1.5 py-1">
              <span className={`chip ${etapa.cor}`}>{etapa.label}</span>
              <span className="text-xs text-slate-400">{daEtapa.length}</span>
            </div>
            {valor > 0 && <div className="mb-2 px-1.5 text-xs text-slate-500">{brl(valor)} em aberto</div>}

            <div className="space-y-2">
              {daEtapa.map((l) => (
                <div
                  key={l.id}
                  draggable
                  onDragStart={() => setArrastando(l.id)}
                  onDragEnd={() => setArrastando(null)}
                  className={`cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing ${
                    arrastando === l.id ? "opacity-40" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TEMP[l.temperatura]}`} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/leads/${l.id}`} className="block truncate text-sm font-medium text-slate-800 hover:text-emerald-700">
                        {l.nome}
                      </Link>
                      <div className="truncate text-xs text-slate-400">
                        {l.origem.toLowerCase()} · score {l.score}
                      </div>
                      {l.etapa === "APROVADO" && l.valorAprovado > 0 ? (
                        <div className="mt-1 text-xs font-medium text-emerald-700">{brl(l.valorAprovado)} aprovado</div>
                      ) : l.valorAberto > 0 ? (
                        <div className="mt-1 text-xs font-medium text-amber-600">{brl(l.valorAberto)}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              {daEtapa.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-300">
                  arraste um lead aqui
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
