# Implantação de um cliente novo

O CRM serve para qualquer segmento. Na tela de configuração o cliente escolhe o **segmento** (Farmácia, Clínica, Loja, Serviços ou Outro). O segmento ajusta as categorias de produto, as palavras que indicam pedido de orçamento, o campo de convênio e a política de privacidade. Os exemplos abaixo falam em "farmácia", mas valem para qualquer empresa.

Modelo: **uma instância por farmácia**. Cada cliente tem o próprio projeto na Vercel, um banco só dele e um endereço próprio. Os dados de uma farmácia nunca ficam no mesmo banco que os de outra.

O trabalho está dividido para pesar pouco:

| Quem | O quê | Onde | Tempo |
|---|---|---|---|
| Fornecedor (nós) | Criar a instância: projeto, banco e 4 variáveis | Painel da Vercel | ~10 min, uma vez por cliente |
| Gerente da farmácia (com a nossa ajuda na primeira vez) | Dados da farmácia, WhatsApp, template, equipe | Tela **Configurações › Empresa e integrações** do CRM | ~30 min |
| Ninguém | Atualizações do CRM | Automático a cada push (ver *Atualizações*) | — |

---

## 1. Criar a instância (fornecedor)

1. **Vercel › Add New › Project** › importe o repositório `crm_farmacia`. Nome sugerido: `crm-<farmacia>` (ex.: `crm-saojoao`).
2. **Settings › Git › Production Branch:** `producao` (ver *Atualizações*).
3. **Storage › Create Database › Prisma Postgres** e ligue o banco ao projeto. A Vercel cria a `DATABASE_URL` sozinha.
4. **Settings › Environment Variables** (ambiente *Production*):

   | Variável | Valor |
   |---|---|
   | `CHAVE_CRIPTOGRAFIA` | gere uma por cliente: `openssl rand -base64 32`. **Guarde num cofre de senhas**: se ela for perdida, os tokens salvos precisam ser cadastrados de novo. |
   | `META_APP_SECRET` | App secret do app da Meta que vai receber os webhooks desta farmácia (ver seção 3) |
   | `GERENTE_EMAIL` | e-mail do gerente da farmácia |
   | `GERENTE_SENHA_INICIAL` | senha provisória; apague a variável depois do primeiro acesso |

   Não defina `PROVEDOR_MENSAGERIA` nem as variáveis antigas de WhatsApp/privacidade: isso tudo é configurado pela tela.
5. **Deploy.** O build cria as tabelas e o primeiro gerente.
6. (Opcional) **Settings › Domains:** `crm.farmaciasaojoao.com.br` ou `saojoao.<nosso-dominio>`.

Confira: abra `https://<dominio>/login`, entre como gerente e veja o aviso **"Implantação: 1 de 5 etapas"** no painel.

## 2. Configurar a farmácia (gerente, pela tela)

Em **Configurações › Empresa e integrações**, o roteiro mostra o que falta:

1. **Dados da empresa:** segmento, nome fantasia, razão social, CNPJ, e-mail de privacidade, endereço e telefone. O **nome fantasia é o nome do sistema para a equipe**: aparece no menu, na tela de login e na aba do navegador. A política de privacidade pública (`/privacidade`) é preenchida com esses dados na hora.
2. **WhatsApp conectado:** cole a *identificação do número de telefone*, a *identificação da conta do WhatsApp Business* (WABA ID, ao lado do Phone Number ID no painel da Meta) e o *token permanente*, e clique em **Testar conexão**. O teste:
   - inscreve o app na conta do WhatsApp Business (`subscribed_apps`). **Sem essa inscrição a Meta só entrega os testes do painel, nunca as mensagens reais dos clientes**;
   - mostra em português o que a Meta está bloqueando (forma de pagamento, verificação da empresa, perfil incompleto) e onde resolver.
3. **Mensagens chegando no CRM:** copie a *URL de callback* e o *verificar token* da tela para a Meta (WhatsApp › Configuração › Webhooks), clique em *Verificar e salvar*, assine o campo `messages` e mande uma mensagem de teste para o número.
4. **Template de reabertura:** nome do template aprovado na Meta.
5. **Equipe:** crie os atendentes em *Equipe e LGPD*.

### O que pedir para a farmácia antes

- Razão social, CNPJ, endereço e um e-mail para pedidos de privacidade.
- **Um número de telefone que vai ser só do CRM.** Se for o número atual do WhatsApp Business do celular, ele sai do app e passa a funcionar só pelo CRM (avise isso com clareza).
- Acesso ao **Business Manager (Meta Business Suite)** da farmácia, ou alguém da farmácia disponível para criar e verificar a conta.
- Documentos para a **verificação da empresa** na Meta (cartão CNPJ, comprovante de endereço). Sem verificação, o número fica limitado a poucas conversas por dia.
- No **Meta Business Suite da farmácia**, antes de começar a atender:
  - *Configurações › Informações da empresa:* razão social, país e site preenchidos;
  - *Contas do WhatsApp › Pagamentos:* um cartão cadastrado;
  - *Central de segurança:* verificação da empresa iniciada.

  Sem esses três itens a farmácia **só consegue responder quem escreveu nas últimas 24h**: templates e mensagens iniciadas por ela ficam bloqueados. O **Testar conexão** lista o que ainda falta.

## 3. App da Meta: de quem é?

Cada instância tem a própria URL de webhook, e um app da Meta tem uma URL de callback por produto. Há dois caminhos:

- **Um app por farmácia (mais simples para começar):** o app é criado no Business Manager da farmácia, com a gente como parceiro. O `META_APP_SECRET` desse app vai na instância dela. O WhatsApp e o Instagram funcionam igual ao teste que fizemos.
- **Um app nosso para todas (escala melhor, mais tarde):** com o cadastro de *Tech Provider* e o *Embedded Signup*, a farmácia conecta o número com um clique, e cada conta de WhatsApp recebe a URL de callback da sua instância (*override callback URI* por WABA). Dá mais trabalho na Meta e no CRM. Vale a pena quando houver vários clientes.

Em qualquer caminho, a **política de privacidade do app** é a da empresa dona do app. No app por farmácia, use `https://<dominio>/privacidade`.

## 4. Atualizações

Todos os projetos da Vercel apontam para o **mesmo repositório**. Para não quebrar todos os clientes de uma vez:

- `main` → só a instância de **demonstração** (a nossa). Todo push vai primeiro para ela.
- `producao` → instâncias dos **clientes**. Depois de conferir na demonstração:

  ```bash
  git push origin main:producao
  ```

  A Vercel publica em todos os clientes ao mesmo tempo. O build de cada um atualiza as tabelas sozinho e **falha em vez de apagar dados** se uma mudança de schema for destrutiva. Nesse caso, o cliente continua na versão anterior, sem quebrar.

Para voltar um cliente para a versão anterior: Vercel › projeto › Deployments › deploy anterior › *Instant Rollback* (depois, *Undo Rollback* para voltar a receber atualizações).

## 5. Encerrar um cliente

1. Exporte os dados para a farmácia (Configurações › Planilhas), se ela pedir.
2. Vercel: apague o banco (Storage) e o projeto.
3. Meta: remova o número do app e revogue o token do usuário do sistema.
