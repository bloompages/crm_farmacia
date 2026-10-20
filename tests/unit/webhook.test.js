import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verificarAssinatura } from "@/lib/webhook";
import { provedorMeta } from "@/lib/integrations/meta";

const assinar = (corpo, segredo) => `sha256=${createHmac("sha256", segredo).update(corpo).digest("hex")}`;

describe("verificarAssinatura", () => {
  afterEach(() => vi.unstubAllEnvs());
  const corpo = JSON.stringify({ entry: [] });

  it("com segredo: aceita só a assinatura correta", () => {
    vi.stubEnv("META_APP_SECRET", "segredo");
    expect(verificarAssinatura(corpo, assinar(corpo, "segredo")).ok).toBe(true);
    expect(verificarAssinatura(corpo, assinar(corpo, "outro")).ok).toBe(false);
    expect(verificarAssinatura(corpo, "sha256=abc").ok).toBe(false);
    expect(verificarAssinatura(corpo, null).ok).toBe(false);
  });

  it("sem segredo: aceita em desenvolvimento, recusa em produção", () => {
    vi.stubEnv("META_APP_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(verificarAssinatura(corpo, null).ok).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(verificarAssinatura(corpo, null)).toMatchObject({ ok: false, configuracao: true });
  });
});

describe("parser da Meta", () => {
  it("extrai mensagem e status do WhatsApp Cloud API", () => {
    const eventos = provedorMeta.normalizarWebhook({
      entry: [{
        changes: [{
          value: {
            contacts: [{ wa_id: "551187654321", profile: { name: "Maria" } }],
            messages: [{ from: "551187654321", id: "wamid.1", timestamp: "1700000000", type: "text", text: { body: "quanto custa?" } }],
            statuses: [{ id: "wamid.0", status: "read", timestamp: "1700000001" }],
          },
        }],
      }],
    }, "WHATSAPP");
    expect(eventos).toHaveLength(2);
    expect(eventos[0]).toMatchObject({ tipoEvento: "MENSAGEM", canal: "WHATSAPP", contatoExterno: "551187654321", nomeExibicao: "Maria", idExterno: "wamid.1", texto: "quanto custa?" });
    expect(eventos[1]).toMatchObject({ tipoEvento: "STATUS", idExterno: "wamid.0", status: "LIDA" });
  });

  it("payload vazio ou estranho não quebra", () => {
    expect(provedorMeta.normalizarWebhook({}, "WHATSAPP")).toEqual([]);
    expect(provedorMeta.normalizarWebhook(null, "WHATSAPP")).toEqual([]);
  });
});
