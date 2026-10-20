import { describe, expect, it } from "vitest";
import { formatarTelefone, normalizarTelefone } from "@/lib/telefone";

describe("normalizarTelefone", () => {
  it.each([
    ["(11) 98765-4321", "5511987654321"],
    ["011 98765-4321", "5511987654321"],
    ["+55 11 98765-4321", "5511987654321"],
    ["551187654321", "5511987654321"], // wa_id sem o 9º dígito
    ["0055 11 8765-4321", "5511987654321"],
    ["551133334444", "551133334444"], // fixo não ganha 9
    ["+1 415 555 0100", "14155550100"], // estrangeiro mantém o DDI
  ])("%s → %s", (entrada, esperado) => expect(normalizarTelefone(entrada)).toBe(esperado));

  it("vazio vira null", () => {
    expect(normalizarTelefone("")).toBeNull();
    expect(normalizarTelefone(null)).toBeNull();
    expect(normalizarTelefone("sem número")).toBeNull();
  });
});

it("formatarTelefone exibe no padrão brasileiro", () => {
  expect(formatarTelefone("5511987654321")).toBe("(11) 98765-4321");
  expect(formatarTelefone("551133334444")).toBe("(11) 3333-4444");
  expect(formatarTelefone("14155550100")).toBe("14155550100");
});
