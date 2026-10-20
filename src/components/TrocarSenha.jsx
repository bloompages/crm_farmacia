"use client";
import { useState } from "react";

export default function TrocarSenha() {
  const [msg, setMsg] = useState(null); // { ok, texto }
  const [salvando, setSalvando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form));
    if (f.nova !== f.repetir) return setMsg({ ok: false, texto: "as senhas novas não conferem" });
    setSalvando(true);
    const r = await fetch("/api/auth/senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ atual: f.atual, nova: f.nova }),
    }).catch(() => null);
    setSalvando(false);
    if (!r?.ok) return setMsg({ ok: false, texto: (r && (await r.json().catch(() => ({}))).erro) || "Não foi possível trocar" });
    form.reset();
    setMsg({ ok: true, texto: "Senha trocada. Outras sessões abertas foram encerradas." });
  }

  return (
    <form onSubmit={salvar} className="card space-y-3 p-4">
      <h2 className="text-sm font-semibold">Trocar minha senha</h2>
      <div>
        <label className="label">Senha atual</label>
        <input name="atual" type="password" required autoComplete="current-password" className="input" />
      </div>
      <div>
        <label className="label">Nova senha</label>
        <input name="nova" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      <div>
        <label className="label">Repita a nova senha</label>
        <input name="repetir" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-rose-600"}`}>{msg.texto}</p>}
      <button className="btn-primary w-full" disabled={salvando}>{salvando ? "Salvando…" : "Trocar senha"}</button>
    </form>
  );
}
