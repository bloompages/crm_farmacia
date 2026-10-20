# CRM Farmácia

CRM comercial para farmácias, com três frentes:

1. **Identificação de novos leads** — todo contato novo que chega pelo WhatsApp ou Instagram vira lead automaticamente, já classificado por intenção de compra e score.
2. **Quantificação de orçamentos rejeitados** — nenhuma rejeição é registrada sem motivo; o relatório mostra quanto cada motivo custou em R$, o gap de preço contra o concorrente e a ação sugerida.
3. **Captação de mensagens** — inbox único de WhatsApp + Instagram, com resposta pelo próprio CRM.

## Stack

Next.js 15 (App Router) · Prisma · Postgres · Tailwind 4. Em produção roda na Vercel com o Prisma Postgres ligado ao projeto.

## Como rodar

Copie `.env.example` para `.env` e preencha `DATABASE_URL` com um Postgres de desenvolvimento — de preferência um schema separado do de produção (`...?schema=dev`) — e `DATABASE_URL_TESTE` com outro schema (`...?schema=teste`).

```bash
npm install
npm run setup     # cria as tabelas (prisma db push) e popula com dados de exemplo
npm run dev       # http://localhost:3000
```

Entre com `ana@farmacia.com.br` (gerente) ou `bruno@farmacia.com.br` (atendente), senha `farmacia123` — usuários de demonstração criados pelo seed.

Simular mensagens chegando dos canais (com o servidor rodando):

```bash
npm run simular                        # roteiro: texto com parágrafos, PDF, foto, áudio, botão, localização, Instagram
npm run simular -- "quanto custa X?"   # uma mensagem avulsa
npm run simular -- --quebrado          # payload inválido, para ver o tratamento de erro do webhook
```

No inbox, uma resposta começando com `!falha` simula recusa do provedor (fica marcada como não enviada, com botão "tentar de novo").

Outros scripts: `npm run test` (testes automatizados no schema de `DATABASE_URL_TESTE`, apagado e recriado a cada execução; a suíte se recusa a rodar se a URL não terminar em `schema=teste`), `npm run db:studio` (inspecionar o banco), `npm run db:seed` (repopular), `npm run build`.

Banco criado antes desta versão (etiquetas, aniversário, convênio, mensagens rápidas): rode `npx prisma db push` — as colunas novas entram vazias, nada é apagado.

Banco criado antes das correções de consistência: rode `npx prisma db push` e depois `npm run db:ajustar` (mostra o que muda) / `npm run db:ajustar -- --gravar` — normaliza telefones, preenche a base do score, corrige validades e preenche as colunas de busca. Leads que passam a ter o mesmo telefone não são alterados; o script lista os pares para mesclar à mão. O script também lista os usuários sem senha.

## Deploy na Vercel

O projeto `crm_farmacia` da Vercel está ligado ao repositório do GitHub: **cada push na `main` publica em produção**. O banco é o Prisma Postgres ligado ao projeto (a Vercel injeta `DATABASE_URL`).

No build de produção, `scripts/preparar-producao.mjs`:

1. roda `prisma db push` — cria/atualiza as tabelas. Uma mudança de schema que apagaria dados **derruba o build** em vez de apagar; nesse caso, faça a migração à mão.
2. cria o primeiro gerente a partir de `GERENTE_EMAIL` / `GERENTE_SENHA_INICIAL` (e `GERENTE_NOME`), só se esse e-mail ainda não existir — nunca redefine senha. Depois do primeiro acesso, troque a senha e pode apagar `GERENTE_SENHA_INICIAL` da Vercel.

Deploys de preview não mexem no banco. Variáveis de produção: `PROVEDOR_MENSAGERIA` (hoje `mock`), `META_VERIFY_TOKEN` e `META_APP_SECRET` (obrigatórias em produção; ver *Integrações de mensageria*). Para criar outros usuários ou redefinir senhas em produção, rode `npm run usuario:criar` com a `DATABASE_URL` de produção (copiada do painel da Vercel › Storage).

## Acesso e LGPD

