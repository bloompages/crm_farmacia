import { vi } from "vitest";

/**
 * As rotas leem o usuário logado de um header que o middleware injeta.
 * Nos testes, `comoUsuario(id)` faz o papel do middleware.
 */
let headersAtuais = new Headers();
vi.mock("next/headers", () => ({ headers: async () => headersAtuais }));

globalThis.comoUsuario = (id) => {
  headersAtuais = new Headers(id ? { "x-crm-usuario": id } : {});
};
