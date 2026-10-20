import { describe, expect, it } from "vitest";
import { analisarIntencao, scoreEsfriado, temperaturaPorScore } from "@/lib/intencao";

describe("analisarIntencao", () => {
  it("pedido de orçamento com quantidade é oportunidade quente", () => {
    const r = analisarIntencao("Boa tarde, me passa um orçamento de 10 caixas de dipirona?");
    expect(r.intencao).toBe("ORCAMENTO");
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.termos).toContain("quantidade");
  });

  it("ignora acentos e maiúsculas", () => {
    expect(analisarIntencao("QUANTO CUSTA?").score).toBe(analisarIntencao("quanto custa?").score);
    expect(analisarIntencao("orcamento").intencao).toBe("ORCAMENTO");
  });

  it("cada grupo de sinais conta uma vez", () => {
    expect(analisarIntencao("preço preço preço").score).toBe(analisarIntencao("preço").score);
  });

  it("conversa sem sinal comercial fica fria", () => {
    const r = analisarIntencao("bom dia!");
    expect(r).toMatchObject({ intencao: "OUTRO", score: 0 });
    expect(temperaturaPorScore(r.score)).toBe("FRIO");
  });
});

describe("scoreEsfriado", () => {
  const ha = (dias) => new Date(Date.now() - dias * 86400000);

  it("não perde pontos no mesmo dia", () => expect(scoreEsfriado(80, ha(0.5))).toBe(80));
  it("cai pela metade a cada 30 dias", () => {
    expect(scoreEsfriado(80, ha(30))).toBe(40);
    expect(scoreEsfriado(80, ha(60))).toBe(20);
  });
  it("chega a zero com o tempo", () => expect(scoreEsfriado(80, ha(365))).toBe(0));
});
