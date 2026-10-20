"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ORIGENS, dataCurta, labelMotivo } from "@/lib/constantes";
import { formatarTelefone } from "@/lib/telefone";

const paraInputData = (d) => {
  if (!d) return "";
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

/** Idade a partir da data de nascimento (só se fizer sentido). */
function idade(d) {
  if (!d) return null;
  const n = new Date(d);
  const hoje = new Date();
  let a = hoje.getFullYear() - n.getFullYear();
  if (hoje < new Date(hoje.getFullYear(), n.getMonth(), n.getDate())) a--;
  return a > 0 && a < 120 ? a : null;
}

/** Ficha do lead com edição dos dados cadastrais (inclui "corrigir número"). */
export default function LeadFicha({ lead, editavel = true }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [duplicado, setDuplicado] = useState(null);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    setDuplicado(null);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    }).catch(() => null);
    setSalvando(false);
    if (!r?.ok) {
      const json = (r && (await r.json().catch(() => ({})))) || {};
      setDuplicado(r?.status === 409 ? json.leadId : null);
      return setErro(json.erro || "Não foi possível salvar");
    }
    setEditando(false);
    router.refresh();
  }

  if (editando) {
    return (
      <form onSubmit={salvar} className="card space-y-3 p-4 text-sm">
        <h2 className="text-sm font-semibold">Editar ficha</h2>
        <div><label className="label">Nome *</label><input name="nome" required defaultValue={lead.nome} className="input" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">WhatsApp</label><input name="telefone" defaultValue={formatarTelefone(lead.telefone) ?? ""} className="input" inputMode="tel" /></div>
          <div><label className="label">E-mail</label><input name="email" type="email" defaultValue={lead.email ?? ""} className="input" /></div>
          <div><label className="label">CPF/CNPJ</label><input name="documento" defaultValue={lead.documento ?? ""} className="input" /></div>
          <div><label className="label">Aniversário</label><input name="dataNascimento" type="date" defaultValue={paraInputData(lead.dataNascimento)} className="input" /></div>
          <div><label className="label">Convênio / plano</label><input name="convenio" defaultValue={lead.convenio ?? ""} className="input" /></div>
          <div><label className="label">Empresa</label><input name="empresa" defaultValue={lead.empresa ?? ""} className="input" /></div>
          <div>
            <label className="label">Tipo</label>
            <select name="tipo" defaultValue={lead.tipo} className="input">
              <option value="PF">Pessoa física</option>
              <option value="PJ">PJ</option>
            </select>
          </div>
          <div>
            <label className="label">Origem</label>
            <select name="origem" defaultValue={lead.origem} className="input">
              {ORIGENS.map((o) => <option key={o} value={o}>{o.toLowerCase()}</option>)}
            </select>
          </div>
        </div>
        <div><label className="label">Interesses</label><input name="interesses" defaultValue={lead.interesses} className="input" /></div>
        <div><label className="label">Observações</label><textarea name="observacoes" rows={3} defaultValue={lead.observacoes ?? ""} className="input" /></div>
        {erro && (
          <p className="text-sm text-rose-600">
            {erro}
            {duplicado && <> — <Link href={`/leads/${duplicado}`} className="underline">abrir ficha</Link></>}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => setEditando(false)}>Cancelar</button>
          <button className="btn-primary" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    );
  }

  const anos = idade(lead.dataNascimento);
  const linha = (rotulo, valor, classe = "") => (
    <div className="flex justify-between gap-3"><dt className="text-slate-400">{rotulo}</dt><dd className={`truncate text-right ${classe}`}>{valor || "—"}</dd></div>
  );

  return (
    <div className="card p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Ficha</h2>
        {editavel && <button onClick={() => setEditando(true)} className="text-xs text-emerald-700 hover:underline">editar</button>}
      </div>
      <dl className="space-y-1.5 text-slate-600">
        {linha("Responsável", lead.responsavel?.nome)}
        {linha("Tipo", lead.tipo)}
        {linha("CPF/CNPJ", lead.documento)}
        {linha("Aniversário", lead.dataNascimento && `${new Date(lead.dataNascimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}${anos ? ` · ${anos} anos` : ""}`)}
        {linha("Convênio", lead.convenio)}
        {linha("Empresa", lead.empresa)}
        {linha("Interesses", lead.interesses)}
        {linha("Último contato", dataCurta(lead.ultimoContatoEm))}
        {lead.motivoPerda && linha("Motivo da perda", labelMotivo(lead.motivoPerda), "text-rose-600")}
      </dl>
      {lead.observacoes && <p className="msg-corpo mt-3 border-t border-slate-100 pt-3 text-slate-600">{lead.observacoes}</p>}
    </div>
  );
}
