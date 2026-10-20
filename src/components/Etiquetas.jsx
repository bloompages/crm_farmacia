"use client";
import { useEffect, useId, useState } from "react";
import { TOM } from "@/lib/tema";
import { listaEtiquetas, normalizarEtiquetas } from "@/lib/etiquetas";

/**
 * Etiquetas do lead com "+ etiqueta" (como nas conversas de outros CRMs):
 * adiciona/remove na hora, sugere as que a equipe já usa.
 */
export default function Etiquetas({ leadId, etiquetas = "", sugestoes = [], aoMudar, desabilitado = false }) {
  const [lista, setLista] = useState(() => listaEtiquetas(etiquetas));
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const idLista = useId();

  // o polling do inbox pode trazer etiquetas novas (colocadas por outra pessoa)
  useEffect(() => { setLista(listaEtiquetas(etiquetas)); }, [etiquetas]);

  async function salvar(nova) {
    const anterior = lista;
    setLista(nova);
    setErro("");
    const r = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etiquetas: nova }),
    }).catch(() => null);
    if (!r?.ok) {
      setLista(anterior);
      setErro((r && (await r.json().catch(() => ({}))).erro) || "não foi possível salvar a etiqueta");
      return;
    }
    aoMudar?.(nova.join(","));
  }

  function adicionar(e) {
    e?.preventDefault();
    const novas = normalizarEtiquetas(texto);
    setTexto("");
    setEditando(false);
    if (novas.length) salvar(normalizarEtiquetas([...lista, ...novas]));
  }

  const livres = sugestoes.filter((s) => !lista.includes(s));

  return (
    <div className="flex flex-wrap items-center gap-1">
      {lista.map((e) => (
        <span key={e} className={`chip ${TOM.neutro} py-0`}>
          # {e}
          {!desabilitado && (
            <button type="button" onClick={() => salvar(lista.filter((x) => x !== e))} className="opacity-50 hover:opacity-100" title={`Tirar a etiqueta ${e}`}>
              ×
            </button>
          )}
        </span>
      ))}
      {!desabilitado && (editando ? (
        <form onSubmit={adicionar} className="inline-flex">
          <input
            autoFocus
            list={idLista}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={() => (texto.trim() ? adicionar() : setEditando(false))}
            onKeyDown={(e) => { if (e.key === "Escape") { setTexto(""); setEditando(false); } }}
            placeholder="etiqueta"
            maxLength={30}
            className="w-32 rounded-full border border-slate-200 px-2 py-0.5 text-xs outline-none focus:border-emerald-500"
          />
          <datalist id={idLista}>{livres.map((s) => <option key={s} value={s} />)}</datalist>
        </form>
      ) : (
        <button type="button" onClick={() => setEditando(true)} className={`chip ${TOM.neutroClaro} py-0 hover:bg-slate-50`}>
          + etiqueta
        </button>
      ))}
      {erro && <span className="text-xs text-rose-600">{erro}</span>}
    </div>
  );
}