- **Login obrigatório** em todas as telas e APIs (`src/middleware.js`), exceto os webhooks da Meta, que têm assinatura própria. A sessão fica no banco, com só o hash do token, e dura um turno de 12h, renovada com o uso. Desativar um usuário ou trocar a senha dele derruba as sessões abertas na hora. Login com 5 erros em 15 min é bloqueado. Senhas usam scrypt.
- **Papéis:** *gerente* faz tudo; *atendente* trabalha leads, orçamentos e mensagens, mas não exclui registros, não gerencia a equipe e não atende pedidos de titular. Todos veem todos os leads (inbox compartilhado); o filtro "só os meus" usa o responsável, definido por quem cadastra, orça ou responde primeiro, e editável na ficha.
- **Primeiro acesso em produção:** `npm run usuario:criar -- --email pessoa@farmacia.com.br --nome "Nome" --gerente` gera uma senha aleatória e a mostra uma vez. O mesmo comando redefine a senha de quem esqueceu.
- **Auditoria** (`/equipe`, só gerente): logins (inclusive os que falharam), fichas abertas, anexos vistos (receitas são dado de saúde, art. 11), exportações e importações de planilha (com quantidade e filtros), anonimizações, exclusões e mudanças na equipe.
- **Planilhas:** importar e exportar CSV é só do gerente — a planilha leva dados pessoais em massa para fora do CRM. A exportação de leads não inclui titulares anonimizados, e a importação recusa reinserir o telefone/e-mail de quem pediu exclusão.
- **Titular** (ficha do lead): consentimento de contato ativo com data; *Exportar dados* (JSON com tudo que o CRM guarda) e *Apagar dados pessoais* (anonimiza: apaga nome, contatos, aniversário, convênio, etiquetas, conversas, anexos, payloads de webhook e o nome nos registros de auditoria; os valores dos orçamentos continuam nos relatórios sem identificação).
- **Retenção:** payloads brutos de webhook (que trazem telefone e texto) são apagados após 30 dias; os com erro, após 60.

## Telas

| Rota | O que faz |
|---|---|
| `/` | Painel em formato de quadro (estilo Trello): cada indicador/gráfico é um cartão arrastável entre listas; arranjo, cartões recolhidos e nº de listas ficam salvos no navegador. Cartões de **Atendimento** (conversas no período, em aberto, encerradas, sem resposta e divisão por canal), **Novos leads por dia** e **Aniversariantes** dos próximos 7 dias (marca quem não deu consentimento de contato) |
| `/leads` | Lista com filtros por etapa, origem, etiqueta e busca; cadastro manual (com CPF/CNPJ, aniversário, convênio e etiquetas); gerente vê **Exportar CSV** (exporta exatamente o filtro da tela) e **Importar** |
| `/leads/[id]` | Ficha editável (inclui corrigir o número), etiquetas com "+ etiqueta", orçamentos, timeline de interações, mudança de etapa e registro de notas |
| `/pipeline` | Kanban do funil (Novo → Orçamento enviado → Aprovado / Perdido) com arrastar-e-soltar; busca por nome/telefone, filtros por responsável, data de entrada, etiqueta e origem (com contagem); cada coluna mostra quantidade e R$; card com telefone, etiquetas, último contato e iniciais do responsável; em *Orçamento enviado*, botão **R$ X — Confirmar venda** (aprova o lead e aceita o orçamento em aberto com esse valor) |
| `/orcamentos` | Lista filtrável por status; `/orcamentos/novo` monta o orçamento a partir do catálogo |
| `/orcamentos/[id]` | Detalhe, fechamento como aceito ou rejeitado (rejeição exige motivo) |
| `/inbox` | Conversas de WhatsApp e Instagram em abas **Abertas / Sem resposta / Todas / Fechadas**, filtros **só as minhas**, **quentes** e **sem resposta +24h**; na lista, o sinal de compra da última mensagem ("pediu orçamento", "quer comprar") e as etiquetas; botão **Resolver** (a conversa reabre sozinha se o cliente escrever de novo); etiquetas do lead no cabeçalho; **mensagens rápidas** com `/atalho`; anexos, status de entrega, janela de 24h, filtros "precisa responder", barra de sincronização e botão **Aprovar** com o valor da venda (soma das linhas "Total" da conversa, editável no ✎; ao aprovar, o lead vai para Aprovado e o orçamento em aberto vira aceito com esse valor) |
| `/relatorios` | Perda por motivo em R$, concorrentes que mais tiram venda, lista detalhada |
| `/configuracoes` | Central de configurações: mensagens rápidas, etiquetas, planilhas e equipe |
| `/configuracoes/mensagens-rapidas` | Cadastro das respostas prontas |
| `/configuracoes/etiquetas` | Etiquetas em uso com contagem; gerente renomeia, junta e remove em todos os leads |
| `/configuracoes/planilhas` | Exportar leads, orçamentos (por status) e catálogo de produtos; importar leads e produtos (só gerente) |

