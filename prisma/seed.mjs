import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const diasAtras = (d, h = 10) => {
  const x = new Date();
  x.setDate(x.getDate() - d);
  x.setHours(h, Math.floor(Math.random() * 59), 0, 0);
  return x;
};
const horasAtras = (h) => new Date(Date.now() - h * 3600 * 1000);
const sorteio = (a) => a[Math.floor(Math.random() * a.length)];

const PRODUTOS = [
  ["Losartana 50mg 30cp", "Medicamento", 18.9],
  ["Metformina 850mg 60cp", "Medicamento", 24.5],
  ["Dipirona 1g 20cp", "Medicamento", 12.4],
  ["Insulina NPH 10ml", "Medicamento", 96.0],
  ["Fórmula manipulada emagrecimento 60cáps", "Manipulado", 189.0],
  ["Minoxidil 5% solução 100ml", "Manipulado", 145.0],
  ["Vitamina D3 2000UI 60cáps", "Suplemento", 59.9],
  ["Whey protein 900g", "Suplemento", 149.9],
  ["Protetor solar FPS 70 200ml", "Dermocosmético", 89.9],
  ["Sérum vitamina C 30ml", "Dermocosmético", 129.0],
  ["Fralda geriátrica G 8un", "Perfumaria", 42.0],
  ["Aparelho de pressão digital", "Perfumaria", 179.0],
];

const LEADS = [
  { nome: "Maria Aparecida Souza", telefone: "5511987650001", origem: "WHATSAPP", tipo: "PF", interesses: "manipulados,dermocosméticos" },
  { nome: "Clínica Vida Plena", telefone: "5511987650002", origem: "INDICACAO", tipo: "PJ", empresa: "Clínica Vida Plena", interesses: "insumos,convênio" },
  { nome: "João Pedro Martins", telefone: "5511987650003", origem: "INSTAGRAM", tipo: "PF", interesses: "suplementos" },
  { nome: "Rita Camargo", telefone: "5511987650004", origem: "BALCAO", tipo: "PF", interesses: "medicamento contínuo" },
  { nome: "Academia Corpo & Cia", telefone: "5511987650005", origem: "INSTAGRAM", tipo: "PJ", empresa: "Corpo & Cia", interesses: "suplementos,whey" },
  { nome: "Dr. Henrique Lopes", telefone: "5511987650006", origem: "INDICACAO", tipo: "PJ", empresa: "Consultório Lopes", interesses: "manipulados" },
  { nome: "Fernanda Ribeiro", telefone: "5511987650007", origem: "WHATSAPP", tipo: "PF", interesses: "dermocosméticos" },
  { nome: "Sebastião Nunes", telefone: "5511987650008", origem: "BALCAO", tipo: "PF", interesses: "diabetes,insulina" },
  { nome: "Lar Bem Viver (ILPI)", telefone: "5511987650009", origem: "SITE", tipo: "PJ", empresa: "Lar Bem Viver", interesses: "fraldas,medicamento contínuo" },
  { nome: "Camila Toledo", telefone: "5511987650010", origem: "INSTAGRAM", tipo: "PF", interesses: "emagrecimento" },
];

