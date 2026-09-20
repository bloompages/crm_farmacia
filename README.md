# CRM Farmácia

CRM comercial para farmácias, com três frentes:

1. **Identificação de novos leads** — todo contato novo que chega pelo WhatsApp ou Instagram vira lead automaticamente, já classificado por intenção de compra e score.
2. **Quantificação de orçamentos rejeitados** — nenhuma rejeição é registrada sem motivo; o relatório mostra quanto cada motivo custou em R$, o gap de preço contra o concorrente e a ação sugerida.
3. **Captação de mensagens** — inbox único de WhatsApp + Instagram, com resposta pelo próprio CRM.

## Stack

Next.js 15 (App Router) · Prisma · SQLite · Tailwind 4. Sem serviços externos para rodar localmente.

## Como rodar

```bash
npm install
npm run setup     # cria o banco (prisma db push) e popula com dados de exemplo
npm run dev       # http://localhost:3000
```

Simular mensagens chegando dos canais (com o servidor rodando):

```bash
npm run simular                        # roteiro: texto com parágrafos, PDF, foto, áudio, botão, localização, Instagram
npm run simular -- "quanto custa X?"   # uma mensagem avulsa
npm run simular -- --quebrado          # payload inválido, para ver o tratamento de erro do webhook
```

No inbox, uma resposta começando com `!falha` simula recusa do provedor (fica marcada como não enviada, com botão "tentar de novo").

Outros scripts: `npm run db:studio` (inspecionar o banco), `npm run db:seed` (repopular), `npm run build`.

## Telas

| Rota | O que faz |
|---|---|
| `/` | Painel em formato de quadro (estilo Trello): cada indicador/gráfico é um cartão arrastável entre listas; arranjo, cartões recolhidos e nº de listas ficam salvos no navegador |
| `/leads` | Lista com filtros por etapa, origem e busca; cadastro manual |
| `/leads/[id]` | Ficha, orçamentos, timeline de interações, mudança de etapa e registro de notas |
| `/pipeline` | Kanban do funil (Novo → Orçamento enviado → Aprovado / Perdido) com arrastar-e-soltar |
| `/orcamentos` | Lista filtrável por status; `/orcamentos/novo` monta o orçamento a partir do catálogo |
| `/orcamentos/[id]` | Detalhe, fechamento como aceito ou rejeitado (rejeição exige motivo) |
| `/inbox` | Conversas de WhatsApp e Instagram com anexos, status de entrega, janela de 24h, filtros "precisa responder", barra de sincronização e botão **Aprovar** com o valor da venda (soma das linhas "Total" da conversa, editável no ✎; ao aprovar, o lead vai para Aprovado e o orçamento em aberto vira aceito com esse valor) |
| `/relatorios` | Perda por motivo em R$, concorrentes que mais tiram venda, lista detalhada |

## Identificação de leads (`src/lib/intencao.js`)

Cada mensagem recebida é pontuada por grupos de sinais comerciais — pedido de orçamento, pergunta de preço, disponibilidade em estoque, manipulados/receita, entrega e pagamento, compra recorrente/PJ, além de menção a quantidade ("10 caixas"). O score define a temperatura do lead (`QUENTE ≥ 60`, `MORNO ≥ 25`); a etapa só muda por ação do atendente (orçamento enviado, aprovado, perdido). Ajuste os pesos e termos direto nesse arquivo.

## Quantificação das rejeições

`PATCH /api/orcamentos/[id]` com `status: "REJEITADO"` **rejeita a requisição sem `motivoRejeicao`**. Motivos disponíveis (`src/lib/constantes.js`), cada um com ação sugerida: preço, concorrência, sem estoque, prazo de entrega, sem resposta, desistiu, convênio/SUS, outro. Para preço e concorrência é possível registrar o nome do concorrente e o preço praticado — o relatório calcula o gap médio. Ao rejeitar o último orçamento aberto de um lead, ele vai para *Perdido* com o mesmo motivo.

## Sistema de cores

`src/lib/tema.js` é a única fonte de cor da interface: quatro famílias com significado fixo — **neutro** (informação), **verde** (marca, positivo, ganho), **âmbar** (aguardando alguém) e **rosa** (perda, erro, urgência). Chips de etapa/status/temperatura, canais e os gráficos (`GRAFICO`) importam daí; nenhum componente escolhe uma cor própria. A rampa do funil é um único hue (verde) do claro ao escuro; ganho x perda nos gráficos foi validado para daltonismo (ΔE 8.3 deutan) e a posição acima/abaixo do zero reforça a polaridade.

## Inbox: o que foi desenhado a partir das dores reais

| Dor relatada em outros CRMs | Como este CRM trata |
|---|---|
| Erro constante na sincronização | Polling com backoff exponencial e pausa em aba oculta; barra de sincronização mostra quando foi a última atualização, o último webhook recebido e quantos eventos falharam, com botão **reprocessar** |
| Mensagem chega no WhatsApp e não vai pro CRM | Todo POST do webhook é gravado em `EventoWebhook` antes de processar; cada mensagem do lote é tratada isoladamente; a resposta é sempre `200` (a Meta desativa webhooks que falham); todos os tipos de mensagem entram (imagem, áudio, vídeo, documento, figurinha, localização, contato, botão/lista, reação, pedido) — nada é descartado |
| Conversa some após 24h sem resposta | Nenhuma conversa é escondida. A janela de 24h (contada da última mensagem **do cliente**) aparece no cabeçalho com contagem regressiva; o filtro **sem resposta +24h** lista as vencidas; no WhatsApp o CRM oferece o template de reabertura (`WHATSAPP_TEMPLATE_REABERTURA`) |
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

O parser do formato oficial da Meta já está escrito em `src/lib/integrations/meta.js` (mensagens de todos os tipos, anexos, eventos de status e template); mensagens duplicadas são descartadas pelo `idExterno`. Preencha `META_APP_SECRET` para validar a assinatura dos webhooks e `WHATSAPP_TEMPLATE_REABERTURA` com o nome do template aprovado para reabrir conversas após 24h. Para outro provedor (Evolution API, Twilio, Z-API), basta criar um arquivo com `enviar`, `baixarMidia` e `normalizarWebhook` e registrá-lo em `src/lib/integrations/index.js`.

Auditoria dos webhooks: `GET /api/webhooks/eventos?status=ERRO|OK|TODOS` lista os eventos gravados; `POST /api/webhooks/eventos` com `{ "id": "..." }` ou `{ "todos": true }` reprocessa.

## Próximos passos sugeridos

- Autenticação e multiusuário (o modelo `User` já existe, falta login e escopo por responsável).
- Envio de anexos (imagem/PDF do orçamento) pelo próprio inbox.
- Cadência automática de follow-up para o motivo "cliente não respondeu".
- Migração para Postgres: trocar o `provider` em `prisma/schema.prisma` e a `DATABASE_URL`.
