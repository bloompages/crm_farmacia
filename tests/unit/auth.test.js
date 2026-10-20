import { describe, expect, it } from "vitest";
import { hashSenha, loginBloqueado, problemaNaSenha, registrarTentativa, verificarSenha } from "@/lib/auth";

describe("senha", () => {
  it("hash confere com a senha certa e não com a errada", async () => {
    const h = await hashSenha("farmacia123");
    expect(h).toMatch(/^scrypt\$/);
    expect(h).not.toContain("farmacia123");
    expect(await verificarSenha("farmacia123", h)).toBe(true);
    expect(await verificarSenha("farmacia124", h)).toBe(false);
  });

  it("dois hashes da mesma senha são diferentes (sal)", async () => {
    expect(await hashSenha("farmacia123")).not.toBe(await hashSenha("farmacia123"));
  });

  it("usuário sem senha nunca entra", async () => {
    expect(await verificarSenha("", null)).toBe(false);
    expect(await verificarSenha("qualquer", "lixo")).toBe(false);
  });

  it("regras mínimas", () => {
    expect(problemaNaSenha("curta")).toMatch(/8 caracteres/);
    expect(problemaNaSenha("12345678")).toMatch(/números/);
    expect(problemaNaSenha("balcao2026")).toBeNull();
  });
});

it("bloqueia após 5 erros e libera com acerto", () => {
  const chave = `teste|${Math.random()}`;
  for (let i = 0; i < 4; i++) registrarTentativa(chave, false);
  expect(loginBloqueado(chave)).toBe(0);
  registrarTentativa(chave, false);
  expect(loginBloqueado(chave)).toBeGreaterThan(0);
  registrarTentativa(chave, true);
  expect(loginBloqueado(chave)).toBe(0);
});