## Planilhas: importar e exportar CSV (`src/lib/csv.js`, `src/lib/planilhas.js`)

Os arquivos saem no formato que o Excel brasileiro abre com dois cliques: separador `;`, vírgula nos centavos, datas `dd/mm/aaaa`, UTF-8 com BOM. As colunas exportadas são as mesmas que a importação reconhece, então dá para **exportar, ajustar no Excel e importar de volta**. Células que começam com `=`, `+`, `-` ou `@` recebem um `'` na frente para não virarem fórmula (telefones e valores negativos ficam como estão).

| | Leads | Orçamentos | Produtos |
|---|---|---|---|
| Exportar | `/api/exportar/leads` (aceita `etapa`, `origem`, `q`, `etiqueta`, `meus`) | `/api/exportar/orcamentos?status=` | `/api/exportar/produtos` |
| Importar | `POST /api/importar/leads` | — | `POST /api/importar/produtos` |
| Modelo | `GET /api/importar/leads` | — | `GET /api/importar/produtos` |

Como funciona a importação:

- **Duas etapas:** *Verificar arquivo* simula e mostra quantos serão criados, atualizados, ignorados e quais linhas têm erro (com o número da linha na planilha e o motivo); só *Importar* grava.
- **Arquivo do Excel:** aceita separador `;`, `,` ou tab, e tanto UTF-8 quanto o ANSI (Windows-1252) que o Excel salva por padrão — "João" não chega como "Jo�o". Arquivo `.xlsx` é recusado com a instrução de salvar como CSV. Limite de 5.000 linhas / 3 MB.
- **Cabeçalhos flexíveis:** a ordem não importa, e acento, caixa e pontuação são ignorados ("Celular", "WhatsApp" e "Telefone / WhatsApp" caem em telefone). Só **Nome** é obrigatório (produtos: **Nome** e **Preço**). Colunas desconhecidas são listadas e ignoradas.
- **Duplicados:** o lead é identificado pelo telefone canônico (ou pelo e-mail, se não houver telefone); a mesma pessoa duas vezes na planilha vira erro na segunda linha. Por padrão, quem já existe é ignorado; com *completar o cadastro existente*, só as células preenchidas mudam, as etiquetas são somadas e o telefone e a etapa do lead existente nunca mudam por planilha. Produtos são identificados pelo nome (sem diferenciar acento e caixa) e têm o preço atualizado.
- **Regras do CRM valem na planilha:** lead *Perdido* exige "Motivo da perda" válido; telefone, e-mail e aniversário inválidos viram erro da linha; origem ou responsável desconhecidos entram com aviso (origem manual / sem responsável). Cada lead criado ou atualizado ganha uma nota na timeline com o nome do arquivo.

## Etiquetas e mensagens rápidas

