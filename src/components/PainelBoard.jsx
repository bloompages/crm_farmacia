"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { chipFiltro } from "@/lib/tema";

/**
 * Painel em formato de quadro (estilo Trello): os indicadores e gráficos são
 * cartões distribuídos em listas; o usuário arrasta para reordenar ou mover de
 * lista, recolhe cartões e escolhe quantas listas quer. O arranjo fica salvo no
 * navegador (localStorage) — cada atendente monta o painel do seu jeito.
 *
 * `cartoes`: [{ id, titulo, descricao?, acao?, conteudo }] vindos do servidor.
 */
const CHAVE = "crm-painel-quadro-v1";
const OPCOES_COLUNAS = [2, 3, 4];

export default function PainelBoard({ cartoes, layoutPadrao }) {
  const porId = useMemo(() => Object.fromEntries(cartoes.map((c) => [c.id, c])), [cartoes]);
  const [colunas, setColunas] = useState(layoutPadrao);
  const [recolhidos, setRecolhidos] = useState({});
  const [carregado, setCarregado] = useState(false);
  const [arrastando, setArrastando] = useState(null);       // id do cartão
  const [alvo, setAlvo] = useState(null);                   // { coluna, indice }
  const arrastandoRef = useRef(null);

  // carrega o arranjo salvo; cartões novos (que não existiam quando salvou) entram na última lista
  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? "null");
      if (salvo?.colunas?.length) {
        const conhecidos = new Set(salvo.colunas.flat());
        const novas = salvo.colunas.map((c) => c.filter((id) => porId[id]));
        const faltando = cartoes.map((c) => c.id).filter((id) => !conhecidos.has(id));
        novas[novas.length - 1].push(...faltando);
        setColunas(novas);
        setRecolhidos(salvo.recolhidos ?? {});
      }
    } catch {}
    setCarregado(true);
  }, [cartoes, porId]);

  useEffect(() => {
    if (!carregado) return;
    try { localStorage.setItem(CHAVE, JSON.stringify({ colunas, recolhidos })); } catch {}
  }, [colunas, recolhidos, carregado]);

  function mudarQtdColunas(n) {
    setColunas((atual) => {
      const todos = atual.flat();
      const novas = Array.from({ length: n }, () => []);
      // redistribui mantendo a ordem: preenche coluna a coluna proporcionalmente
      const porColuna = Math.ceil(todos.length / n);
      todos.forEach((id, i) => novas[Math.min(n - 1, Math.floor(i / porColuna))].push(id));
      return novas;
    });
  }

  function restaurar() {
    setColunas(layoutPadrao);
    setRecolhidos({});
  }

  /* ---------------------------------------------------------------- drag & drop */
  function iniciar(e, id) {
    arrastandoRef.current = id;
    setArrastando(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }
  function terminar() {
    arrastandoRef.current = null;
    setArrastando(null);
    setAlvo(null);
  }
  function soltar(coluna, indice) {
    const id = arrastandoRef.current;
    if (!id) return;
    setColunas((atual) => {
      const semEle = atual.map((c) => c.filter((x) => x !== id));
      // se veio da mesma coluna e estava antes do ponto de inserção, o índice anda uma posição
      const origemCol = atual.findIndex((c) => c.includes(id));
      const origemIdx = origemCol >= 0 ? atual[origemCol].indexOf(id) : -1;
      let idx = indice;
      if (origemCol === coluna && origemIdx >= 0 && origemIdx < indice) idx -= 1;
      const nova = [...semEle[coluna]];
      nova.splice(Math.max(0, Math.min(idx, nova.length)), 0, id);
      semEle[coluna] = nova;
      return semEle;
    });
    terminar();
  }

  const grade = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" }[colunas.length] ?? "lg:grid-cols-3";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Arraste os cartões pelo título para reorganizar o painel.</span>
        <span className="ml-auto flex items-center gap-1">
          <span className="mr-1">listas:</span>
          {OPCOES_COLUNAS.map((n) => (
            <button key={n} onClick={() => mudarQtdColunas(n)} className={`chip ${chipFiltro(colunas.length === n)}`}>{n}</button>
          ))}
          <button onClick={restaurar} className="chip border-slate-200 bg-white text-slate-500 hover:bg-slate-50">restaurar padrão</button>
        </span>
      </div>

      <div className={`grid gap-3 ${grade}`}>
        {colunas.map((ids, ci) => (
          <div
            key={ci}
            onDragOver={(e) => { e.preventDefault(); if (alvo?.coluna !== ci || alvo?.indice !== ids.length) setAlvo({ coluna: ci, indice: ids.length }); }}
            onDrop={(e) => { e.preventDefault(); soltar(ci, ids.length); }}
            className={`flex min-h-40 flex-col gap-3 rounded-xl border p-2 transition ${
              arrastando && alvo?.coluna === ci ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-slate-100/70"
            }`}
          >
            {ids.map((id, i) => {
              const c = porId[id];
              if (!c) return null;
              const recolhido = !!recolhidos[id];
              const marcador = arrastando && alvo?.coluna === ci && alvo?.indice === i && arrastando !== id;
              return (
                <div key={id} className="contents">
                  {marcador && <div className="h-1 rounded bg-emerald-400" />}
                  <section
                    draggable
                    onDragStart={(e) => iniciar(e, id)}
                    onDragEnd={terminar}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const r = e.currentTarget.getBoundingClientRect();
                      const metade = e.clientY < r.top + r.height / 2;
                      const indice = metade ? i : i + 1;
                      if (alvo?.coluna !== ci || alvo?.indice !== indice) setAlvo({ coluna: ci, indice });
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const r = e.currentTarget.getBoundingClientRect();
                      soltar(ci, e.clientY < r.top + r.height / 2 ? i : i + 1);
                    }}
                    className={`card overflow-hidden transition ${arrastando === id ? "opacity-40" : ""}`}
                  >
                    <header className="flex cursor-grab items-start gap-2 px-4 pt-3 pb-2 active:cursor-grabbing select-none">
                      <span className="mt-0.5 text-slate-300" aria-hidden>⠿</span>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-semibold text-slate-900">{c.titulo}</h2>
                        {c.descricao && !recolhido && <p className="text-xs text-slate-400">{c.descricao}</p>}
                      </div>
                      {c.acao && !recolhido && <div className="shrink-0">{c.acao}</div>}
                      <button
                        onClick={() => setRecolhidos((r) => ({ ...r, [id]: !r[id] }))}
                        className="shrink-0 rounded px-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        title={recolhido ? "Expandir" : "Recolher"}
                      >
                        {recolhido ? "▸" : "▾"}
                      </button>
                    </header>
                    {!recolhido && <div className="px-4 pb-4">{c.conteudo}</div>}
                  </section>
                </div>
              );
            })}
            {arrastando && alvo?.coluna === ci && alvo?.indice === ids.length && !ids.includes(arrastando) && (
              <div className="h-1 rounded bg-emerald-400" />
            )}
            {arrastando && alvo?.coluna === ci && alvo?.indice === ids.length && ids.includes(arrastando) && ids.at(-1) !== arrastando && (
              <div className="h-1 rounded bg-emerald-400" />
            )}
            {ids.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-xs text-slate-300">
                arraste um cartão aqui
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
