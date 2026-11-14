"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

async function chamar(url, method, body) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) }).catch(() => null);
  const json = (r && (await r.json().catch(() => ({})))) || {};
  if (!r?.ok) throw new Error(json.erro || "não foi possível salvar");
  return json;
}

const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

function Copiar({ valor, rotulo }) {
  const [ok, setOk] = useState(false);
  return (
    <div>
      <div className="label">{rotulo}</div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">{valor}</code>
        <button
          type="button"
          className="btn-ghost shrink-0"
          onClick={() => navigator.clipboard?.writeText(valor).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); })}
        >
          {ok ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

function Campo({ rotulo, dica, children }) {
  return (
    <div>
      <label className="label">{rotulo}</label>
      {children}
      {dica && <p className="mt-1 text-[11px] text-slate-400">{dica}</p>}
    </div>
  );
}

function Etapas({ implantacao }) {
  const { etapas, feitas, total } = implantacao;
  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Implantação</h2>
        <span className="text-xs text-slate-500">{feitas} de {total} etapas</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(feitas / total) * 100}%` }} />
      </div>
      <ol className="space-y-2">
        {etapas.map((e) => (
          <li key={e.id} className="flex gap-3 text-sm">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${e.feito ? "bg-emerald-600 text-white" : "border border-slate-300 text-slate-400"}`}>
              {e.feito ? "✓" : ""}
            </span>
            <span>
              <span className={e.feito ? "text-slate-500" : "font-medium text-slate-800"}>{e.titulo}</span>
              {!e.feito && <span className="block text-xs text-slate-500">{e.dica}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Um formulário que salva só os próprios campos. */
function useFormulario(inicial, campos, aoSalvar) {
  const pegar = (cfg) => Object.fromEntries(campos.map((c) => [c, cfg[c] ?? ""]));
  const [valores, setValores] = useState(pegar(inicial));
  const [estado, setEstado] = useState({ ocupado: false, erro: "", ok: "" });
  const mudar = (c) => (e) => setValores((v) => ({ ...v, [c]: e.target.value }));
  async function salvar(e, extra = {}) {
    e?.preventDefault();
    setEstado({ ocupado: true, erro: "", ok: "" });
    try {
      const cfg = await chamar("/api/configuracao", "PATCH", { ...valores, ...extra });
      setValores(pegar(cfg));
      aoSalvar(cfg);
      setEstado({ ocupado: false, erro: "", ok: "Salvo." });
    } catch (err) {
      setEstado({ ocupado: false, erro: err.message, ok: "" });
    }
  }
  return { valores, mudar, salvar, estado, setEstado };
}

function Rodape({ estado, children }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {children}
      {estado.ok && <span className="text-xs text-emerald-700">{estado.ok}</span>}
      {estado.erro && <span className="text-xs text-rose-600">{estado.erro}</span>}
    </div>
  );
}

