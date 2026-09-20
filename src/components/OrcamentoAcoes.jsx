"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MOTIVOS_REJEICAO, brl } from "@/lib/constantes";

/** Fecha o orçamento como aceito ou rejeitado — a rejeição sempre exige motivo. */
export default function OrcamentoAcoes({ orcamento, compacto = false }) {
  const router = useRouter();
  const [dialogo, setDialogo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [concorrente, setConcorrente] = useState("");
  const [precoConcorrente, setPreco] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function patch(body) {
    setOcupado(true);
    const r = await fetch(`/api/orcamentos/${orcamento.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setOcupado(false);
    if (r.ok) { setDialogo(false); router.refresh(); }
  }

  const fechado = ["ACEITO", "REJEITADO", "EXPIRADO"].includes(orcamento.status);
  if (fechado) return null;

  return (
    <>
      <div className={`flex gap-2 ${compacto ? "" : "justify-end"}`}>
        {orcamento.status === "RASCUNHO" && (
          <button className="btn-ghost" disabled={ocupado} onClick={() => patch({ status: "ENVIADO" })}>Marcar enviado</button>
        )}
        <button className="btn-primary" disabled={ocupado} onClick={() => patch({ status: "ACEITO" })}>Aceito</button>
        <button className="btn-danger" disabled={ocupado} onClick={() => setDialogo(true)}>Rejeitado</button>
      </div>

      {dialogo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="card w-full max-w-md p-5">
            <h3 className="text-lg font-semibold">Registrar rejeição</h3>
            <p className="mt-1 text-sm text-slate-500">
              Orçamento #{orcamento.numero} · {brl(orcamento.total)}. O motivo alimenta o relatório de perdas.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="label">Motivo *</label>
                <select className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                  <option value="">Selecione…</option>
                  {MOTIVOS_REJEICAO.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                {motivo && (
                  <p className="mt-1 text-xs text-emerald-700">
                    Ação sugerida: {MOTIVOS_REJEICAO.find((m) => m.id === motivo)?.acao}
                  </p>
                )}
              </div>

              {["PRECO", "CONCORRENCIA"].includes(motivo) && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Concorrente</label>
                    <input className="input" value={concorrente} onChange={(e) => setConcorrente(e.target.value)} placeholder="Drogaria X" />
                  </div>
                  <div>
                    <label className="label">Preço praticado (R$)</label>
                    <input className="input" type="number" step="0.01" value={precoConcorrente} onChange={(e) => setPreco(e.target.value)} />
                  </div>
                </div>
              )}

              <div>
                <label className="label">Detalhe</label>
                <textarea className="input" rows={2} value={detalhe} onChange={(e) => setDetalhe(e.target.value)} placeholder="O que o cliente falou…" />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setDialogo(false)}>Cancelar</button>
              <button
                className="btn-danger"
                disabled={!motivo || ocupado}
                onClick={() => patch({ status: "REJEITADO", motivoRejeicao: motivo, detalheRejeicao: detalhe, concorrente, precoConcorrente })}
              >
                Confirmar rejeição
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
