import { RETENCAO_WEBHOOK_DIAS } from "@/lib/manutencao";
import { obterConfiguracao, dadosFarmaciaDe } from "@/lib/configuracao";

/**
 * Política de privacidade pública (sem login). A Meta exige esta URL para
 * publicar o app do WhatsApp/Instagram; a seção #exclusao serve também como
 * "URL de instruções de exclusão de dados" no painel da Meta.
 *
 * Os dados da farmácia vêm de Configurações › Farmácia e integrações (ou das
 * variáveis PRIVACIDADE_* antigas) e valem na hora, sem novo deploy.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Política de Privacidade",
  description: "Como tratamos os dados pessoais de quem fala com a farmácia pelo WhatsApp, Instagram e balcão.",
};

const ATUALIZADA_EM = "14 de novembro de 2026";

function Faltando({ campo }) {
  return <span className="rounded bg-amber-50 px-1 text-amber-700">[preencher {campo}]</span>;
}

function Secao({ id, titulo, children }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-2">
      <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
      {children}
    </section>
  );
}

export default async function Privacidade() {
  const c = dadosFarmaciaDe(await obterConfiguracao());
  const nome = c.nome ?? <Faltando campo="nome da farmácia" />;
  const email = c.email ? <a className="text-emerald-700 underline" href={`mailto:${c.email}`}>{c.email}</a> : <Faltando campo="e-mail" />;

  return (
    <article className="mx-auto max-w-2xl space-y-6 py-4 text-sm leading-relaxed text-slate-700">
      <header className="space-y-1">
        <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">{c.nomeFantasia ?? c.nome ?? "CRM Farmácia"}</div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Política de Privacidade</h1>
        <p className="text-xs text-slate-500">Última atualização: {ATUALIZADA_EM}</p>
      </header>

      <p>
        Esta política explica como {nome} trata os dados pessoais de clientes e interessados que entram em contato
        pelo WhatsApp, Instagram, telefone ou balcão, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).
      </p>

      <Secao id="controlador" titulo="1. Quem é o responsável pelos seus dados">
        <ul className="list-disc space-y-1 pl-5">
          <li>Controlador: {nome}{c.cnpj && <> — CNPJ {c.cnpj}</>}</li>
          {c.endereco && <li>Endereço: {c.endereco}</li>}
          <li>Contato para assuntos de privacidade (encarregado): {email}{c.telefone && <> · {c.telefone}</>}</li>
        </ul>
      </Secao>

      <Secao id="dados" titulo="2. Quais dados coletamos">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Identificação e contato:</strong> nome, telefone, nome de perfil do WhatsApp ou Instagram, e-mail e, quando necessário para orçamento ou nota, CPF/CNPJ.</li>
          <li><strong>Atendimento:</strong> mensagens trocadas conosco, imagens e arquivos enviados (por exemplo, foto de receita), orçamentos e histórico de compras.</li>
          <li><strong>Informações opcionais:</strong> data de nascimento, convênio ou plano de saúde e produtos de interesse.</li>
          <li><strong>Dados de saúde:</strong> receitas e menções a medicamentos são dados sensíveis. Só os usamos para atender o seu pedido e cumprir as normas sanitárias.</li>
        </ul>
        <p>Não compramos listas de contatos e não coletamos dados de quem não falou conosco.</p>
      </Secao>

      <Secao id="finalidades" titulo="3. Para que usamos e com qual base legal">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Responder você, fazer orçamentos e concluir a venda</strong> — execução de contrato e procedimentos preliminares (art. 7º, V).</li>
          <li><strong>Conferir receitas e cumprir regras da Anvisa e da vigilância sanitária</strong> — cumprimento de obrigação legal ou regulatória (art. 7º, II e art. 11, II, “a”).</li>
          <li><strong>Lembretes de recompra, aniversário e ofertas</strong> — somente com o seu consentimento (art. 7º, I), que pode ser retirado a qualquer momento.</li>
          <li><strong>Organizar o atendimento interno</strong> (qual atendente cuida do seu pedido, histórico) — legítimo interesse (art. 7º, IX), sempre limitado ao necessário.</li>
        </ul>
      </Secao>

      <Secao id="compartilhamento" titulo="4. Com quem compartilhamos">
        <p>Não vendemos nem alugamos seus dados. Eles são tratados apenas por fornecedores necessários ao funcionamento do serviço:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Meta Platforms</strong> (WhatsApp e Instagram), que transporta as mensagens;</li>
          <li><strong>a empresa que fornece o sistema de atendimento (CRM)</strong>, que atua como operadora e trata os dados apenas conforme as nossas instruções;</li>
          <li><strong>provedores de hospedagem e banco de dados em nuvem</strong>, onde o sistema de atendimento funciona.</li>
        </ul>
        <p>
          Alguns desses fornecedores processam dados fora do Brasil, com garantias contratuais de proteção (art. 33 da LGPD).
          Também podemos fornecer dados a autoridades quando a lei exigir.
        </p>
      </Secao>

      <Secao id="seguranca" titulo="5. Segurança e por quanto tempo guardamos">
        <p>
          O acesso ao sistema é restrito à equipe, com usuário e senha individuais, conexão criptografada e registro das ações
          feitas. Cópias brutas das mensagens recebidas pelas integrações são apagadas automaticamente em até{" "}
          {RETENCAO_WEBHOOK_DIAS * 2} dias.
        </p>
        <p>
          Os dados de cadastro e o histórico de atendimento são mantidos enquanto houver relacionamento com você ou enquanto
          a lei exigir (por exemplo, registros fiscais e sanitários). Depois disso, ou a seu pedido, são apagados ou anonimizados.
        </p>
      </Secao>

      <Secao id="direitos" titulo="6. Seus direitos">
        <p>Você pode, a qualquer momento e sem custo (art. 18 da LGPD):</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>confirmar se tratamos seus dados e pedir uma cópia deles;</li>
          <li>corrigir dados incompletos ou desatualizados;</li>
          <li>retirar o consentimento para lembretes e ofertas;</li>
          <li>pedir a exclusão ou anonimização dos seus dados;</li>
          <li>reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</li>
        </ul>
      </Secao>

      <Secao id="exclusao" titulo="7. Como pedir a exclusão dos seus dados">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Envie <strong>“EXCLUIR MEUS DADOS”</strong> pelo mesmo WhatsApp ou Instagram em que falou conosco, ou escreva para {email}.</li>
          <li>Podemos pedir uma confirmação simples para garantir que o pedido é seu.</li>
          <li>Em até 15 dias apagamos nome, telefone, e-mail, documento, data de nascimento, observações e o conteúdo das conversas, e confirmamos para você.</li>
        </ol>
        <p>
          Guardamos apenas o que a lei nos obriga a manter (como registros fiscais ou de receitas controladas), sem uso para
          qualquer outra finalidade.
        </p>
      </Secao>

      <Secao id="alteracoes" titulo="8. Alterações nesta política">
        <p>Podemos atualizar esta política. A data no topo indica a versão em vigor.</p>
      </Secao>
    </article>
  );
}
