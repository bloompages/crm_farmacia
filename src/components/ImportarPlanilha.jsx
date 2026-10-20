"use client";
import { useState } from "react";
import Link from "next/link";
import { TOM } from "@/lib/tema";

const TIPOS = {
  leads: {
    rotulo: "Leads / contatos",
    ajuda: 'Obrigatória: "Nome". Reconhecidas: Telefone/WhatsApp, E-mail, CPF/CNPJ, Tipo, Empresa, Origem, Etapa, Motivo da perda, Etiquetas, Interesses, Aniversário, Convênio, Responsável, Consentimento marketing, Observações.',
    duplicado: "Telefone ou e-mail já cadastrado",
  },
  produtos: {
    rotulo: "Catálogo de produtos",
    ajuda: 'Obrigatórias: "Nome" e "Preço". Opcionais: Categoria, Ativo (sim/não).',
    duplicado: "Produto com o mesmo nome",
  },
};

const ACAO = {
  novo: { rotulo: "novo", tom: TOM.marca },
  atualizar: { rotulo: "atualiza", tom: TOM.atencao },
  ignorar: { rotulo: "já existe", tom: TOM.neutroClaro },
  anonimizado: { rotulo: "bloqueado", tom: TOM.negativo },
};

/**
 * O Excel brasileiro salva CSV em ANSI (Windows-1252), não em UTF-8: sem esse
 * cuidado "João" chega como "Jo�o". Tenta UTF-8 estrito e cai para 1252.
 */
