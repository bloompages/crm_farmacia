import { describe, expect, it } from "vitest";
import { gerarCsv, lerCsv, detectarSeparador, mapearColunas, lerData, numeroCsv, lerSimNao } from "@/lib/csv";

describe("gerarCsv", () => {
  const colunas = [{ titulo: "Nome", valor: (l) => l.nome }, { titulo: "Total", valor: (l) => numeroCsv(l.total) }];

  it("sai no formato do Excel brasileiro: BOM, ponto e vírgula, CRLF, vírgula decimal", () => {
    const csv = gerarCsv(colunas, [{ nome: "João", total: 1234.5 }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿Nome;Total\r\nJoão;1234,5\r\n");
  });

  it("aspas em campos com ; aspas ou quebra de linha", () => {
    const csv = gerarCsv(colunas, [{ nome: 'Clínica "Vida"; matriz\nSP', total: 0 }]);
    expect(csv).toContain('"Clínica ""Vida""; matriz\nSP"');
  });

  it("neutraliza fórmula do Excel, mas não telefone ou número negativo", () => {
    const csv = gerarCsv([{ titulo: "x", valor: (l) => l }], ["=HYPERLINK(\"x\")", "+55 (11) 98765-4321", "-12,50", "@SOMA(A1)"]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'@SOMA");
    expect(csv).toContain("\r\n+55 (11) 98765-4321\r\n");
    expect(csv).toContain("\r\n-12,50\r\n");
  });

  it("ida e volta preserva o conteúdo", () => {
    const linhas = [{ nome: 'Ana "A"; B\nC', total: 10 }, { nome: "Zé", total: null }];
    const { cabecalho, linhas: lidas } = lerCsv(gerarCsv(colunas, linhas));
    expect(cabecalho).toEqual(["Nome", "Total"]);
    expect(lidas.map((l) => l.valores)).toEqual([['Ana "A"; B\nC', "10"], ["Zé", ""]]);
  });
});

describe("lerCsv", () => {
  it("detecta vírgula, ponto e vírgula e tab", () => {
    expect(detectarSeparador("nome,telefone\nA,1")).toBe(",");
    expect(detectarSeparador("nome;telefone\nA;1")).toBe(";");
    expect(detectarSeparador("nome\ttelefone")).toBe("\t");
    expect(detectarSeparador('"a,b";c\n')).toBe(";");
  });

  it("numera as linhas como na planilha e pula linhas vazias", () => {
    const { linhas } = lerCsv("Nome;Tel\r\nA;1\r\n;\r\n\r\n\"B\nquebrado\";2\r\nC;3");
    expect(linhas.map((l) => [l.numero, l.valores[0]])).toEqual([[2, "A"], [5, "B\nquebrado"], [7, "C"]]);
  });
});

it("mapearColunas casa cabeçalhos sem acento, caixa e pontuação", () => {
  const mapa = mapearColunas(["NOME", "Telefone / WhatsApp", "E-mail", "Aniversário"], {
    nome: ["nome"], telefone: ["telefone whatsapp"], email: ["e mail"], dataNascimento: ["aniversario"], cpf: ["cpf"],
  });
  expect(mapa).toEqual({ nome: 0, telefone: 1, email: 2, dataNascimento: 3 });
});

describe("lerData", () => {
  it("aceita dd/mm/aaaa, dd/mm/aa, ISO e número de série do Excel", () => {
    const iso = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    expect(iso(lerData("25/12/1980"))).toBe("1980-12-25");
    expect(iso(lerData("05/03/85"))).toBe("1985-3-5");
    expect(iso(lerData("1980-12-25"))).toBe("1980-12-25");
    expect(iso(lerData("29580"))).toBe("1980-12-25");
  });
  it("vazio é null; data impossível é undefined", () => {
    expect(lerData("")).toBeNull();
    expect(lerData("31/02/1990")).toBeUndefined();
    expect(lerData("amanhã")).toBeUndefined();
  });
});

it("lerSimNao", () => {
  expect(["sim", "S", "x", "1", "TRUE"].map(lerSimNao)).toEqual([true, true, true, true, true]);
  expect(["não", "", "n", "0"].map(lerSimNao)).toEqual([false, false, false, false]);
});