- **Etiquetas** (`src/lib/etiquetas.js`): texto livre criado na hora pelo "+ etiqueta" da conversa ou da ficha, guardado em minúsculas e sem repetição ("VIP" e "vip" são a mesma). O filtro é exato ("vip" não acha "vip ouro"). Aparecem na lista de leads, no funil, no inbox e na planilha.
- **Mensagens rápidas** (`src/lib/mensagensRapidas.js`): no campo de resposta, digite `/` e o atalho; ↑/↓ escolhe e Tab ou Enter insere. `{nome}` vira o primeiro nome do cliente — se o contato não tem nome (só `@usuario` ou número), some junto com a vírgula ("Oi, {nome}!" → "Oi!"). Qualquer pessoa da equipe cadastra.

## Identificação de leads (`src/lib/intencao.js`)

Cada mensagem recebida é pontuada por grupos de sinais comerciais — pedido de orçamento, pergunta de preço, disponibilidade em estoque, manipulados/receita, entrega e pagamento, compra recorrente/PJ, além de menção a quantidade ("10 caixas"). O score define a temperatura do lead (`QUENTE ≥ 60`, `MORNO ≥ 25`); a etapa só muda por ação do atendente (orçamento enviado, aprovado, perdido). Ajuste os pesos e termos direto nesse arquivo.

O interesse esfria: sem nova mensagem, o score perde metade a cada 30 dias (`MEIA_VIDA_DIAS`), calculado sempre a partir de `scoreBase`/`scoreEm` (sem acumular arredondamento). A temperatura só é rebaixada pelo esfriamento, nunca elevada.

Telefones são gravados na forma canônica (`src/lib/telefone.js`: só dígitos, DDI 55, 9º dígito no celular), então "(11) 98765-4321" digitado à mão e o wa_id `551187654321` caem no mesmo lead; cadastrar um telefone repetido retorna `409` com o lead existente.

## Quantificação das rejeições

`PATCH /api/orcamentos/[id]` com `status: "REJEITADO"` **rejeita a requisição sem `motivoRejeicao`**. Motivos disponíveis (`src/lib/constantes.js`), cada um com ação sugerida: preço, concorrência, sem estoque, prazo de entrega, sem resposta, desistiu, convênio/SUS, outro. Para preço e concorrência é possível registrar o nome do concorrente e o preço praticado — o relatório calcula o gap médio. Ao rejeitar o último orçamento aberto de um lead, ele vai para *Perdido* com o mesmo motivo. O caminho inverso vale igual: marcar o lead como *Perdido* (ficha ou arrastando no funil) exige motivo e rejeita os orçamentos em aberto com ele, para a perda aparecer no relatório.

Orçamento com validade vencida vira `EXPIRADO` e sai do "valor em aberto". Essa rotina e o esfriamento do score (`src/lib/manutencao.js`) rodam sob demanda quando as telas de números abrem, no máximo a cada 10 min — sem cron. Mudanças de status em orçamento/lead são gravadas em transação, e a numeração dos orçamentos é refeita automaticamente se dois forem criados ao mesmo tempo.

## Sistema de cores

`src/lib/tema.js` é a única fonte de cor da interface: quatro famílias com significado fixo — **neutro** (informação), **verde** (marca, positivo, ganho), **âmbar** (aguardando alguém) e **rosa** (perda, erro, urgência). Chips de etapa/status/temperatura, canais e os gráficos (`GRAFICO`) importam daí; nenhum componente escolhe uma cor própria. A rampa do funil é um único hue (verde) do claro ao escuro; ganho x perda nos gráficos foi validado para daltonismo (ΔE 8.3 deutan) e a posição acima/abaixo do zero reforça a polaridade.

## Inbox: o que foi desenhado a partir das dores reais

