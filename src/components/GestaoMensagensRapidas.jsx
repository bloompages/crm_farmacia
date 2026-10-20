"use client";
import { useState } from "react";
import { normalizarAtalho } from "@/lib/mensagensRapidas";

async function chamar(url, method, body) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) }).catch(() => null);
  const json = (r && (await r.json().catch(() => ({})))) || {};
  if (!r?.ok) throw new Error(json.erro || "não foi possível salvar");
  return json;
}

export default function GestaoMensagensRapidas({ inicial }) {
  const [lista, setLista] = useState(inicial);
  const [atalho, setAtalho] = useState("");
  const [texto, setTexto] = useState("");
  const [editando, setEditando] = useState(null); // { id, atalho, texto }
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const ordenar = (l) => [...l].sort((a, b) => a.atalho.localeCompare(b.atalho));

  async function criar(e) {
    e.preventDefault();
    setOcupado(true);
    setErro("");
    try {
      const nova = await chamar("/api/mensagens-rapidas", "POST", { atalho, texto });
      setLista((l) => ordenar([...l, nova]));
      setAtalho("");
      setTexto("");
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function salvarEdicao(e) {
    e.preventDefault();
    setOcupado(true);
    setErro("");
    try {
      const salva = await chamar(`/api/mensagens-rapidas/${editando.id}`, "PATCH", { atalho: editando.atalho, texto: editando.texto });
      setLista((l) => ordenar(l.map((m) => (m.id === salva.id ? salva : m))));
      setEditando(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function excluir(m) {
    if (!confirm(`Excluir a mensagem rápida /${m.atalho}?`)) return;
    try {
      await chamar(`/api/mensagens-rapidas/${m.id}`, "DELETE");
      setLista((l) => l.filter((x) => x.id !== m.id));
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={criar} className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold">Nova mensagem rápida</h2>
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <div>
            <label className="label">Atalho *</label>
            <div className="flex items-center rounded-lg border border-slate-200 bg-white pl-3 focus-within:border-emerald-500">
              <span className="text-slate-400">/</span>
              <input value={atalho} onChange={(e) => setAtalho(e.target.value)} required maxLength={30} placeholder="pix" className="w-full rounded-lg px-1 py-2 text-sm outline-none" />
            </div>
            {atalho && normalizarAtalho(atalho) !== atalho && <p className="mt-1 text-[11px] text-slate-400">vai ficar /{normalizarAtalho(atalho)}</p>}
          </div>
          <div>
            <label className="label">Texto *</label>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} required rows={3} className="input" placeholder={"Oi, {nome}! Nossa chave PIX é o CNPJ 00.000.000/0001-00. Assim que pagar, me manda o comprovante 😊"} />
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn-primary" disabled={ocupado || !atalho.trim() || !texto.trim()}>Adicionar</button>
        </div>
      </form>

      {erro && <div className="aviso aviso-negativo">{erro}</div>}

      <div className="card divide-y divide-slate-100">
        {lista.length === 0 && <p className="p-4 text-sm text-slate-400">Nenhuma mensagem rápida ainda.</p>}
        {lista.map((m) =>
          editando?.id === m.id ? (
            <form key={m.id} onSubmit={salvarEdicao} className="grid gap-2 p-3 sm:grid-cols-[10rem_1fr_auto]">
              <input value={editando.atalho} onChange={(e) => setEditando({ ...editando, atalho: e.target.value })} className="input" />
              <textarea value={editando.texto} onChange={(e) => setEditando({ ...editando, texto: e.target.value })} rows={3} className="input" />
              <div className="flex gap-2 sm:flex-col">
                <button className="btn-primary" disabled={ocupado}>Salvar</button>
                <button type="button" className="btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
              </div>
            </form>
          ) : (
            <div key={m.id} className="flex items-start gap-3 p-3">
              <b className="w-32 shrink-0 font-medium text-emerald-700">/{m.atalho}</b>
              <p className="msg-corpo min-w-0 flex-1 text-sm text-slate-600">{m.texto}</p>
              <div className="flex shrink-0 gap-3 text-xs">
                <button onClick={() => setEditando(m)} className="text-emerald-700 hover:underline">editar</button>
                <button onClick={() => excluir(m)} className="text-rose-600 hover:underline">excluir</button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
