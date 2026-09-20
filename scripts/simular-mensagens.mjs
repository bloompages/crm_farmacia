/**
 * Simulador de mensagens recebidas (provedor "mock").
 * Dispara nos webhooks reais do CRM, exercitando ingestão, detecção de
 * intenção, criação automática de lead, anexos e eventos de status.
 *
 *   npm run simular                    # roteiro padrão (texto, parágrafos, PDF, foto, áudio, botão, localização)
 *   npm run simular -- "texto"         # uma mensagem avulsa de WhatsApp
 *   npm run simular -- --quebrado      # envia um payload inválido para ver o evento com erro no inbox
 */
const BASE = process.env.CRM_URL ?? "http://localhost:3000";

const ROTEIRO = [
  { canal: "WHATSAPP", de: "5511970001111", nome: "Paulo Andrade", texto: "Boa tarde! Quanto custa a insulina NPH? Preciso de 4 frascos" },
  { canal: "WHATSAPP", de: "5511970002222", nome: "Juliana Prado", texto: "Vocês manipulam fórmula com receita do dermatologista?\n\nSegue a receita em anexo, são *3 itens*.\n\nQueria um orçamento com entrega, por favor 🙏" },
  { canal: "WHATSAPP", de: "5511970002222", nome: "Juliana Prado", tipo: "DOCUMENTO", midiaId: "demo_receita_juliana", mime: "application/pdf", arquivo: "receita-juliana.pdf", tamanho: 210000, texto: "" },
  { canal: "WHATSAPP", de: "5511970002222", nome: "Juliana Prado", tipo: "IMAGEM", midiaId: "demo_foto_juliana", mime: "image/jpeg", tamanho: 640000, texto: "foto da embalagem que uso hoje" },
  { canal: "WHATSAPP", de: "5511970003333", nome: "Marcos Vinícius", tipo: "AUDIO", midiaId: "demo_audio", mime: "audio/ogg", texto: "" },
  { canal: "WHATSAPP", de: "5511970003333", nome: "Marcos Vinícius", texto: "Qual o horário de vocês no feriado?" },
  { canal: "WHATSAPP", de: "5511970004444", nome: "Beatriz Lima", tipo: "INTERATIVA", texto: "Quero um orçamento" },
  { canal: "WHATSAPP", de: "5511970004444", nome: "Beatriz Lima", tipo: "LOCALIZACAO", texto: "Casa — Rua das Flores, 120", url: "https://www.google.com/maps?q=-23.5880,-46.6340" },
  { canal: "INSTAGRAM", de: "nutri.rafaela", nome: "@nutri.rafaela", texto: "Oi! Atendem convênio para minha clínica? Quero cotação mensal de suplementos" },
  { canal: "INSTAGRAM", de: "lucas.fit", nome: "@lucas.fit", texto: "tem whey em estoque? qual o preço da unidade" },
];

async function enviar(evento, rota) {
  const r = await fetch(`${BASE}/api/webhooks/${rota}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof evento === "string" ? evento : JSON.stringify(evento),
  });
  const json = await r.json().catch(() => ({}));
  return json;
}

const args = process.argv.slice(2);

if (args[0] === "--quebrado") {
  const json = await enviar("{isto nao é json", "whatsapp");
  console.log("payload inválido ->", json);
  const json2 = await enviar({ canal: "WHATSAPP", de: "5511970009999", nome: "Sem texto", tipo: "OUTRO", texto: "" }, "whatsapp");
  console.log("evento vazio ->", json2);
  process.exit(0);
}

const avulsa = args.join(" ");
const eventos = avulsa
  ? [{ canal: "WHATSAPP", de: "5511970009999", nome: "Teste manual", texto: avulsa }]
  : ROTEIRO;

for (const e of eventos) {
  const rota = e.canal === "INSTAGRAM" ? "instagram" : "whatsapp";
  const json = await enviar(e, rota);
  const res = json.resultados?.[0];
  const rotuloTipo = e.tipo && e.tipo !== "TEXTO" ? `[${e.tipo}] ` : "";
  console.log(
    `[${e.canal}] ${e.nome}: ${rotuloTipo}${res ? `intenção ${res.intencao} (score ${res.score})${res.leadCriado ? " · LEAD NOVO criado" : ""}${res.oportunidade ? " · oportunidade" : ""}${res.duplicada ? " · duplicada (ignorada)" : ""}` : JSON.stringify(json)}`
  );
}
