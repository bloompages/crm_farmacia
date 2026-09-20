"use client";
import { useState } from "react";
import { brl } from "@/lib/constantes";
import { GRAFICO } from "@/lib/tema";

/* As cores vêm do tema (src/lib/tema.js) — os gráficos usam os MESMOS hues dos
   chips e botões da interface, para não haver "duas paletas" na mesma tela. */
export const COR = GRAFICO;
const RAMPA_FUNIL = GRAFICO.rampa;

const compacto = (v) =>
  Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `R$ ${Math.round(v)}`;

function Legenda({ itens }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: COR.secundario }}>
      {itens.map((i) => (
        <span key={i.rotulo} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.cor }} />
          {i.rotulo}
        </span>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Resultado por semana — colunas divergentes: ganho acima da linha zero,
   perdido abaixo. A posição carrega a polaridade; a cor reforça.
--------------------------------------------------------------------------- */
export function GraficoResultado({ dados }) {
  const [ativo, setAtivo] = useState(null);
  const [tabela, setTabela] = useState(false);

  const L = 62, R = 12, T = 16, B = 26, W = 720, H = 260;
  const plotW = W - L - R;
  const plotH = H - T - B;
  const zero = T + plotH / 2;
  const max = Math.max(1, ...dados.map((d) => Math.max(d.ganho, d.perdido)));
  const escala = (v) => (v / max) * (plotH / 2 - 8);
  const banda = plotW / dados.length;
  const larg = Math.min(24, banda * 0.46);
  const ultima = dados.length - 1;

  const colunaCima = (x, y0, y1, w) => {
    const r = Math.min(4, Math.max(0, y0 - y1));
    return `M${x},${y0} L${x},${y1 + r} Q${x},${y1} ${x + r},${y1} L${x + w - r},${y1} Q${x + w},${y1} ${x + w},${y1 + r} L${x + w},${y0} Z`;
  };
  const colunaBaixo = (x, y0, y1, w) => {
    const r = Math.min(4, Math.max(0, y1 - y0));
    return `M${x},${y0} L${x},${y1 - r} Q${x},${y1} ${x + r},${y1} L${x + w - r},${y1} Q${x + w},${y1} ${x + w},${y1 - r} L${x + w},${y0} Z`;
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Legenda itens={[{ rotulo: "Ganho", cor: COR.ganho }, { rotulo: "Perdido", cor: COR.perda }]} />
        <button className="text-xs text-slate-500 underline decoration-slate-300 hover:text-slate-700" onClick={() => setTabela((t) => !t)}>
          {tabela ? "ver gráfico" : "ver dados"}
        </button>
      </div>

      {tabela ? (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr><th className="py-1.5 font-medium">Semana</th><th className="py-1.5 font-medium">Ganho</th><th className="py-1.5 font-medium">Perdido</th><th className="py-1.5 font-medium">Saldo</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100" style={{ fontVariantNumeric: "tabular-nums" }}>
            {dados.map((d) => (
              <tr key={d.rotulo}>
                <td className="py-1.5 text-slate-600">{d.periodo}</td>
                <td className="py-1.5">{brl(d.ganho)}</td>
                <td className="py-1.5">{brl(d.perdido)}</td>
                <td className="py-1.5 font-medium">{brl(d.ganho - d.perdido)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Ganho e perda por semana">
            {[1, 0.5, 0, -0.5, -1].map((f) => {
              const y = zero - escala(max * f);
              return (
                <g key={f}>
                  <line x1={L} x2={W - R} y1={y} y2={y} stroke={f === 0 ? COR.eixo : COR.grade} strokeWidth="1" />
                  <text x={L - 8} y={y + 3.5} textAnchor="end" fontSize="10" fill={COR.mudo} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {f === 0 ? "0" : compacto(max * Math.abs(f))}
                  </text>
                </g>
              );
            })}

            {dados.map((d, i) => {
              const x = L + i * banda + (banda - larg) / 2;
              const yG = zero - escala(d.ganho);
              const yP = zero + escala(d.perdido);
              return (
                <g key={d.rotulo}>
                  <rect
                    x={L + i * banda} y={T} width={banda} height={plotH}
                    fill={ativo === i ? COR.tinta : "transparent"} fillOpacity={ativo === i ? 0.04 : 0}
                    onMouseEnter={() => setAtivo(i)} onMouseLeave={() => setAtivo(null)}
                  />
                  {d.ganho > 0 && <path d={colunaCima(x, zero, yG, larg)} fill={COR.ganho} pointerEvents="none" />}
                  {d.perdido > 0 && <path d={colunaBaixo(x, zero, yP, larg)} fill={COR.perda} pointerEvents="none" />}
                  <text x={L + i * banda + banda / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={COR.mudo} pointerEvents="none">
                    {d.rotulo}
                  </text>
                  {i === ultima && d.ganho > 0 && (
                    <text x={x + larg / 2} y={yG - 6} textAnchor="middle" fontSize="10" fontWeight="600" fill={COR.secundario} pointerEvents="none">
                      {compacto(d.ganho)}
                    </text>
                  )}
                  {i === ultima && d.perdido > 0 && (
                    <text x={x + larg / 2} y={yP + 13} textAnchor="middle" fontSize="10" fontWeight="600" fill={COR.secundario} pointerEvents="none">
                      {compacto(d.perdido)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {ativo !== null && (
            <div
              className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-lg"
              style={{ left: `${Math.min(72, ((ativo + 0.5) / dados.length) * 100)}%` }}
            >
              <div className="font-medium text-slate-800">{dados[ativo].periodo}</div>
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <span className="h-2 w-2 rounded-sm" style={{ background: COR.ganho }} />Ganho
                  </span>
                  <span className="font-medium text-slate-800">{brl(dados[ativo].ganho)} <span className="text-slate-400">({dados[ativo].qtdGanho})</span></span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <span className="h-2 w-2 rounded-sm" style={{ background: COR.perda }} />Perdido
                  </span>
                  <span className="font-medium text-slate-800">{brl(dados[ativo].perdido)} <span className="text-slate-400">({dados[ativo].qtdPerdido})</span></span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Barra horizontal genérica: comprimento carrega a magnitude, ponta arredondada
   de 4px, rótulo direto na ponta.
--------------------------------------------------------------------------- */
function Barras({ linhas, max, dica }) {
  const [ativo, setAtivo] = useState(null);
  return (
    <ul className="space-y-2">
      {linhas.map((l, i) => (
        <li
          key={l.id}
          className="relative"
          onMouseEnter={() => setAtivo(i)}
          onMouseLeave={() => setAtivo(null)}
        >
          <div className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-xs" style={{ color: COR.secundario }} title={l.label}>
              {l.label}
            </span>
            <span className="relative h-3 flex-1 rounded-sm" style={{ background: COR.trilha }}>
              <span
                className="absolute inset-y-0 left-0 rounded-r-[4px]"
                style={{ width: `${Math.max(1.5, (l.valor / max) * 100)}%`, background: l.cor }}
              />
            </span>
            <span className="w-28 shrink-0 text-right text-xs font-medium" style={{ color: COR.tinta, fontVariantNumeric: "tabular-nums" }}>
              {l.rotuloValor}
            </span>
          </div>
          {ativo === i && dica && (
            <div className="absolute right-0 top-6 z-10 w-64 rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-lg">
              {dica(l)}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Funil: rampa ordinal verde nas etapas em progressão; perdido em rosa (negativo). */
export function GraficoFunil({ etapas }) {
  const max = Math.max(1, ...etapas.map((e) => e.total));
  const emOrdem = etapas.filter((e) => e.id !== "PERDIDO");
  const perdido = etapas.find((e) => e.id === "PERDIDO");

  const linhas = emOrdem.map((e, i) => ({
    id: e.id,
    label: e.label,
    valor: e.total,
    cor: RAMPA_FUNIL[Math.min(i, RAMPA_FUNIL.length - 1)],
    rotuloValor: `${e.total} lead${e.total === 1 ? "" : "s"}`,
    aberto: e.valor,
  }));
  if (perdido) {
    linhas.push({
      id: perdido.id, label: perdido.label, valor: perdido.total, cor: COR.perda,
      rotuloValor: `${perdido.total} lead${perdido.total === 1 ? "" : "s"}`, aberto: 0,
    });
  }

  return (
    <Barras
      linhas={linhas}
      max={max}
      dica={(l) => (
        <>
          <div className="font-medium text-slate-800">{l.label}</div>
          <div className="mt-1 text-slate-500">
            {l.valor} lead(s){l.aberto > 0 && <> · {brl(l.aberto)} em orçamentos abertos</>}
          </div>
        </>
      )}
    />
  );
}

/** Perda por motivo: barras ranqueadas em um único vermelho (o da perda). */
export function GraficoMotivos({ motivos, total }) {
  if (!motivos.length) return <p className="text-sm text-slate-400">Nenhuma rejeição registrada no período.</p>;
  const max = Math.max(...motivos.map((m) => m.valor));
  return (
    <Barras
      linhas={motivos.map((m) => ({
        id: m.id, label: m.label, valor: m.valor, cor: COR.perda,
        rotuloValor: brl(m.valor), quantidade: m.quantidade, acao: m.acao, gap: m.gapMedio,
        share: (m.valor / (total || 1)) * 100,
      }))}
      max={max}
      dica={(l) => (
        <>
          <div className="font-medium text-slate-800">{l.label}</div>
          <div className="mt-1 text-slate-500">
            {l.quantidade} orçamento(s) · {l.share.toFixed(0)}% da perda
            {l.gap !== null && l.gap !== undefined && <> · gap médio {brl(l.gap)}</>}
          </div>
          <div className="mt-1.5 text-emerald-700">{l.acao}</div>
        </>
      )}
    />
  );
}

/** Origem dos leads: ênfase — o canal líder na cor da marca, os demais em cinza. */
export function GraficoOrigens({ origens }) {
  if (!origens.length) return <p className="text-sm text-slate-400">Nenhum lead novo no período.</p>;
  const max = Math.max(...origens.map((o) => o.total));
  return (
    <Barras
      linhas={origens.map((o) => ({
        id: o.origem,
        label: o.origem.charAt(0) + o.origem.slice(1).toLowerCase(),
        valor: o.total,
        cor: o.total === max ? COR.ganho : COR.neutro,
        rotuloValor: `${o.total}`,
      }))}
      max={max}
      dica={(l) => <div className="text-slate-600">{l.valor} lead(s) captado(s) por {l.label.toLowerCase()}</div>}
    />
  );
}
