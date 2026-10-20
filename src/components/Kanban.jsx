"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ETAPAS, MOTIVOS_REJEICAO, ORIGENS, brl, tempoRelativo } from "@/lib/constantes";
import { PONTO_TEMPERATURA as TEMP, TOM, chipFiltro } from "@/lib/tema";
import { formatarTelefone } from "@/lib/telefone";
import { paraBusca } from "@/lib/busca";

const PERIODOS = [
  { id: "", rotulo: "Qualquer data" },
  { id: "0", rotulo: "Entraram hoje" },
  { id: "7", rotulo: "Últimos 7 dias" },
  { id: "30", rotulo: "Últimos 30 dias" },
  { id: "90", rotulo: "Últimos 90 dias" },
];

const iniciais = (nome) => (nome ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

/** Valor que a coluna soma: aprovado no Aprovado, em aberto nas demais. */
const valorDoCard = (l) => (l.etapa === "APROVADO" ? l.valorAprovado ?? 0 : l.valorAberto);

export default function Kanban({ leadsIniciais, equipe = [] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(leadsIniciais);
  const [busca, setBusca] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [origem, setOrigem] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [confirmando, setConfirmando] = useState(null); // id do lead com "Confirmar venda" em andamento
  const [arrastando, setArrastando] = useState(null);
  const [sobre, setSobre] = useState(null);
  const [perda, setPerda] = useState(null); // { leadId, nome } aguardando o motivo
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");

  const etiquetas = useMemo(() => [...new Set(leads.flatMap((l) => l.etiquetas))].sort(), [leads]);

  // todos os filtros, menos o de origem: as contagens dos chips de origem respeitam o resto
  const semOrigem = useMemo(() => {
    const termo = paraBusca(busca);
    const digitos = busca.replace(/\D/g, "");
    let desde = null;
    if (periodo !== "") {
      desde = new Date();
      desde.setHours(0, 0, 0, 0);
      desde.setDate(desde.getDate() - Number(periodo));
    }
    return leads.filter((l) =>
      (!termo || paraBusca(l.nome).includes(termo) || (digitos.length >= 4 && (l.telefone ?? "").includes(digitos))) &&
      (!responsavel || (responsavel === "-" ? !l.responsavel : l.responsavel?.id === responsavel)) &&
      (!desde || new Date(l.criadoEm) >= desde) &&
      (!etiqueta || l.etiquetas.includes(etiqueta))
    );
  }, [leads, busca, responsavel, periodo, etiqueta]);
  const visiveis = origem ? semOrigem.filter((l) => l.origem === origem) : semOrigem;
  const porOrigem = ORIGENS.map((o) => ({ id: o, total: semOrigem.filter((l) => l.origem === o).length })).filter((o) => o.total > 0);
  const filtrando = busca || responsavel || periodo || origem || etiqueta;

  function limpar() {
    setBusca(""); setResponsavel(""); setPeriodo(""); setOrigem(""); setEtiqueta("");
  }

  /** "R$ 52 — Confirmar venda": aprova o lead com o valor do orçamento em aberto (o orçamento vira aceito). */
  async function confirmarVenda(l) {
    setConfirmando(l.id);
    await mover(l.id, {
      etapa: "APROVADO",
      valorAprovado: l.valorAberto,
      nota: `Venda confirmada no funil — ${brl(l.valorAberto)}.`,
    });
    setConfirmando(null);
  }

  function soltar(leadId, etapa) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.etapa === etapa) return;
    // nenhuma perda sem motivo: o card só muda de coluna depois de escolhido
    if (etapa === "PERDIDO") {
      setMotivo("");
      setPerda({ leadId, nome: lead.nome });
      return;
    }
    mover(leadId, { etapa });
  }

  async function mover(leadId, body) {
    const anterior = leads.find((l) => l.id === leadId)?.etapa;
    setErro("");
    setLeads((atual) => atual.map((l) => (l.id === leadId ? { ...l, etapa: body.etapa } : l)));
    const r = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!r?.ok) {
      setLeads((atual) => atual.map((l) => (l.id === leadId ? { ...l, etapa: anterior } : l)));
      setErro((r && (await r.json().catch(() => ({}))).erro) || "Não foi possível mover o lead. Tente de novo.");
      return;
    }
    const salvo = await r.json().catch(() => ({}));
    setLeads((atual) => atual.map((l) => (l.id === leadId ? { ...l, valorAprovado: salvo.valorAprovado ?? l.valorAprovado, valorAberto: salvo.etapa === "APROVADO" || salvo.etapa === "PERDIDO" ? 0 : l.valorAberto } : l)));
    router.refresh();
  }

  return (
    <>
    <div className="card flex flex-wrap items-center gap-2 p-3">
      <input className="input w-56" placeholder="Buscar nome ou telefone…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <select className="input w-auto" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} aria-label="Responsável">
        <option value="">Todos os responsáveis</option>
        <option value="-">Sem responsável</option>
        {equipe.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
      </select>
      <select className="input w-auto" value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Período de entrada">
        {PERIODOS.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
      </select>
      {etiquetas.length > 0 && (
        <select className="input w-auto" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} aria-label="Etiqueta">
          <option value="">Todas as etiquetas</option>
          {etiquetas.map((e) => <option key={e} value={e}># {e}</option>)}
        </select>
      )}
      {filtrando && <button onClick={limpar} className="text-xs text-slate-500 underline">limpar filtros</button>}
      <div className="flex w-full flex-wrap gap-1">
        <button onClick={() => setOrigem("")} className={`chip ${chipFiltro(!origem)}`}>todas <b>{semOrigem.length}</b></button>
        {porOrigem.map((o) => (
          <button key={o.id} onClick={() => setOrigem(o.id)} className={`chip ${chipFiltro(origem === o.id)}`}>
            {o.id.toLowerCase()} <span className="opacity-60">{o.total}</span>
          </button>
        ))}
      </div>
    </div>
    {erro && <p className="text-sm text-rose-600">{erro}</p>}
    <div className="flex gap-3 overflow-x-auto pb-4">
      {ETAPAS.map((etapa) => {
        const daEtapa = visiveis.filter((l) => l.etapa === etapa.id);
        const valor = daEtapa.reduce((t, l) => t + valorDoCard(l), 0);
        return (
          <div
            key={etapa.id}
            onDragOver={(e) => { e.preventDefault(); setSobre(etapa.id); }}
            onDragLeave={() => setSobre((s) => (s === etapa.id ? null : s))}
            onDrop={(e) => { e.preventDefault(); setSobre(null); if (arrastando) soltar(arrastando, etapa.id); }}
            className={`w-72 shrink-0 rounded-xl border p-2 transition ${
              sobre === etapa.id ? "border-emerald-400 bg-emerald-50/60" : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="mb-1 flex items-center justify-between px-1.5 py-1">
              <span className={`chip ${etapa.cor}`}>{etapa.label}</span>
              <span className="rounded-full bg-white px-2 text-xs font-semibold text-slate-600 shadow-sm" style={{ fontVariantNumeric: "tabular-nums" }}>{daEtapa.length}</span>
            </div>
            <div className="mb-2 h-4 px-1.5 text-xs text-slate-500" style={{ fontVariantNumeric: "tabular-nums" }}>
              {etapa.id !== "PERDIDO" && `${brl(valor)} ${etapa.id === "APROVADO" ? "aprovado" : "em aberto"}`}
            </div>

            <div className="space-y-2">
              {daEtapa.map((l) => (
                <div
                  key={l.id}
                  draggable
                  onDragStart={() => setArrastando(l.id)}
                  onDragEnd={() => setArrastando(null)}
                  className={`cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing ${
                    arrastando === l.id ? "opacity-40" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TEMP[l.temperatura]}`} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/leads/${l.id}`} className="block truncate text-sm font-medium text-slate-800 hover:text-emerald-700">
                        {l.nome}
                      </Link>
                      {l.telefone && <div className="truncate text-xs text-slate-500">{formatarTelefone(l.telefone)}</div>}
                      <div className="truncate text-xs text-slate-400">
                        {l.origem.toLowerCase()} · score {l.score}
                      </div>
                      {l.etiquetas.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {l.etiquetas.slice(0, 3).map((e) => <span key={e} className={`chip ${TOM.neutroClaro} py-0 text-[10px]`}># {e}</span>)}
                          {l.etiquetas.length > 3 && <span className="text-[10px] text-slate-400">+{l.etiquetas.length - 3}</span>}
                        </div>
                      )}
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
                        <span title="Último contato">{tempoRelativo(l.ultimoContatoEm)}</span>
                        {l.etapa === "APROVADO" && l.valorAprovado > 0 ? (
                          <span className="font-medium text-emerald-700">{brl(l.valorAprovado)} aprovado</span>
                        ) : l.valorAberto > 0 ? (
                          <span className="font-medium text-amber-600">{brl(l.valorAberto)}</span>
                        ) : null}
                        <span
                          className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-semibold text-slate-600"
                          title={l.responsavel ? `Responsável: ${l.responsavel.nome}` : "Sem responsável"}
                        >
                          {l.responsavel ? iniciais(l.responsavel.nome) : "–"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {l.etapa === "ORCAMENTO" && l.valorAberto > 0 && (
                    <button
                      type="button"
                      onClick={() => confirmarVenda(l)}
                      disabled={confirmando === l.id}
                      className="btn-primary mt-2 w-full py-1.5 text-xs"
                      title="Marca como aprovado: o orçamento em aberto vira aceito com este valor"
                    >
                      {confirmando === l.id ? "Confirmando…" : `${brl(l.valorAberto)} — Confirmar venda`}
                    </button>
                  )}
                </div>
              ))}
              {daEtapa.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-300">
                  {filtrando ? "nenhum lead neste filtro" : "arraste um lead aqui"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>

    {perda && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
        <form
          className="card w-full max-w-sm p-5"
          onSubmit={(e) => {
            e.preventDefault();
            mover(perda.leadId, { etapa: "PERDIDO", motivoPerda: motivo });
            setPerda(null);
          }}
        >
          <h2 className="text-lg font-semibold">Marcar como perdido</h2>
          <p className="mb-4 text-sm text-slate-500">{perda.nome} — orçamentos em aberto serão rejeitados com este motivo.</p>
          <label className="label">Motivo da perda *</label>
          <select className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus>
            <option value="">Selecione…</option>
            {MOTIVOS_REJEICAO.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setPerda(null)}>Cancelar</button>
            <button className="btn-danger" disabled={!motivo}>Marcar como perdido</button>
          </div>
        </form>
      </div>
    )}
    </>
  );
}
