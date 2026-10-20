"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { tempoRelativo } from "@/lib/constantes";

const PAPEIS = [
  { id: "ATENDENTE", label: "Atendente" },
  { id: "GERENTE", label: "Gerente" },
];

export default function GestaoEquipe({ usuarios, usuarioId }) {
  const router = useRouter();
  const [novo, setNovo] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function chamar(url, metodo, body) {
    setOcupado(true);
    setErro("");
    setAviso("");
    const r = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setOcupado(false);
    if (!r?.ok) {
      setErro((r && (await r.json().catch(() => ({}))).erro) || "Não foi possível salvar");
      return false;
    }
    router.refresh();
    return true;
  }

  async function criar(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form));
    if (await chamar("/api/usuarios", "POST", f)) {
      setAviso(`Usuário criado. Repasse a senha inicial à pessoa — ela pode trocar em "Minha conta".`);
      form.reset();
      setNovo(false);
    }
  }

  async function redefinir(u) {
    const senha = window.prompt(`Nova senha para ${u.nome} (mín. 8 caracteres):`);
    if (!senha) return;
    if (await chamar(`/api/usuarios/${u.id}`, "PATCH", { senha })) setAviso(`Senha de ${u.nome} redefinida; as sessões abertas dessa pessoa foram encerradas.`);
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <div>
          <h2 className="text-sm font-semibold">Equipe</h2>
          <p className="text-xs text-slate-500">Desativar alguém corta o acesso na hora. Só gerentes excluem registros e atendem pedidos de titulares.</p>
        </div>
        {!novo && <button className="btn-primary" onClick={() => setNovo(true)}>+ Usuário</button>}
      </div>

      {novo && (
        <form onSubmit={criar} className="grid gap-3 border-b border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">
          <div>
            <label className="label">Nome *</label>
            <input name="nome" required className="input" />
          </div>
          <div>
            <label className="label">E-mail *</label>
            <input name="email" type="email" required className="input" />
          </div>
          <div>
            <label className="label">Papel</label>
            <select name="papel" className="input" defaultValue="ATENDENTE">
              {PAPEIS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Cargo</label>
            <input name="cargo" className="input" placeholder="Balconista, farmacêutico(a)…" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Senha inicial * (mín. 8 caracteres)</label>
            <input name="senha" type="text" required minLength={8} autoComplete="off" className="input" />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-ghost" onClick={() => setNovo(false)}>Cancelar</button>
            <button className="btn-primary" disabled={ocupado}>Criar usuário</button>
          </div>
        </form>
      )}

      {(erro || aviso) && <p className={`px-4 pt-3 text-sm ${erro ? "text-rose-600" : "text-emerald-700"}`}>{erro || aviso}</p>}

      <ul className="divide-y divide-slate-100">
        {usuarios.map((u) => (
          <li key={u.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 text-sm ${u.ativo ? "" : "opacity-50"}`}>
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {u.nome} {u.id === usuarioId && <span className="text-xs font-normal text-slate-400">(você)</span>}
              </div>
              <div className="truncate text-xs text-slate-500">
                {u.email} · {u.cargo} · {u.semSenha ? <span className="text-amber-600">sem senha definida</span> : u.ultimoLoginEm ? `entrou ${tempoRelativo(u.ultimoLoginEm)}` : "nunca entrou"}
              </div>
            </div>
            <select
              className="input w-36 py-1"
              value={u.papel}
              disabled={ocupado}
              onChange={(e) => chamar(`/api/usuarios/${u.id}`, "PATCH", { papel: e.target.value })}
            >
              {PAPEIS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <button className="btn-ghost py-1" disabled={ocupado} onClick={() => redefinir(u)}>Redefinir senha</button>
            {u.id !== usuarioId && (
              <button
                className={`btn-ghost py-1 ${u.ativo ? "text-rose-600" : ""}`}
                disabled={ocupado}
                onClick={() => chamar(`/api/usuarios/${u.id}`, "PATCH", { ativo: !u.ativo })}
              >
                {u.ativo ? "Desativar" : "Reativar"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
