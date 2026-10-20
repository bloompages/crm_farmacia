"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { dataCurta } from "@/lib/constantes";

/** Consentimento de contato ativo e direitos do titular (LGPD art. 18). */
export default function LeadPrivacidade({ lead, gerente }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");

  async function chamar(url, opcoes) {
    setOcupado(true);
    setErro("");
    const r = await fetch(url, opcoes).catch(() => null);
    setOcupado(false);
    if (!r?.ok) {
      setErro((r && (await r.json().catch(() => ({}))).erro) || "Não foi possível concluir");
      return null;
    }
    return r;
  }

  async function consentimento(valor) {
    const r = await chamar(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consentimentoMarketing: valor }),
    });
    if (r) router.refresh();
  }

  async function anonimizar() {
    const r = await chamar(`/api/leads/${lead.id}/titular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmacao }),
    });
    if (r) { setConfirmando(false); router.refresh(); }
  }

  return (
    <div className="card space-y-3 p-4 text-sm">
      <h2 className="text-sm font-semibold">Privacidade (LGPD)</h2>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={lead.consentimentoMarketing}
          disabled={ocupado}
          onChange={(e) => consentimento(e.target.checked)}
        />
        <span>
          Autoriza contato ativo (lembrete de recompra, ofertas)
          {lead.consentimentoEm && (
            <span className="block text-xs text-slate-400">
              {lead.consentimentoMarketing ? "autorizado" : "retirado"} em {dataCurta(lead.consentimentoEm)}
            </span>
          )}
        </span>
      </label>

      {gerente && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500">Pedido do titular:</p>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/leads/${lead.id}/titular`} className="btn-ghost py-1">Exportar dados</a>
            {!confirmando && (
              <button type="button" className="btn-ghost py-1 text-rose-600" onClick={() => setConfirmando(true)}>
                Apagar dados pessoais
              </button>
            )}
          </div>
          {confirmando && (
            <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-slate-700">
              <p>
                Apaga nome, contatos, observações, conversas e anexos deste lead. Os orçamentos ficam sem identificação, para não
                distorcer os relatórios. <b>Não dá para desfazer.</b>
              </p>
              <p>Digite <b>APAGAR</b> para confirmar:</p>
              <input className="input py-1" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-ghost py-1" onClick={() => setConfirmando(false)}>Cancelar</button>
                <button type="button" className="btn-danger py-1" disabled={confirmacao !== "APAGAR" || ocupado} onClick={anonimizar}>
                  Apagar dados
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {erro && <p className="text-rose-600">{erro}</p>}
    </div>
  );
}
