import { expect, it } from "vitest";
import { buscaLead, paraBusca } from "@/lib/busca";

it("paraBusca tira acento, caixa e espaços extras", () => {
  expect(paraBusca("  Orçamento   de MANIPULAÇÃO ")).toBe("orcamento de manipulacao");
});

it("buscaLead junta nome, empresa e e-mail ignorando vazios", () => {
  expect(buscaLead({ nome: "João", empresa: null, email: "Joao@Clinica.com" })).toBe("joao joao@clinica.com");
});
