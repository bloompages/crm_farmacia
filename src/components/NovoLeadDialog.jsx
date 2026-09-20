"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ORIGENS } from "@/lib/constantes";

export default function NovoLeadDialog() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    setSalvando(false);
    if (!r.ok) return setErro((await r.json()).erro ?? "Erro ao salvar");
    setAberto(false);
    router.refresh();
  }

  if (!aberto) return <button className="btn-primary" onClick={() => setAberto(true)}>+ Novo lead</button>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form onSubmit={salvar} className="card w-full max-w-lg p-5">
        <h2 className="mb-4 text-lg font-semibold">Novo lead</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nome *</label>
            <input name="nome" required className="input" placeholder="Maria Souza / Clínica Vida" />
          </div>
          <div>
            <label className="label">WhatsApp</label>
            <input name="telefone" className="input" placeholder="5511987654321" />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input name="email" type="email" className="input" />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select name="tipo" className="input">
              <option value="PF">Pessoa física</option>
              <option value="PJ">PJ (clínica, convênio, empresa)</option>
            </select>
          </div>
          <div>
            <label className="label">Origem</label>
            <select name="origem" className="input" defaultValue="MANUAL">
              {ORIGENS.map((o) => <option key={o} value={o}>{o.toLowerCase()}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Interesses (separados por vírgula)</label>
            <input name="interesses" className="input" placeholder="manipulados, dermocosméticos" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Observações</label>
            <textarea name="observacoes" rows={2} className="input" />
          </div>
        </div>
        {erro && <p className="mt-3 text-sm text-rose-600">{erro}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => setAberto(false)}>Cancelar</button>
          <button className="btn-primary" disabled={salvando}>{salvando ? "Salvando..." : "Salvar lead"}</button>
        </div>
      </form>
    </div>
  );
}
