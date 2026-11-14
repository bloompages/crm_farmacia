import { afterEach, describe, expect, it, vi } from "vitest";
import { inscreverWaba } from "@/lib/integrations/meta";

const resposta = (json, ok = true) => ({ ok, json: async () => json });

describe("inscreverWaba", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("descobre a WABA pelo token e inscreve o app nela", async () => {
    const fetch = vi.fn(async (url, opcoes) => {
      if (url.includes("debug_token")) {
        return resposta({ data: { granular_scopes: [{ scope: "whatsapp_business_management", target_ids: ["999"] }] } });
      }
      if (url.endsWith("/999/subscribed_apps") && opcoes?.method === "POST") return resposta({ success: true });
      return resposta({ error: { code: 100 } }, false);
    });
    vi.stubGlobal("fetch", fetch);
    expect(await inscreverWaba("111", "tok")).toBe("inscrito para receber mensagens");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("com várias WABAs, escolhe a que tem o número", async () => {
    const fetch = vi.fn(async (url, opcoes) => {
      if (url.includes("debug_token")) {
        return resposta({ data: { granular_scopes: [{ scope: "whatsapp_business_messaging", target_ids: ["A", "B"] }] } });
      }
      if (url.includes("/A/phone_numbers")) return resposta({ data: [{ id: "222" }] });
      if (url.includes("/B/phone_numbers")) return resposta({ data: [{ id: "111" }] });
      if (url.endsWith("/B/subscribed_apps") && opcoes?.method === "POST") return resposta({ success: true });
      return resposta({ error: { code: 100 } }, false);
    });
    vi.stubGlobal("fetch", fetch);
    expect(await inscreverWaba("111", "tok")).toBe("inscrito para receber mensagens");
  });

  it("não lança: devolve o aviso quando a Meta recusa", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resposta({ error: { code: 190 } }, false)));
    expect(await inscreverWaba("111", "tok")).toMatch(/^⚠ não inscrito.*Token de acesso inválido/);
  });

  it("avisa quando o token não dá acesso a nenhuma WABA", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resposta({ data: { granular_scopes: [] } })));
    expect(await inscreverWaba("111", "tok")).toMatch(/^⚠ não inscrito/);
  });
});
