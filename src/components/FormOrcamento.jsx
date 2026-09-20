"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { brl } from "@/lib/constantes";

const linhaVazia = () => ({ key: Math.random().toString(36).slice(2), produtoId: "", descricao: "", quantidade: 1, precoUnit: 0 });

export default function FormOrcamento({ leads, produtos, leadPre }) {
  const router = useRouter();
  const [leadId, setLeadId] = useState(leadPre ?? "");
  const [itens, setItens] = useState([linhaVazia()]);
  const [desconto, setDesconto] = useState(0);
  const [validadeEm, setValidade] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const bruto = useMemo(
    () => itens.reduce((t, i) => t + (Number(i.quantidade) || 0) * (Number(i.precoUnit) || 0), 0),
    [itens]
  );
  const total = Math.max(0, bruto - (Number(desconto) || 0));

  function atualizar(key, campo, valor) {
    setItens((atual) =>
      atual.map((i) => {
        if (i.key !== key) return i;
        if (campo === "produtoId") {
          const p = produtos.find((p) => p.id === valor);
          return p ? { ...i, produtoId: p.id, descricao: p.nome, precoUnit: p.preco } : { ...i, produtoId: "" };
        }
        return { ...i, [campo]: valor };
      })
    );
  }

  async function salvar(status) {
    setSalvando(true);
    setErro("");
    const r = await fetch("/api/orcamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, itens, desconto, validadeEm: validadeEm || null, status }),
    });
    setSalvando(false);
    const json = await r.json();
    if (!r.ok) return setErro(json.erro ?? "Erro ao salvar");
    router.push(`/orcamentos/${json.id}`);
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="card space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label">Lead *</label>
            <select className="input" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
              <option value="">Selecione o lead…</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>{l.nome}{l.telefone ? ` — ${l.telefone}` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Validade</label>
            <input type="date" className="input" value={validadeEm} onChange={(e) => setValidade(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Itens</h2>
          <button className="btn-ghost" onClick={() => setItens((a) => [...a, linhaVazia()])}>+ Item</button>
        </div>

        <div className="space-y-2">
          {itens.map((i) => (
            <div key={i.key} className="grid grid-cols-12 items-end gap-2">
              <div className="col-span-4">
                <label className="label">Produto do catálogo</label>
                <select className="input" value={i.produtoId} onChange={(e) => atualizar(i.key, "produtoId", e.target.value)}>
                  <option value="">— livre —</option>
                  {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <label className="label">Descrição</label>
                <input className="input" value={i.descricao} onChange={(e) => atualizar(i.key, "descricao", e.target.value)} placeholder="Fórmula manipulada…" />
              </div>
              <div className="col-span-2">
                <label className="label">Qtd</label>
                <input type="number" min="1" className="input" value={i.quantidade} onChange={(e) => atualizar(i.key, "quantidade", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">Unit. (R$)</label>
                <input type="number" step="0.01" className="input" value={i.precoUnit} onChange={(e) => atualizar(i.key, "precoUnit", e.target.value)} />
              </div>
              <div className="col-span-1">
                <button
                  className="btn-ghost w-full px-0 text-rose-600"
                  onClick={() => setItens((a) => (a.length > 1 ? a.filter((x) => x.key !== i.key) : a))}
                  title="Remover"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-4">
          <div className="w-40">
            <label className="label">Desconto (R$)</label>
            <input type="number" step="0.01" className="input" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Subtotal {brl(bruto)}</div>
            <div className="text-2xl font-semibold">{brl(total)}</div>
          </div>
        </div>
      </div>

      {erro && <p className="text-sm text-rose-600">{erro}</p>}

      <div className="flex justify-end gap-2">
        <button className="btn-ghost" disabled={!leadId || salvando} onClick={() => salvar("RASCUNHO")}>Salvar rascunho</button>
        <button className="btn-primary" disabled={!leadId || salvando} onClick={() => salvar("ENVIADO")}>
          {salvando ? "Salvando…" : "Salvar e marcar enviado"}
        </button>
      </div>
    </div>
  );
}