function DadosFarmacia({ cfg, aoSalvar }) {
  const f = useFormulario(cfg, ["nomeFantasia", "razaoSocial", "cnpj", "endereco", "emailPrivacidade", "telefone"], aoSalvar);
  return (
    <form onSubmit={f.salvar} className="card space-y-3 p-4">
      <div>
        <h2 className="text-sm font-semibold">Dados da farmácia</h2>
        <p className="text-xs text-slate-500">Aparecem no menu do CRM e na política de privacidade pública, que é exigida pela Meta e pela LGPD.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome fantasia" dica="Como a farmácia é conhecida. Aparece no menu.">
          <input className="input" value={f.valores.nomeFantasia} onChange={f.mudar("nomeFantasia")} maxLength={120} placeholder="Farmácia São João" />
        </Campo>
        <Campo rotulo="Razão social *">
          <input className="input" value={f.valores.razaoSocial} onChange={f.mudar("razaoSocial")} maxLength={160} placeholder="Drogaria São João Ltda." />
        </Campo>
        <Campo rotulo="CNPJ *">
          <input className="input" value={f.valores.cnpj} onChange={f.mudar("cnpj")} inputMode="numeric" placeholder="00.000.000/0001-00" />
        </Campo>
        <Campo rotulo="E-mail para assuntos de privacidade *" dica="Para onde os clientes mandam pedidos de exclusão de dados.">
          <input className="input" type="email" value={f.valores.emailPrivacidade} onChange={f.mudar("emailPrivacidade")} placeholder="privacidade@farmacia.com.br" />
        </Campo>
        <Campo rotulo="Endereço">
          <input className="input" value={f.valores.endereco} onChange={f.mudar("endereco")} maxLength={300} placeholder="Rua, número, bairro, cidade/UF" />
        </Campo>
        <Campo rotulo="Telefone">
          <input className="input" value={f.valores.telefone} onChange={f.mudar("telefone")} maxLength={40} placeholder="(21) 0000-0000" />
        </Campo>
      </div>
      <Rodape estado={f.estado}>
        <button className="btn-primary" disabled={f.estado.ocupado}>{f.estado.ocupado ? "Salvando…" : "Salvar dados"}</button>
      </Rodape>
    </form>
  );
}

/** WhatsApp ou Instagram: identificação, token (nunca exibido de volta) e "Testar conexão". */
function Canal({ canal, cfg, origem, aoSalvar }) {
  const wa = canal === "WHATSAPP";
  const k = wa
    ? { id: "whatsappPhoneNumberId", token: "whatsappToken", testado: "whatsappTestadoEm", rotulo: "whatsappNumeroExibicao", ilegivel: "whatsappTokenIlegivel", vercel: "whatsappDaVercel" }
    : { id: "instagramAccountId", token: "instagramToken", testado: "instagramTestadoEm", rotulo: "instagramUsuario", ilegivel: "instagramTokenIlegivel", vercel: "instagramDaVercel" };
  const campos = wa ? [k.id, "whatsappTemplateReabertura"] : [k.id];
  const f = useFormulario(cfg, campos, aoSalvar);
  const [token, setToken] = useState("");
  const [testando, setTestando] = useState(false);

  async function salvar(e) {
    await f.salvar(e, token ? { [k.token]: token } : {});
    setToken("");
  }

  async function testar() {
    setTestando(true);
    f.setEstado({ ocupado: false, erro: "", ok: "" });
    try {
      const r = await chamar("/api/configuracao/testar", "POST", { canal });
      aoSalvar(r.configuracao);
      f.setEstado({ ocupado: false, erro: "", ok: `Conectado: ${r.rotulo}` });
    } catch (err) {
      f.setEstado({ ocupado: false, erro: err.message, ok: "" });
    } finally {
      setTestando(false);
    }
  }

  async function removerToken() {
    if (!confirm(`Desconectar o ${wa ? "WhatsApp" : "Instagram"}? O CRM para de enviar mensagens por esse canal.`)) return;
    await f.salvar(null, { remover: [k.token] });
  }

  const conectado = cfg[k.testado];
  return (
    <form onSubmit={salvar} className="card space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{wa ? "WhatsApp" : "Instagram"}</h2>
          <p className="text-xs text-slate-500">
            {wa
              ? "No painel da Meta: WhatsApp › Configuração da API. Use um número que não esteja mais no app comum do WhatsApp."
              : "Conta profissional do Instagram ligada a uma página do Facebook."}
          </p>
        </div>
        {conectado ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">✓ {cfg[k.rotulo]} · testado {dataHora(cfg[k.testado])}</span>
        ) : cfg[k.vercel] ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">usando as variáveis da Vercel</span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">não conectado</span>
        )}
      </div>

      {cfg[k.ilegivel] && <div className="aviso aviso-negativo">O token salvo não pode mais ser lido (a chave de criptografia mudou). Cole o token de novo.</div>}
      {!cfg.criptografiaDisponivel && <div className="aviso aviso-atencao">Falta a variável CHAVE_CRIPTOGRAFIA na Vercel: o token não pode ser salvo. Avise o suporte.</div>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo={wa ? "Identificação do número de telefone" : "ID da conta do Instagram"} dica={wa ? "Phone Number ID — só números, não é o telefone." : "Instagram Account ID — só números."}>
          <input className="input" value={f.valores[k.id]} onChange={f.mudar(k.id)} inputMode="numeric" placeholder="1234567890123456" />
        </Campo>
        <Campo rotulo="Token de acesso" dica={cfg[k.token] ? `Salvo (${cfg[k.token]}). Deixe em branco para manter.` : "Use o token permanente do usuário do sistema, não o temporário de 24h."}>
          <input className="input" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder={cfg[k.token] ? "••••••••" : "EAAG…"} />
        </Campo>
        {wa && (
          <Campo rotulo="Template de reabertura" dica="Nome do template aprovado na Meta, usado para voltar a falar com o cliente depois de 24h.">
            <input className="input" value={f.valores.whatsappTemplateReabertura} onChange={f.mudar("whatsappTemplateReabertura")} placeholder="retomar_atendimento" />
          </Campo>
        )}
      </div>

      <details className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm" open={!conectado}>
        <summary className="cursor-pointer text-xs font-medium text-slate-600">Dados para colar na Meta (Webhooks)</summary>
        <div className="mt-3 grid gap-3">
          <Copiar rotulo="URL de callback" valor={`${origem}/api/webhooks/${wa ? "whatsapp" : "instagram"}`} />
          <Copiar rotulo="Verificar token" valor={cfg.metaVerifyToken} />
          <p className="text-[11px] text-slate-500">Depois de clicar em "Verificar e salvar" na Meta, assine o campo <code>messages</code>.</p>
        </div>
      </details>

      <Rodape estado={f.estado}>
        <button className="btn-primary" disabled={f.estado.ocupado}>{f.estado.ocupado ? "Salvando…" : "Salvar"}</button>
        <button type="button" className="btn-ghost" onClick={testar} disabled={testando || (!cfg[k.token] && !cfg[k.vercel])}>
          {testando ? "Testando…" : "Testar conexão"}
        </button>
        {cfg[k.token] && <button type="button" className="text-xs text-rose-600 hover:underline" onClick={removerToken}>Desconectar</button>}
      </Rodape>
    </form>
  );
}

