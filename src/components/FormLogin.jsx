"use client";
import { useState } from "react";

export default function FormLogin({ voltar }) {
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setEntrando(true);
    setErro("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    }).catch(() => null);
    if (!r?.ok) {
      setEntrando(false);
      return setErro(r ? (await r.json().catch(() => ({}))).erro ?? "Não foi possível entrar" : "Sem conexão com o CRM");
    }
    window.location.assign(voltar); // recarrega o layout já com o usuário
  }

  return (
    <form onSubmit={entrar} className="card space-y-3 p-5">
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="username" autoFocus className="input" />
      </div>
      <div>
        <label className="label" htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" required autoComplete="current-password" className="input" />
      </div>
      {erro && <p className="text-sm text-rose-600">{erro}</p>}
      <button className="btn-primary w-full" disabled={entrando}>{entrando ? "Entrando…" : "Entrar"}</button>
      <p className="text-center text-xs text-slate-400">Esqueceu a senha? Peça ao gerente para redefinir.</p>
    </form>
  );
}
