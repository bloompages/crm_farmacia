import { afterEach, describe, expect, it, vi } from "vitest";
import { inscreverWaba, avisosDeSaude } from "@/lib/integrations/meta";

const resposta = (json, ok = true) => ({ ok, json: async () => json });
const erroMeta = (code) => resposta({ error: { code } }, false);

describe("inscreverWaba", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("com a WABA informada: confere o número e inscreve o app", async () => {
    const fetch = vi.fn(async (url, opcoes) => {
      if (url.includes("/999/phone_numbers")) return resposta({ data: [{ id: "111" }] });
      if (url.endsWith("/999/subscribed_apps") && opcoes?.method === "POST") return resposta({ success: true });
      return erroMeta(100);
    });
    vi.stubGlobal("fetch", fetch);
    expect(await inscreverWaba("111", "tok", "999")).toEqual({ ok: true });
    expect(fetch.mock.calls.some(([u]) => u.includes("debug_token"))).toBe(false);
  });

  it("com a WABA informada que não tem o número: avisa e não inscreve", async () => {
    const fetch = vi.fn(async () => resposta({ data: [{ id: "222" }] }));
    vi.stubGlobal("fetch", fetch);
    const r = await inscreverWaba("111", "tok", "999");
    expect(r.ok).toBe(false);
    expect(r.aviso).toMatch(/não pertence/);
    expect(fetch.mock.calls.some(([u]) => u.includes("subscribed_apps"))).toBe(false);
  });

  it("sem WABA: descobre pelo token", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url, opcoes) => {
      if (url.includes("debug_token")) return resposta({ data: { granular_scopes: [{ scope: "whatsapp_business_management", target_ids: ["999"] }] } });
      if (url.endsWith("/999/subscribed_apps") && opcoes?.method === "POST") return resposta({ success: true });
      return erroMeta(100);
    }));
    expect(await inscreverWaba("111", "tok")).toEqual({ ok: true });
  });

  it("sem WABA e com várias no token: escolhe a que tem o número", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url, opcoes) => {
      if (url.includes("debug_token")) return resposta({ data: { granular_scopes: [{ scope: "whatsapp_business_messaging", target_ids: ["A", "B"] }] } });
      if (url.includes("/A/phone_numbers")) return resposta({ data: [{ id: "222" }] });
      if (url.includes("/B/phone_numbers")) return resposta({ data: [{ id: "111" }] });
      if (url.endsWith("/B/subscribed_apps") && opcoes?.method === "POST") return resposta({ success: true });
      return erroMeta(100);
    }));
    expect(await inscreverWaba("111", "tok")).toEqual({ ok: true });
  });

  it("sem WABA e o token não lista nenhuma: pede o campo na tela", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resposta({ data: { granular_scopes: [{ scope: "whatsapp_business_management" }] } })));
    const r = await inscreverWaba("111", "tok");
    expect(r.ok).toBe(false);
    expect(r.aviso).toMatch(/Identificação da conta do WhatsApp Business/);
  });

  it("não lança quando a Meta recusa", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => erroMeta(190)));
    const r = await inscreverWaba("111", "tok", "999");
    expect(r.ok).toBe(false);
    expect(r.aviso).toMatch(/Token de acesso inválido/);
  });
});

describe("avisosDeSaude", () => {
  it("sem bloqueio: nenhum aviso", () => {
    expect(avisosDeSaude({ can_send_message: "AVAILABLE" })).toEqual([]);
    expect(avisosDeSaude(undefined)).toEqual([]);
  });

  it("traduz os bloqueios, sem repetir e ignorando os de chamada de voz", () => {
    const saude = {
      can_send_message: "BLOCKED",
      entities: [
        { entity_type: "PHONE_NUMBER", can_send_message: "AVAILABLE", errors: [{ error_code: 138024 }] },
        { entity_type: "WABA", can_send_message: "BLOCKED", errors: [{ error_code: 141006 }] },
        { entity_type: "BUSINESS", can_send_message: "BLOCKED", errors: [{ error_code: 141010 }, { error_code: 131000 }] },
        { entity_type: "OUTRA", can_send_message: "BLOCKED", errors: [{ error_code: 141006 }, { error_code: 138025 }] },
      ],
    };
    const avisos = avisosDeSaude(saude);
    expect(avisos).toHaveLength(4); // introdução + 3 bloqueios
    expect(avisos.join("\n")).toMatch(/forma de pagamento/);
    expect(avisos.join("\n")).toMatch(/verificada/);
    expect(avisos.join("\n")).toMatch(/Perfil da empresa incompleto/);
  });

  it("bloqueio desconhecido: usa a descrição da Meta", () => {
    const saude = { can_send_message: "BLOCKED", entities: [{ can_send_message: "BLOCKED", errors: [{ error_code: 999, error_description: "Algo novo" }] }] };
    expect(avisosDeSaude(saude)[1]).toBe("• Algo novo");
  });
});