async function lerTexto(arquivo) {
  const bytes = await arquivo.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export default function ImportarPlanilha() {
  const [tipo, setTipo] = useState("leads");
  const [arquivo, setArquivo] = useState(null);
  const [conteudo, setConteudo] = useState("");
  const [atualizar, setAtualizar] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  function reiniciar() {
    setResultado(null);
    setErro("");
  }

  async function escolher(e) {
    reiniciar();
    const f = e.target.files?.[0];
    setArquivo(f ?? null);
    setConteudo("");
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) {
      setErro('Esse é um arquivo do Excel (.xlsx). No Excel, use "Arquivo › Salvar como › CSV (separado por vírgulas)" e envie o .csv.');
      setArquivo(null);
      return;
    }
    setConteudo(await lerTexto(f));
  }

  async function enviar(gravar) {
    setOcupado(true);
    setErro("");
    const r = await fetch(`/api/importar/${tipo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conteudo, arquivo: arquivo?.name, gravar, atualizar }),
    }).catch(() => null);
    const json = (r && (await r.json().catch(() => ({})))) || {};
    setOcupado(false);
    if (!r?.ok) {
      setResultado(null);
      return setErro(json.erro || "Não foi possível ler o arquivo.");
    }
    setResultado(json);
  }

  const t = TIPOS[tipo];
  const aGravar = resultado ? resultado.novos + resultado.atualizados : 0;

  return (
    <div className="card space-y-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">O que importar</label>
          <select className="input w-auto" value={tipo} onChange={(e) => { setTipo(e.target.value); reiniciar(); }}>
            {Object.entries(TIPOS).map(([id, x]) => <option key={id} value={id}>{x.rotulo}</option>)}
          </select>
        </div>
        <div className="min-w-0 flex-1">
          <label className="label">Arquivo CSV</label>
          <input type="file" accept=".csv,.txt,text/csv" onChange={escolher} className="input py-1.5" />
        </div>
        <a href={`/api/importar/${tipo}`} className="btn-ghost">⇩ Planilha modelo</a>
      </div>
      <p className="text-xs text-slate-500">{t.ajuda} A ordem das colunas não importa; colunas desconhecidas são ignoradas.</p>
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={atualizar} onChange={(e) => { setAtualizar(e.target.checked); reiniciar(); }} className="mt-1" />
        <span>
          <b>{t.duplicado}:</b> {atualizar ? "completar o cadastro existente com os dados da planilha" : "ignorar a linha (não altera nada)"}
          {tipo === "leads" && atualizar && <span className="block text-xs text-slate-400">Só as células preenchidas mudam; etiquetas são somadas; telefone e etapa do lead existente não mudam.</span>}
        </span>
      </label>

      {erro && <div className="aviso aviso-negativo">{erro}</div>}

      {!resultado?.gravado && (
        <div className="flex gap-2">
          <button className="btn-ghost" disabled={!conteudo || ocupado} onClick={() => enviar(false)}>
            {ocupado && !resultado ? "Verificando…" : "1. Verificar arquivo"}
          </button>
          {resultado && (
            <button className="btn-primary" disabled={ocupado || aGravar === 0} onClick={() => enviar(true)}>
              {ocupado ? "Importando…" : `2. Importar ${aGravar} registro(s)`}
            </button>
          )}
        </div>
      )}

      {resultado && <Resumo r={resultado} tipo={tipo} />}
      {resultado?.gravado && (
        <div className="flex gap-2">
          <Link href={tipo === "leads" ? "/leads" : "/orcamentos/novo"} className="btn-primary">{tipo === "leads" ? "Ver leads" : "Ver catálogo no orçamento"}</Link>
          <button className="btn-ghost" onClick={() => { reiniciar(); setArquivo(null); setConteudo(""); }}>Importar outro arquivo</button>
        </div>
      )}
    </div>
  );
}

function Resumo({ r, tipo }) {
  const numero = (rotulo, valor, tom = "text-slate-900") => (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-xs text-slate-400">{rotulo}</div>
      <div className={`text-xl font-semibold ${tom}`} style={{ fontVariantNumeric: "tabular-nums" }}>{valor}</div>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className={`aviso ${r.gravado ? "aviso-marca" : "aviso-neutro"}`}>
        {r.gravado
          ? <><b>Importação concluída.</b> {r.novos} novo(s) e {r.atualizados} atualizado(s).</>
          : <><b>Simulação — nada foi gravado ainda.</b> Confira abaixo e clique em "Importar".</>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {numero("Linhas lidas", r.total)}
        {numero(r.gravado ? "Criados" : "Novos", r.novos, "text-emerald-700")}
        {numero(r.gravado ? "Atualizados" : "A atualizar", r.atualizados, "text-amber-600")}
        {numero("Já existentes (ignorados)", r.ignorados, "text-slate-500")}
        {numero("Com erro", r.erros.length, r.erros.length ? "text-rose-600" : "text-slate-500")}
      </div>

      <div className="text-xs text-slate-500">
        <b>Colunas reconhecidas:</b> {r.colunas.reconhecidas.map((c) => c.coluna).join(", ")}
        {r.colunas.ignoradas.length > 0 && <> · <b>ignoradas:</b> {r.colunas.ignoradas.join(", ")}</>}
      </div>

      {r.amostra.length > 0 && !r.gravado && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Linha</th>
                <th className="px-3 py-2 font-medium">Ação</th>
                <th className="px-3 py-2 font-medium">Nome</th>
                {tipo === "leads" ? (
                  <><th className="px-3 py-2 font-medium">Telefone</th><th className="px-3 py-2 font-medium">Etapa</th><th className="px-3 py-2 font-medium">Etiquetas</th></>
                ) : (
                  <><th className="px-3 py-2 font-medium">Categoria</th><th className="px-3 py-2 font-medium">Preço</th></>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {r.amostra.map((a) => (
                <tr key={a.linha}>
                  <td className="px-3 py-1.5 text-slate-400">{a.linha}</td>
                  <td className="px-3 py-1.5"><span className={`chip ${ACAO[a.acao]?.tom}`}>{ACAO[a.acao]?.rotulo ?? a.acao}</span></td>
                  <td className="px-3 py-1.5">{a.nome}</td>
                  {tipo === "leads" ? (
                    <><td className="px-3 py-1.5 text-slate-500">{a.telefone}</td><td className="px-3 py-1.5 text-slate-500">{a.etapa}</td><td className="px-3 py-1.5 text-slate-500">{a.etiquetas}</td></>
                  ) : (
                    <><td className="px-3 py-1.5 text-slate-500">{a.categoria}</td><td className="px-3 py-1.5 text-slate-500">R$ {a.preco}</td></>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {r.total > r.amostra.length && <p className="px-3 py-1.5 text-[11px] text-slate-400">primeiras {r.amostra.length} linhas válidas</p>}
        </div>
      )}

      <Lista titulo="Linhas com erro (não serão importadas)" itens={r.erros} classe="aviso-negativo" />
      <Lista titulo="Avisos (a linha entra, com ajuste)" itens={r.avisos} classe="aviso-atencao" />
    </div>
  );
}

function Lista({ titulo, itens, classe }) {
  if (!itens?.length) return null;
  return (
    <details className={`aviso ${classe}`} open={itens.length <= 10}>
      <summary className="cursor-pointer font-medium">{titulo}: {itens.length}</summary>
      <ul className="mt-2 max-h-60 space-y-0.5 overflow-y-auto">
        {itens.map((e, i) => <li key={i}><b>linha {e.linha}:</b> {e.motivo}</li>)}
      </ul>
    </details>
  );
}
