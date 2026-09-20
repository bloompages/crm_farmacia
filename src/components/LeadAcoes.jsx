"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ETAPAS, MOTIVOS_REJEICAO } from "@/lib/constantes";

export default function LeadAcoes({ lead }) {
  const router = useRouter();
  const [etapa, setEtapa] = useState(lead.etapa);
  const [motivo, setMotivo] = useState(lead.motivoPerda ?? "");
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function patch(body) {
    setOcupado(true);
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setOcupado(false);
    router.refresh();
  }

  return (
    <div className="card space-y-4 p-4">
      <div>
        <label className="label">Etapa do funil</label>
        <select
          className="input"
          value={etapa}
          disabled={ocupado}
          onChange={(e) => {
            const nova = e.target.value;
            setEtapa(nova);
            if (nova !== "PERDIDO") patch({ etapa: nova });
          }}
        >
          {ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
      </div>

      {etapa === "PERDIDO" && (
        <div>
          <label className="label">Motivo da perda *</label>
          <select className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            <option value="">Selecione…</option>
            {MOTIVOS_REJEICAO.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <button
            className="btn-danger mt-2 w-full"
            disabled={!motivo || ocupado}
            onClick={() => patch({ etapa: "PERDIDO", motivoPerda: motivo })}
          >
            Marcar como perdido
          </button>
        </div>
      )}

      <div>
        <label className="label">Registrar interação</label>
        <textarea
          className="input"
          rows={3}
          value={nota}
          placeholder="Ligou pedindo desconto no manipulado…"
          onChange={(e) => setNota(e.target.value)}
        />
        <button
          className="btn-ghost mt-2 w-full"
          disabled={!nota.trim() || ocupado}
          onClick={async () => { await patch({ nota }); setNota(""); }}
        >
          Adicionar à timeline
        </button>
      </div>
    </div>
  );
}
