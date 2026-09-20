"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { dataHora, tempoRelativo, corEtapa, labelEtapa } from "@/lib/constantes";
import { CANAL, TOM, chipFiltro } from "@/lib/tema";
import { janela24h, rotuloRestante, aguardandoResposta, semRespostaHa24h, descreverMensagem, tipoVisual, nomeArquivo, extrairTotal, lerValorBR, formatarValorBR } from "@/lib/conversa";
import CorpoMensagem from "./CorpoMensagem";

const INTERVALO_MS = 8000;
const MAX_ESPERA_MS = 60000;

const SITUACOES = [
  { id: "TODAS", rotulo: "todas", filtro: () => true },
  { id: "MAIS24H", rotulo: "sem resposta +24h", filtro: (c) => semRespostaHa24h(c) },
];

export default function Inbox({ conversasIniciais, sincronizacaoInicial, selecionadaId, templateReabertura }) {
  const [conversas, setConversas] = useState(conversasIniciais);
  const [sinc, setSinc] = useState({ estado: "ok", ultimaEm: Date.now(), erro: null, proximaEm: null, info: sincronizacaoInicial });
  const [ativa, setAtiva] = useState(selecionadaId ?? conversasIniciais[0]?.id ?? null);
  const [situacao, setSituacao] = useState("TODAS");
  const [busca, setBusca] = useState("");
  const [agora, setAgora] = useState(Date.now());
  const falhasSeguidas = useRef(0);
  const timer = useRef(null);

  const conversa = conversas.find((c) => c.id === ativa);

  /* ------------------------------------------------------------------ sincronização */
  const atualizar = useCallback(async () => {
    setSinc((s) => ({ ...s, estado: s.estado === "erro" ? "erro" : "sincronizando" }));
    try {
      const r = await fetch(`/api/conversas${busca ? `?q=${encodeURIComponent(busca)}` : ""}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`servidor respondeu ${r.status}`);
      const json = await r.json();
      setConversas(json.conversas);
      falhasSeguidas.current = 0;
      setSinc({ estado: "ok", ultimaEm: Date.now(), erro: null, proximaEm: null, info: json.sincronizacao });
      return true;
    } catch (e) {
      falhasSeguidas.current += 1;
      const espera = Math.min(MAX_ESPERA_MS, INTERVALO_MS * 2 ** (falhasSeguidas.current - 1));
      setSinc((s) => ({ ...s, estado: "erro", erro: e?.message ?? "sem conexão", proximaEm: Date.now() + espera }));
      return false;
    }
  }, [busca]);

  // polling com backoff exponencial em caso de erro e pausa quando a aba está escondida
  useEffect(() => {
    let cancelado = false;
    const agendar = (ms) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        if (cancelado) return;
        if (document.visibilityState === "hidden") return agendar(INTERVALO_MS);
        const ok = await atualizar();
        agendar(ok ? INTERVALO_MS : Math.min(MAX_ESPERA_MS, INTERVALO_MS * 2 ** (falhasSeguidas.current - 1)));
      }, ms);
    };
    agendar(INTERVALO_MS);
    const aoVoltar = () => { if (document.visibilityState === "visible") agendar(200); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { cancelado = true; clearTimeout(timer.current); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [atualizar]);

  // relógio de 30s para "há X min" e contagem regressiva da janela de 24h
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // busca: refaz a consulta no servidor (debounce)
  useEffect(() => {
    const t = setTimeout(() => { atualizar(); }, 350);
    return () => clearTimeout(t);
  }, [busca, atualizar]);

  // marca como lida ao abrir
  useEffect(() => {
    if (conversa?.naoLidas > 0) {
      setConversas((lista) => lista.map((c) => (c.id === conversa.id ? { ...c, naoLidas: 0 } : c)));
      fetch(`/api/conversas/${conversa.id}/mensagens`, { method: "PATCH" }).catch(() => {});
    }
  }, [conversa?.id, conversa?.naoLidas]);

  /* ------------------------------------------------------------------ lista filtrada */
  const visiveis = useMemo(() => {
    const sit = SITUACOES.find((s) => s.id === situacao) ?? SITUACOES[0];
    return conversas.filter((c) => sit.filtro(c));
  }, [conversas, situacao, agora]);

  const contagem = useMemo(() => ({
    MAIS24H: conversas.filter((c) => semRespostaHa24h(c, agora)).length,
  }), [conversas, agora]);

  function aoMudarLead(conversaId, lead) {
    setConversas((lista) => lista.map((c) => (c.id === conversaId ? { ...c, lead: { ...c.lead, ...lead } } : c)));
  }

  function aoEnviar(mensagem) {
    setConversas((lista) => lista.map((c) => {
      if (c.id !== mensagem.conversaId) return c;
      const semEla = c.mensagens.filter((m) => m.id !== mensagem.id);
      return { ...c, mensagens: [...semEla, mensagem], ultimaMsgEm: mensagem.enviadoEm, naoLidas: 0 };
    }));
    atualizar();
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      <BarraSincronizacao sinc={sinc} agora={agora} aoAtualizar={atualizar} />

      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="card flex w-80 shrink-0 flex-col overflow-hidden">
          <div className="space-y-2 border-b border-slate-100 p-2">
            <input
              className="input py-1.5"
              placeholder="Buscar por nome, telefone ou texto…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {SITUACOES.map((s) => (
                <button key={s.id} onClick={() => setSituacao(s.id)} className={`chip ${chipFiltro(situacao === s.id)}`}>
                  {s.rotulo}
                  {s.id === "MAIS24H" && contagem.MAIS24H > 0 && <b className="font-semibold text-rose-600">{contagem.MAIS24H}</b>}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {visiveis.map((c) => {
              const ultima = c.mensagens.at(-1);
              const precisa = aguardandoResposta(c);
              const vencida = semRespostaHa24h(c, agora);
              return (
                <button
                  key={c.id}
                  onClick={() => setAtiva(c.id)}
                  className={`w-full border-b border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50 ${ativa === c.id ? "bg-emerald-50/60" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${CANAL[c.canal].ponto}`} title={CANAL[c.canal].rotulo} />
                    <span className="truncate text-sm font-medium text-slate-800">{c.nomeExibicao}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-slate-400">{tempoRelativo(c.ultimaMsgEm)}</span>
                    {c.naoLidas > 0 && (
                      <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 text-[11px] font-semibold text-white">{c.naoLidas}</span>
                    )}
                  </div>
                  <p className={`mt-1 truncate text-xs ${precisa ? "text-slate-700" : "text-slate-500"}`}>
                    {ultima?.direcao === "SAIDA" && <span className="text-slate-400">Você: </span>}
                    {descreverMensagem(ultima)}
                  </p>
                  {vencida && (
                    <p className="mt-1 text-[11px] font-medium text-rose-600">sem resposta há {rotuloRestante(agora - new Date(c.ultimaMsgClienteEm).getTime())} · janela de 24h fechada</p>
                  )}
                  {ultima?.status === "FALHOU" && (
                    <p className="mt-1 text-[11px] font-medium text-rose-600">última mensagem não foi enviada</p>
                  )}
                </button>
              );
            })}
            {visiveis.length === 0 && (
              <p className="p-4 text-sm text-slate-400">
                {conversas.length === 0 ? <>Nenhuma conversa. Rode <code className="rounded bg-slate-100 px-1">npm run simular</code>.</> : "Nenhuma conversa neste filtro."}
              </p>
            )}
          </div>
        </aside>

        <section className="card flex min-w-0 flex-1 flex-col overflow-hidden">
          {!conversa ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">Selecione uma conversa</div>
          ) : (
            <Conversa
              key={conversa.id}
              conversa={conversa}
              agora={agora}
              templateReabertura={templateReabertura}
              aoEnviar={aoEnviar}
              aoMudarLead={aoMudarLead}
            />
          )}
        </section>
      </div>
    </div>
  );
}

/* ====================================================================== */

function BarraSincronizacao({ sinc, agora, aoAtualizar }) {
  const [reprocessando, setReprocessando] = useState(false);
  const info = sinc.info ?? {};
  const erros = info.eventosComErro ?? 0;
  const falhas = info.mensagensFalhas ?? 0;

  async function reprocessar() {
    setReprocessando(true);
    try {
      await fetch("/api/webhooks/eventos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ todos: true }) });
      await aoAtualizar();
    } finally {
      setReprocessando(false);
    }
  }

  const problema = sinc.estado === "erro" || erros > 0 || falhas > 0;
  const tom = sinc.estado === "erro" ? "aviso-negativo" : problema ? "aviso-atencao" : "aviso-neutro";
  const ponto = sinc.estado === "erro" ? "bg-rose-500" : problema ? "bg-amber-500" : sinc.estado === "sincronizando" ? "bg-emerald-400 animate-pulse" : "bg-emerald-500";

  return (
    <div className={`aviso ${tom} flex flex-wrap items-center gap-x-3 gap-y-1`}>
      <span className={`h-2 w-2 rounded-full ${ponto}`} />
      {sinc.estado === "erro" ? (
        <span>
          <b>Sem conexão com o CRM</b> ({sinc.erro}). Nova tentativa em {sinc.proximaEm ? `${Math.max(1, Math.round((sinc.proximaEm - Date.now()) / 1000))} s` : "instantes"}.
        </span>
      ) : (
        <span>
          Sincronizado <b>{tempoRelativo(sinc.ultimaEm)}</b>
          {info.ultimaRecebidaEm && <> · última mensagem recebida {tempoRelativo(info.ultimaRecebidaEm)}</>}
          {info.provedor && <> · provedor <b>{info.provedor}</b></>}
        </span>
      )}
      {erros > 0 && (
        <span>
          · <b>{erros}</b> evento(s) do WhatsApp/Instagram não entraram no CRM
        </span>
      )}
      {falhas > 0 && <span>· <b>{falhas}</b> resposta(s) não enviada(s) nas últimas 24h</span>}
      <span className="ml-auto flex gap-2">
        {erros > 0 && (
          <button onClick={reprocessar} disabled={reprocessando} className="font-medium underline decoration-current/40 hover:decoration-current">
            {reprocessando ? "reprocessando…" : "reprocessar agora"}
          </button>
        )}
        <button onClick={aoAtualizar} className="font-medium underline decoration-current/40 hover:decoration-current">atualizar</button>
      </span>
    </div>
  );
}

/* ====================================================================== */

function Conversa({ conversa, agora, templateReabertura, aoEnviar, aoMudarLead }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState(null);
  const [aprovando, setAprovando] = useState(false);
  const [erroAprovar, setErroAprovar] = useState(null);
  const [valorEditado, setValorEditado] = useState(null);   // null = usar o valor automático
  const [editandoValor, setEditandoValor] = useState(false);
  const [rascunhoValor, setRascunhoValor] = useState("");

  const etapaLead = conversa.lead?.etapa ?? null;
  const jaAprovado = etapaLead === "APROVADO";

  // Valor do botão: 1) editado pelo atendente, 2) já gravado no lead, 3) soma das linhas "Total" da conversa
  const total = useMemo(() => extrairTotal(conversa.mensagens), [conversa.mensagens]);
  const valorLead = conversa.lead?.valorAprovado ?? null;
  const valor = valorEditado ?? (jaAprovado && valorLead !== null ? valorLead : total.valor > 0 ? total.valor : valorLead);
  const temValor = valor !== null && valor !== undefined && valor > 0;

  function abrirEdicao() {
    setRascunhoValor(temValor ? formatarValorBR(valor) : "");
    setEditandoValor(true);
  }

  async function salvarValor() {
    const n = rascunhoValor.trim() === "" ? null : lerValorBR(rascunhoValor);
    if (rascunhoValor.trim() !== "" && (n === null || n < 0)) {
      setErroAprovar("Valor inválido. Use o formato 1.234,56.");
      return;
    }
    setErroAprovar(null);
    setValorEditado(n);
    setEditandoValor(false);
    // lead já aprovado: a edição vale na hora (atualiza o orçamento aceito)
    if (jaAprovado) await enviarAprovacao({ valorAprovado: n });
  }

  async function enviarAprovacao(extra) {
    if (!conversa.leadId || aprovando) return;
    setAprovando(true);
    setErroAprovar(null);
    try {
      const r = await fetch(`/api/leads/${conversa.leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extra),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.erro ?? `Falha ao aprovar (${r.status})`);
      aoMudarLead(conversa.id, { etapa: json.etapa, valorAprovado: json.valorAprovado });
      setValorEditado(null);
    } catch (e) {
      setErroAprovar(e?.message ?? "Falha ao aprovar");
    } finally {
      setAprovando(false);
    }
  }

  function aprovar() {
    const v = temValor ? valor : null;
    return enviarAprovacao({
      etapa: "APROVADO",
      valorAprovado: v,
      nota: `Aprovado pelo cliente na conversa de ${CANAL[conversa.canal].rotulo}${v ? ` — R$ ${formatarValorBR(v)}` : ""}.`,
    });
  }
  const fim = useRef(null);
  const areaRef = useRef(null);

  const janela = janela24h(conversa, agora);
  const whatsapp = conversa.canal === "WHATSAPP";

  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth" }); }, [conversa.mensagens.length]);

  // textarea cresce com o conteúdo (até ~8 linhas)
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(200, el.scrollHeight) + "px";
  }, [texto]);

  async function enviar(corpo) {
    setEnviando(true);
    setErroEnvio(null);
    try {
      const r = await fetch(`/api/conversas/${conversa.id}/mensagens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const json = await r.json().catch(() => ({}));
      if (json.mensagem) aoEnviar(json.mensagem);
      if (!r.ok) {
        setErroEnvio(json.erro ?? `Falha ao enviar (${r.status})`);
        return false;
      }
      aoEnviar(json);
      return true;
    } catch (e) {
      setErroEnvio(`Sem conexão com o CRM (${e?.message ?? "erro de rede"}). Sua mensagem não foi perdida — tente de novo.`);
      return false;
    } finally {
      setEnviando(false);
    }
  }

  async function enviarTexto(e) {
    e?.preventDefault();
    if (!texto.trim() || enviando) return;
    const ok = await enviar({ texto });
    if (ok) setTexto("");
  }

  function aoTeclar(e) {
    // Enter envia; Shift+Enter (ou Ctrl+Enter) quebra linha — como no WhatsApp Web
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      enviarTexto();
    }
  }

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{conversa.nomeExibicao}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${CANAL[conversa.canal].ponto}`} />
              {CANAL[conversa.canal].rotulo}
            </span>
            <span>·</span>
            <span>{conversa.contatoExterno}</span>
            <span>·</span>
            <ChipJanela janela={janela} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {etapaLead && <span className={`chip ${corEtapa(etapaLead)}`} title="Etapa do lead no funil">{labelEtapa(etapaLead)}</span>}
          {conversa.leadId && <Link href={`/leads/${conversa.leadId}`} className="btn-ghost">Ver lead</Link>}
          {conversa.leadId && (
            <Link href={`/orcamentos/novo?lead=${conversa.leadId}`} className="btn-ghost">+ Orçamento</Link>
          )}
          {conversa.leadId && (
            <div className="inline-flex items-stretch overflow-hidden rounded-lg bg-emerald-600 text-white">
              {editandoValor ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); salvarValor(); }}
                  className="flex items-center gap-1 px-2"
                >
                  <span className="text-sm">R$</span>
                  <input
                    autoFocus
                    value={rascunhoValor}
                    onChange={(e) => setRascunhoValor(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") setEditandoValor(false); }}
                    placeholder="0,00"
                    inputMode="decimal"
                    className="w-28 rounded border border-emerald-300 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-200"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  />
                  <button type="submit" className="rounded px-2 py-1 text-sm font-medium hover:bg-emerald-700" title="Salvar valor">ok</button>
                  <button type="button" onClick={() => setEditandoValor(false)} className="rounded px-1.5 py-1 text-sm hover:bg-emerald-700" title="Cancelar">✕</button>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={aprovar}
                    disabled={aprovando || jaAprovado}
                    className="px-3 py-2 text-sm font-medium transition hover:bg-emerald-700 disabled:opacity-60 disabled:hover:bg-emerald-600"
                    title={jaAprovado ? "Este lead já está aprovado" : "Marca o lead como aprovado e o move para a etapa Aprovado no funil"}
                  >
                    {jaAprovado ? "✓ Aprovado" : aprovando ? "Aprovando…" : "✓ Aprovar"}
                    {temValor && <span className="ml-1.5" style={{ fontVariantNumeric: "tabular-nums" }}>R$ {formatarValorBR(valor)}</span>}
                  </button>
                  <button
                    type="button"
                    onClick={abrirEdicao}
                    disabled={aprovando}
                    className="border-l border-emerald-500 px-2 text-sm transition hover:bg-emerald-700"
                    title={temValor ? "Editar o valor" : "Informar o valor"}
                  >
                    ✎
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>
      {erroAprovar && <div className="aviso aviso-negativo mx-4 mt-3"><b>Não foi possível aprovar:</b> {erroAprovar}</div>}
      {conversa.leadId && !jaAprovado && total.itens.length > 0 && valorEditado === null && (
        <div className="aviso aviso-neutro mx-4 mt-3">
          Valor do botão calculado a partir de {total.itens.length === 1 ? "1 linha" : `${total.itens.length} linhas`} com "Total" na conversa
          {total.itens.length > 1 && <> (soma: {total.itens.map((i) => `R$ ${formatarValorBR(i.valor)}`).join(" + ")})</>}. Use ✎ para corrigir.
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
        {conversa.mensagens.map((m) => (
          <Balao key={m.id} m={m} aoReenviar={() => enviar({ reenviarId: m.id })} enviando={enviando} />
        ))}
        <div ref={fim} />
      </div>

      <form onSubmit={enviarTexto} className="space-y-2 border-t border-slate-100 p-3">
        {!janela.aberta && whatsapp && (
          <div className="aviso aviso-atencao flex flex-wrap items-center gap-2">
            <span>
              <b>Janela de 24h fechada</b>
              {janela.semMensagemDoCliente ? " — o cliente ainda não escreveu neste canal." : ` — o cliente não escreve há ${rotuloRestante(agora - new Date(conversa.ultimaMsgClienteEm).getTime())}.`}{" "}
              O WhatsApp só permite reabrir a conversa com um template aprovado; a conversa continua aqui até ele responder.
            </span>
            {templateReabertura && (
              <button
                type="button"
                disabled={enviando}
                onClick={() => enviar({ template: { nome: templateReabertura, idioma: "pt_BR" } })}
                className="btn-ghost ml-auto py-1"
              >
                Enviar template de reabertura
              </button>
            )}
          </div>
        )}
        {!janela.aberta && !whatsapp && !janela.semMensagemDoCliente && (
          <div className="aviso aviso-atencao">
            <b>Sem resposta há {rotuloRestante(agora - new Date(conversa.ultimaMsgClienteEm).getTime())}.</b> O Instagram pode recusar mensagens após 24h sem interação do cliente; a conversa continua listada aqui.
          </div>
        )}
        {erroEnvio && (
          <div className="aviso aviso-negativo">
            <b>Não foi enviada:</b> {erroEnvio}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={areaRef}
            rows={1}
            className="input resize-none leading-relaxed"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={aoTeclar}
            placeholder={`Responder por ${CANAL[conversa.canal].rotulo}… (Enter envia · Shift+Enter quebra linha)`}
          />
          <button className="btn-primary" disabled={enviando || !texto.trim()}>
            {enviando ? "Enviando…" : "Enviar"}
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          Parágrafos e quebras de linha são preservados. Formatação: *negrito*, _itálico_, ~riscado~.
        </p>
      </form>
    </>
  );
}

function ChipJanela({ janela }) {
  if (janela.semMensagemDoCliente) return <span className={`chip ${TOM.neutroClaro}`}>sem mensagem do cliente</span>;
  if (janela.aberta) {
    const urgente = janela.restanteMs < 3 * 3600 * 1000;
    return (
      <span className={`chip ${urgente ? TOM.atencao : TOM.marca}`} title="Janela de atendimento de 24h desde a última mensagem do cliente">
        janela de 24h · expira em {rotuloRestante(janela.restanteMs)}
      </span>
    );
  }
  return <span className={`chip ${TOM.negativo}`} title="Mais de 24h desde a última mensagem do cliente">janela de 24h fechada</span>;
}

/* ====================================================================== */

const STATUS_SAIDA = {
  ENVIANDO: { icone: "◌", titulo: "Enviando…" },
  ENVIADA: { icone: "✓", titulo: "Enviada" },
  ENTREGUE: { icone: "✓✓", titulo: "Entregue" },
  LIDA: { icone: "✓✓", titulo: "Lida", classe: "text-white" },
  FALHOU: { icone: "!", titulo: "Não enviada" },
};

function Balao({ m, aoReenviar, enviando }) {
  const saida = m.direcao === "SAIDA";
  const falhou = m.status === "FALHOU";
  const st = saida ? STATUS_SAIDA[m.status] ?? STATUS_SAIDA.ENVIADA : null;
  const visual = tipoVisual(m);
  const rotuloTipo = m.tipo && m.tipo !== "TEXTO" ? descreverMensagem({ ...m, texto: "" }).replace(/^\[|\]$/g, "") : null;

  return (
    <div className={`flex ${saida ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          falhou ? "border border-rose-300 bg-rose-50 text-slate-800" : saida ? "bg-emerald-600 text-white" : "bg-white text-slate-800"
        }`}
      >
        {visual && <Anexo m={m} visual={visual} saida={saida && !falhou} />}
        {!visual && rotuloTipo && <div className={`mb-1 text-xs ${saida && !falhou ? "text-emerald-100" : "text-slate-500"}`}>{rotuloTipo}</div>}
        <CorpoMensagem texto={m.texto} />
        {falhou && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-rose-700">
            <span><b>Não enviada.</b> {m.erro}</span>
            <button type="button" onClick={aoReenviar} disabled={enviando} className="font-medium underline">tentar de novo</button>
          </div>
        )}
        <div className={`mt-1 flex items-center justify-end gap-2 text-[11px] ${saida && !falhou ? "text-emerald-100" : "text-slate-400"}`}>
          {!saida && m.scoreIntencao >= 25 && (
            <span className={`chip ${TOM.atencao} mr-auto py-0`}>
              {m.intencao?.toLowerCase()} · {m.scoreIntencao}
            </span>
          )}
          <span>{dataHora(m.enviadoEm)}</span>
          {st && <span title={st.titulo} className={`font-semibold ${falhou ? "text-rose-600" : st.classe ?? ""}`}>{st.icone}</span>}
        </div>
      </div>
    </div>
  );
}

function Anexo({ m, visual, saida }) {
  const url = `/api/midia/${m.id}`;
  const nome = nomeArquivo(m);
  const tamanho = m.midiaTamanho ? ` · ${(m.midiaTamanho / 1024).toFixed(0)} KB` : "";
  const classeLink = saida ? "text-white" : "text-emerald-700";

  if (visual === "imagem") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mb-1 block">
        <img src={url} alt={m.midiaNome ?? "imagem recebida"} className="max-h-72 rounded-lg object-contain" loading="lazy" />
      </a>
    );
  }
  if (visual === "audio") return <audio controls preload="none" src={url} className="mb-1 max-w-full" />;
  if (visual === "video") return <video controls preload="metadata" src={url} className="mb-1 max-h-72 rounded-lg" />;
  if (visual === "mapa") {
    return (
      <a href={m.midiaUrl} target="_blank" rel="noopener noreferrer" className={`mb-1 block text-xs font-medium underline ${classeLink}`}>
        📍 Abrir localização no mapa
      </a>
    );
  }
  // pdf e demais arquivos: nome + extensão corretos, abrir e baixar
  return (
    <div className={`mb-1 flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${saida ? "border-emerald-500 bg-emerald-700/40" : "border-slate-200 bg-slate-50"}`}>
      <span className="text-base">📎</span>
      <div className="min-w-0">
        <div className="truncate font-medium">{nome}</div>
        <div className={saida ? "text-emerald-100" : "text-slate-500"}>{m.midiaMime ?? "arquivo"}{tamanho}</div>
      </div>
      <div className="ml-auto flex shrink-0 gap-2">
        {visual === "pdf" && <a href={url} target="_blank" rel="noopener noreferrer" className={`font-medium underline ${classeLink}`}>abrir</a>}
        <a href={`${url}?baixar=1`} className={`font-medium underline ${classeLink}`}>baixar</a>
      </div>
    </div>
  );
}
