"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TOM } from "@/lib/tema";

export default function GestaoEtiquetas({ inicial, gerente }) {
  const router = useRouter();
  const [editando, setEditando] = useState(null); // { de, para }
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function aplicar(de, para) {
    setOcupado(true);
    setErro("");
    const r = await fetch("/api/etiquetas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ de, para }) }).catch(() => null);
    setOcupado(false);
    if (!r?.ok) return setErro((r && (await r.json().catch(() => ({}))).erro) || "não foi possível salvar");
    setEditando(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {erro && <div className="aviso aviso-negativo">{erro}</div>}
      {!gerente && <div className="aviso aviso-neutro">Renomear e remover etiquetas de todos os leads é ação do gerente.</div>}
      <div className="card divide-y divide-slate-100">
        {inicial.length === 0 && <p className="p-4 text-sm text-slate-400">Nenhuma etiqueta em uso.</p>}
        {inicial.map((e) => (
          <div key={e.nome} className="flex flex-wrap items-center gap-3 p-3">
            {editando?.de === e.nome ? (
              <form onSubmit={(ev) => { ev.preventDefault(); aplicar(e.nome, editando.para); }} className="flex flex-1 gap-2">
                <input autoFocus value={editando.para} maxLength={30} onChange={(ev) => setEditando({ ...editando, para: ev.target.value })} className="input" />
                <button className="btn-primary" disabled={ocupado || !editando.para.trim()}>Salvar</button>
                <button type="button" className="btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
              </form>
            ) : (
              <>
                <span className={`chip ${TOM.neutro}`}># {e.nome}</span>
                <Link href={`/leads?etiqueta=${encodeURIComponent(e.nome)}`} className="text-xs text-slate-500 hover:underline">{e.total} lead(s)</Link>
                {gerente && (
                  <span className="ml-auto flex gap-3 text-xs">
                    <button onClick={() => setEditando({ de: e.nome, para: e.nome })} className="text-emerald-700 hover:underline">renomear</button>
                    <button
                      onClick={() => confirm(`Remover "${e.nome}" de ${e.total} lead(s)?`) && aplicar(e.nome, "")}
                      disabled={ocupado}
                      className="text-rose-600 hover:underline"
                    >
                      remover
                    </button>
                  </span>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
