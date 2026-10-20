const producao = () => process.env.NODE_ENV === "production";
const usandoMeta = () => (process.env.PROVEDOR_MENSAGERIA || "mock").toLowerCase() === "meta";

/**
 * Problemas de configuração exibidos na barra de sincronização do inbox. No
 * simulador local (mock, fora de produção) não há o que alertar.
 */
export function alertasConfiguracao() {
  if (!producao() && !usandoMeta()) return [];
  const alertas = [];
  if (!process.env.META_APP_SECRET) {
    alertas.push(producao() ? "META_APP_SECRET ausente — webhooks estão sendo recusados" : "META_APP_SECRET ausente — webhooks aceitos sem assinatura");
  }
  if (!process.env.META_VERIFY_TOKEN) alertas.push("META_VERIFY_TOKEN ausente — a Meta não consegue verificar o webhook");
  return alertas;
}