const CONVERSAS = [
  { canal: "WHATSAPP", contato: "5511987650001", nome: "Maria Aparecida Souza", msgs: [
    ["ENTRADA", "Bom dia! Vocês fazem manipulado de minoxidil 5%?", 3],
    ["SAIDA", "Bom dia, Maria! Fazemos sim. O frasco de 100ml sai por R$ 145,00, pronto em 48h.", 3],
    ["ENTRADA", "Quanto custa se eu levar 3 frascos? Quero fechar hoje", 2],
  ]},
  { canal: "WHATSAPP", contato: "5511987650009", nome: "Lar Bem Viver (ILPI)", msgs: [
    ["ENTRADA", "Boa tarde, preciso de orçamento mensal de fraldas geriátricas, 40 pacotes tamanho G", 6],
    ["SAIDA", "Boa tarde! Envio ainda hoje a proposta com preço de recorrência mensal.", 6],
    ["ENTRADA", "Perfeito, a diretoria decide na sexta", 5],
  ]},
  { canal: "INSTAGRAM", contato: "camila.toledo", nome: "@camila.toledo", msgs: [
    ["ENTRADA", "oi! vi o post da fórmula de emagrecimento, qual o preço?", 2],
    ["SAIDA", "Oi Camila! A fórmula de 60 cápsulas sai R$ 189,00. Quer que eu monte o orçamento?", 2],
    ["ENTRADA", "manda sim, mas achei em outra farmácia por 160", 1],
  ]},
  { canal: "INSTAGRAM", contato: "corpoecia.oficial", nome: "@corpoecia.oficial", msgs: [
    ["ENTRADA", "Fazem parceria com academia? Queremos whey pros alunos, umas 20 unidades por mês", 8],
    ["SAIDA", "Fazemos! Consigo tabela especial por volume. Passo a proposta hoje.", 8],
  ]},
  { canal: "WHATSAPP", contato: "5511987650003", nome: "João Pedro Martins", msgs: [
    ["ENTRADA", "vcs tem vitamina D 2000? tem em estoque?", 4],
    ["SAIDA", "Temos! R$ 59,90 o frasco com 60 cápsulas.", 4],
    ["ENTRADA", "beleza, vou pensar", 4],
  ]},
  { canal: "WHATSAPP", contato: "5511999990001", nome: "Contato novo", msgs: [
    ["ENTRADA", "Olá, qual o horário de funcionamento aos domingos?", 1],
  ]},
  // Conversa recente (janela de 24h aberta) com receita em PDF, foto e texto formatado em parágrafos
  { canal: "WHATSAPP", contato: "5511987650007", nome: "Fernanda Ribeiro", msgs: [
    ["ENTRADA", "Boa tarde! Segue a receita do dermatologista", { horas: 5 }, { tipo: "DOCUMENTO", midiaId: "demo_receita", midiaMime: "application/pdf", midiaNome: "receita-dra-camila.pdf", midiaTamanho: 184320 }],
    ["ENTRADA", "", { horas: 5 }, { tipo: "IMAGEM", midiaId: "demo_foto", midiaMime: "image/jpeg", midiaTamanho: 921600 }],
    ["ENTRADA", "Preciso de orçamento dos *3 itens* da receita.\n\nSe possível com entrega, moro na Vila Mariana.\n\nPode ser hoje? _Obrigada!_", { horas: 4 }],
    ["SAIDA", "Boa tarde, Fernanda! Recebi a receita.\n\nOrçamento dos 3 itens:\n1. Ácido retinoico 0,05% 30g — R$ 78,00\n2. Hidroquinona 4% 30g — R$ 92,00\n3. Protetor solar FPS 70 — R$ 89,90\n\n*Total: R$ 259,90* com entrega grátis na Vila Mariana. Fica pronto em 48h.", { horas: 3 }],
    ["SAIDA", "!falha Posso confirmar o pedido?", { horas: 2 }, { status: "FALHOU", erro: "Simulação: o provedor recusou a mensagem." }],
  ]},
];