export default function ConfiguracaoFarmacia({ inicial, implantacao, origem }) {
  const router = useRouter();
  const [cfg, setCfg] = useState(inicial);
  const aoSalvar = (novo) => {
    setCfg(novo);
    router.refresh(); // atualiza o roteiro de implantação e o nome no menu
  };

  return (
    <div className="space-y-4">
      <Etapas implantacao={implantacao} />
      <DadosFarmacia cfg={cfg} aoSalvar={aoSalvar} />
      <Canal canal="WHATSAPP" cfg={cfg} origem={origem} aoSalvar={aoSalvar} />
      <details className="group">
        <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">Instagram (opcional)</summary>
        <div className="mt-3"><Canal canal="INSTAGRAM" cfg={cfg} origem={origem} aoSalvar={aoSalvar} /></div>
      </details>
      <section className="card space-y-2 p-4">
        <h2 className="text-sm font-semibold">Política de privacidade</h2>
        <p className="text-xs text-slate-500">Página pública, sem login. A Meta pede estes dois endereços para publicar o app.</p>
        <Copiar rotulo="URL da Política de Privacidade" valor={`${origem}/privacidade`} />
        <Copiar rotulo="URL de instruções de exclusão de dados" valor={`${origem}/privacidade#exclusao`} />
        <a href="/privacidade" target="_blank" className="inline-block text-xs text-emerald-700 hover:underline">Ver como o cliente vê ↗</a>
      </section>
    </div>
  );
}