| Dor relatada em outros CRMs | Como este CRM trata |
|---|---|
| Erro constante na sincronização | Polling com backoff exponencial e pausa em aba oculta; a lista traz só a última mensagem de cada conversa e a conversa aberta carrega as 100 mais recentes (com "carregar anteriores"); barra de sincronização mostra quando foi a última atualização, o último webhook recebido e quantos eventos falharam, com botão **reprocessar** |
| Mensagem chega no WhatsApp e não vai pro CRM | Todo POST do webhook é gravado em `EventoWebhook` antes de processar; cada mensagem do lote é tratada isoladamente; a resposta é sempre `200` (a Meta desativa webhooks que falham); todos os tipos de mensagem entram (imagem, áudio, vídeo, documento, figurinha, localização, contato, botão/lista, reação, pedido) — nada é descartado |
| Conversa some após 24h sem resposta | Nenhuma conversa é escondida por idade: só sai da aba *Abertas* quando alguém clica em **Resolver**, e volta sozinha se o cliente escrever de novo (a aba *Todas* mostra tudo). A janela de 24h (contada da última mensagem **do cliente**) aparece no cabeçalho com contagem regressiva; o filtro **sem resposta +24h** lista as vencidas; no WhatsApp o CRM oferece o template de reabertura (`WHATSAPP_TEMPLATE_REABERTURA`) |
| Documento que não abre | `/api/midia/[id]` baixa o anexo do provedor e serve com `Content-Type` real e `Content-Disposition` com nome + extensão corretos; imagem/áudio/vídeo/PDF abrem inline, o resto baixa |
| Texto longo sem parágrafos | Campo de resposta é um textarea (Enter envia, Shift+Enter quebra linha); parágrafos, quebras e `*negrito*` / `_itálico_` / `~riscado~` / links são renderizados como no WhatsApp |
| Resposta "some" quando o envio falha | A mensagem é gravada como `ENVIANDO` antes de chamar a API; se falhar vira `FALHOU` com o motivo traduzido (ex.: janela de 24h fechada, token expirado) e botão **tentar de novo**; confirmações `✓ ✓✓` vêm dos eventos de status da Meta |

## Integrações de mensageria

A troca de provedor é feita pelo `.env`, sem mexer no CRM:

```
PROVEDOR_MENSAGERIA="mock"   # simulador local (padrão)
PROVEDOR_MENSAGERIA="meta"   # WhatsApp Cloud API + Instagram Messaging
```

Para ir a produção com a Meta:

1. Preencha `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TOKEN`, `INSTAGRAM_ACCOUNT_ID`, `INSTAGRAM_TOKEN` e `META_VERIFY_TOKEN` no `.env`.
2. Publique o app com HTTPS e cadastre os webhooks no painel da Meta:
   - WhatsApp → `https://SEU_DOMINIO/api/webhooks/whatsapp`
   - Instagram → `https://SEU_DOMINIO/api/webhooks/instagram`
   - O `GET` de verificação já responde ao `hub.challenge` usando `META_VERIFY_TOKEN`.
3. Troque `PROVEDOR_MENSAGERIA` para `meta`.

Em produção (`NODE_ENV=production`) o CRM **recusa webhooks sem assinatura** e não usa o verify token padrão: `META_APP_SECRET` e `META_VERIFY_TOKEN` são obrigatórios, e a barra do inbox avisa se faltarem. Para rodar `npm run simular` contra um build de produção, exporte o mesmo `META_APP_SECRET` no terminal; o simulador assina as requisições.

O parser do formato oficial da Meta já está escrito em `src/lib/integrations/meta.js` (mensagens de todos os tipos, anexos, eventos de status e template); mensagens duplicadas são descartadas pelo `idExterno`. Preencha `META_APP_SECRET` para validar a assinatura dos webhooks e `WHATSAPP_TEMPLATE_REABERTURA` com o nome do template aprovado para reabrir conversas após 24h. Para outro provedor (Evolution API, Twilio, Z-API), basta criar um arquivo com `enviar`, `baixarMidia` e `normalizarWebhook` e registrá-lo em `src/lib/integrations/index.js`.

Auditoria dos webhooks: `GET /api/webhooks/eventos?status=ERRO|OK|TODOS` lista os eventos gravados; `POST /api/webhooks/eventos` com `{ "id": "..." }` ou `{ "todos": true }` reprocessa.

## Próximos passos sugeridos

- Envio de anexos (imagem/PDF do orçamento) pelo próprio inbox.
- Cadência automática de follow-up para o motivo "cliente não respondeu".
- Migrações versionadas (`prisma migrate`) no lugar do `db push` quando o schema começar a ter mudanças que mexem em dados.