async function main() {
  // limpeza (ordem respeita as FKs)
  await db.mensagem.deleteMany();
  await db.conversa.deleteMany();
  await db.eventoWebhook.deleteMany();
  await db.itemOrcamento.deleteMany();
  await db.orcamento.deleteMany();
  await db.atividade.deleteMany();
  await db.lead.deleteMany();
  await db.produto.deleteMany();
  await db.user.deleteMany();

  const ana = await db.user.create({ data: { nome: "Ana Vitória", email: "ana@farmacia.com.br", cargo: "Gerente comercial" } });
  await db.user.create({ data: { nome: "Bruno Castro", email: "bruno@farmacia.com.br" } });

  const produtos = [];
  for (const [nome, categoria, preco] of PRODUTOS) {
    produtos.push(await db.produto.create({ data: { nome, categoria, preco } }));
  }

  const leads = {};
  for (const [i, l] of LEADS.entries()) {
    const criado = await db.lead.create({
      data: {
        ...l,
        interesses: l.interesses ?? "",
        responsavelId: ana.id,
        score: 20 + ((i * 13) % 70),
        temperatura: i % 3 === 0 ? "QUENTE" : i % 3 === 1 ? "MORNO" : "FRIO",
        etapa: ["NOVO", "ORCAMENTO", "APROVADO", "NOVO", "ORCAMENTO", "PERDIDO"][i % 6],
        primeiroContatoEm: diasAtras(60 - i * 4),
        ultimoContatoEm: diasAtras(10 - (i % 9)),
        createdAt: diasAtras(60 - i * 4),
      },
    });
    leads[l.telefone] = criado;
    await db.atividade.create({
      data: { leadId: criado.id, tipo: "NOTA", descricao: `Lead cadastrado (origem ${l.origem.toLowerCase()}).`, autorId: ana.id, createdAt: diasAtras(60 - i * 4) },
    });
  }

  const lista = Object.values(leads);

  // orçamentos: mix de ganhos, perdidos com motivo quantificado e em aberto
  const REJEICOES = [
    { motivo: "PRECO", detalhe: "Achou caro em relação à drogaria da esquina.", concorrente: "Drogaria Popular", desconto: 0.82 },
    { motivo: "CONCORRENCIA", detalhe: "Fechou com o concorrente que entregou no mesmo dia.", concorrente: "Farma+ Delivery", desconto: 0.88 },
    { motivo: "SEM_ESTOQUE", detalhe: "Precisava para o mesmo dia e o item estava em falta." },
    { motivo: "SEM_RESPOSTA", detalhe: "Enviamos a proposta e o cliente não retornou após 3 tentativas." },
    { motivo: "PRAZO_ENTREGA", detalhe: "Manipulação em 72h; o cliente precisava em 24h." },
    { motivo: "CONVENIO", detalhe: "Conseguiu o medicamento pelo plano de saúde." },
    { motivo: "PRECO", detalhe: "Pediu 20% de desconto e não foi possível.", concorrente: "Drogaria Popular", desconto: 0.8 },
    { motivo: "DESISTIU", detalhe: "Adiou o tratamento." },
  ];

  let r = 0;
  for (let i = 0; i < 22; i++) {
    const lead = lista[i % lista.length];
    const qtdItens = 1 + (i % 3);
    const itens = Array.from({ length: qtdItens }, () => {
      const p = sorteio(produtos);
      const quantidade = 1 + Math.floor(Math.random() * 5);
      return { produtoId: p.id, descricao: p.nome, quantidade, precoUnit: p.preco, subtotal: quantidade * p.preco };
    });
    const bruto = itens.reduce((t, x) => t + x.subtotal, 0);
    const desconto = i % 4 === 0 ? Math.round(bruto * 0.05 * 100) / 100 : 0;
    const total = Math.round((bruto - desconto) * 100) / 100;
    const criadoEm = diasAtras(75 - i * 3, 9);

    let status = "ENVIADO", extra = {};
    if (i % 5 === 0) status = "ACEITO";
    else if (i % 5 === 1 || i % 5 === 3) {
      status = "REJEITADO";
      const rj = REJEICOES[r++ % REJEICOES.length];
      extra = {
        motivoRejeicao: rj.motivo,
        detalheRejeicao: rj.detalhe,
        concorrente: rj.concorrente ?? null,
        precoConcorrente: rj.desconto ? Math.round(total * rj.desconto * 100) / 100 : null,
      };
    } else if (i % 5 === 4 && i > 15) status = "RASCUNHO";

    const orc = await db.orcamento.create({
      data: {
        numero: 1000 + i,
        leadId: lead.id,
        responsavelId: ana.id,
        status,
        desconto,
        total,
        createdAt: criadoEm,
        enviadoEm: status === "RASCUNHO" ? null : criadoEm,
        fechadoEm: ["ACEITO", "REJEITADO"].includes(status) ? diasAtras(70 - i * 3, 15) : null,
        validadeEm: diasAtras(60 - i * 3, 18),
        ...extra,
        itens: { create: itens },
      },
    });

    await db.atividade.create({
      data: {
        leadId: lead.id,
        tipo: "ORCAMENTO",
        autorId: ana.id,
        createdAt: criadoEm,
        descricao:
          status === "REJEITADO"
            ? `Orçamento #${orc.numero} rejeitado — ${extra.motivoRejeicao}`
            : `Orçamento #${orc.numero} (${status.toLowerCase()}) — R$ ${total.toFixed(2)}`,
      },
    });
  }

  // conversas e mensagens dos canais
  const quando = (q, direcao) => (typeof q === "object" ? horasAtras(q.horas) : diasAtras(q, direcao === "ENTRADA" ? 9 : 11));
  for (const c of CONVERSAS) {
    const lead = leads[c.contato];
    const ultimaDoCliente = c.msgs.filter((m) => m[0] === "ENTRADA").at(-1);
    const conversa = await db.conversa.create({
      data: {
        canal: c.canal,
        contatoExterno: c.contato,
        nomeExibicao: c.nome,
        leadId: lead?.id ?? null,
        naoLidas: c.msgs.at(-1)[0] === "ENTRADA" ? 1 : 0,
        ultimaMsgEm: quando(c.msgs.at(-1)[2], c.msgs.at(-1)[0]),
        ultimaMsgClienteEm: ultimaDoCliente ? quando(ultimaDoCliente[2], "ENTRADA") : null,
        createdAt: quando(c.msgs[0][2], c.msgs[0][0]),
      },
    });
    for (const [direcao, texto, q, extra = {}] of c.msgs) {
      await db.mensagem.create({
        data: {
          conversaId: conversa.id,
          direcao,
          texto,
          tipo: extra.tipo ?? "TEXTO",
          status: extra.status ?? (direcao === "ENTRADA" ? "RECEBIDA" : "LIDA"),
          erro: extra.erro ?? null,
          midiaId: extra.midiaId ?? null,
          midiaMime: extra.midiaMime ?? null,
          midiaNome: extra.midiaNome ?? null,
          midiaTamanho: extra.midiaTamanho ?? null,
          intencao: direcao === "ENTRADA" ? (/preço|quanto|orçamento|estoque/i.test(texto) ? "COMPRA" : "DUVIDA") : null,
          scoreIntencao: direcao === "ENTRADA" ? (/preço|quanto|orçamento|fechar/i.test(texto) ? 55 : 8) : 0,
          enviadoEm: quando(q, direcao),
        },
      });
    }
  }

  const [nLeads, nOrc, nRej, nMsg] = await Promise.all([
    db.lead.count(), db.orcamento.count(),
    db.orcamento.count({ where: { status: "REJEITADO" } }), db.mensagem.count(),
  ]);
  console.log(`Seed concluído: ${nLeads} leads · ${nOrc} orçamentos (${nRej} rejeitados) · ${nMsg} mensagens`);
}

main().finally(() => db.$disconnect());
