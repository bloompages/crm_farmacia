import { describe, expect, it } from "vitest";
import { normalizarEtiquetas, etiquetasParaTexto, contarEtiquetas } from "@/lib/etiquetas";
import { normalizarAtalho, aplicarModelo, termoDigitado, sugerir, primeiroNome } from "@/lib/mensagensRapidas";

describe("etiquetas", () => {
  it("minúsculas, sem repetição, sem espaços sobrando", () => {
    expect(normalizarEtiquetas(" VIP, vip ;  Recompra   mensal,, ")).toEqual(["vip", "recompra mensal"]);
    expect(etiquetasParaTexto(["Uso contínuo", "uso contínuo"])).toBe("uso contínuo");
  });
  it("conta o uso de cada etiqueta", () => {
    expect(contarEtiquetas([{ etiquetas: "vip,pj" }, { etiquetas: "vip" }, { etiquetas: "" }])).toEqual([
      { nome: "vip", total: 2 },
      { nome: "pj", total: 1 },
    ]);
  });
});

describe("mensagens rápidas", () => {
  it("atalho normalizado", () => {
    expect(normalizarAtalho("/Forma de Pagamento")).toBe("forma-de-pagamento");
    expect(normalizarAtalho("  ")).toBe("");
  });
  it("{nome} vira o primeiro nome, ou some sem deixar vírgula solta", () => {
    expect(aplicarModelo("Oi, {nome}! Tudo bem?", { nome: "MARIA aparecida" })).toBe("Oi, Maria! Tudo bem?");
    expect(aplicarModelo("Oi, {nome}! Tudo bem?", { nome: "@camila.toledo" })).toBe("Oi! Tudo bem?");
    expect(primeiroNome("5511987650001")).toBe("");
  });
  it("só abre sugestões quando o campo inteiro é /termo", () => {
    expect(termoDigitado("/pi")).toBe("pi");
    expect(termoDigitado("/")).toBe("");
    expect(termoDigitado("oi /pix")).toBeNull();
    expect(termoDigitado("/pix agora")).toBeNull();
  });
  it("sugere primeiro quem começa com o termo", () => {
    const lista = [{ atalho: "entrega", texto: "x" }, { atalho: "pix", texto: "chave" }, { atalho: "pix-cnpj", texto: "y" }];
    expect(sugerir(lista, "pix").map((m) => m.atalho)).toEqual(["pix", "pix-cnpj"]);
    expect(sugerir(lista, "chave").map((m) => m.atalho)).toEqual(["pix"]);
  });
});
