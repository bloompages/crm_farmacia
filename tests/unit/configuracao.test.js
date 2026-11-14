import { afterEach, describe, expect, it, vi } from "vitest";
import { cifrar, decifrar } from "@/lib/cripto";
import { validarConfiguracao, cnpjValido, credenciaisDe, nomeProvedorDe, tokensVerificacaoDe, configuracaoPublica } from "@/lib/configuracao";

afterEach(() => vi.unstubAllEnvs());

describe("cripto", () => {
  it("cifra e decifra; outro valor a cada vez", () => {
    vi.stubEnv("CHAVE_CRIPTOGRAFIA", "chave-a");
    const a = cifrar("EAAG-token-secreto");
    expect(a).not.toContain("EAAG");
    expect(a).not.toBe(cifrar("EAAG-token-secreto"));
    expect(decifrar(a)).toBe("EAAG-token-secreto");
  });

  it("com outra chave ou valor adulterado devolve null", () => {
    vi.stubEnv("CHAVE_CRIPTOGRAFIA", "chave-a");
    const a = cifrar("token");
    vi.stubEnv("CHAVE_CRIPTOGRAFIA", "chave-b");
    expect(decifrar(a)).toBeNull();
    expect(decifrar("lixo")).toBeNull();
    expect(decifrar(null)).toBeNull();
  });

  it("em produção sem chave recusa cifrar", () => {
    vi.stubEnv("CHAVE_CRIPTOGRAFIA", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => cifrar("x")).toThrow(/CHAVE_CRIPTOGRAFIA/);
  });
});

describe("validarConfiguracao", () => {
  it("formata CNPJ e recusa dígito errado", () => {
    expect(cnpjValido("11222333000181")).toBe(true);
    expect(cnpjValido("11222333000182")).toBe(false);
    expect(cnpjValido("11111111111111")).toBe(false);
    expect(validarConfiguracao({ cnpj: "11.222.333/0001-81" }).dados.cnpj).toBe("11.222.333/0001-81");
    expect(validarConfiguracao({ cnpj: "11222333000182" }).erros).toHaveLength(1);
  });

  it("campo ausente não mexe; vazio apaga", () => {
    const { dados } = validarConfiguracao({ nomeFantasia: "  Farmácia   Boa " , endereco: "" });
    expect(dados).toEqual({ nomeFantasia: "Farmácia Boa", endereco: null });
  });

  it("token vazio mantém; 'Bearer ' e espaços saem; remover apaga", () => {
    expect(validarConfiguracao({ whatsappToken: "" }).dados).not.toHaveProperty("whatsappToken");
    expect(validarConfiguracao({ whatsappToken: " Bearer EAAGabcdefghijklmnopqrstu " }).dados.whatsappToken).toBe("EAAGabcdefghijklmnopqrstu");
    expect(validarConfiguracao({ whatsappToken: "curto" }).erros).toHaveLength(1);
    expect(validarConfiguracao({ remover: ["whatsappToken", "cnpj"] }).dados).toEqual({ whatsappToken: null });
  });

  it("recusa id com letras, e-mail e template inválidos", () => {
    const { erros } = validarConfiguracao({ whatsappPhoneNumberId: "+55 21 9999", emailPrivacidade: "sem-arroba", whatsappTemplateReabertura: "Retomar Atendimento" });
    expect(erros).toHaveLength(3);
  });
});

describe("credenciais e provedor", () => {
  it("banco tem prioridade sobre a variável; variável é o reserva", () => {
    vi.stubEnv("CHAVE_CRIPTOGRAFIA", "k");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "111");
    vi.stubEnv("WHATSAPP_TOKEN", "token-env");
    expect(credenciaisDe({}, "WHATSAPP")).toEqual({ id: "111", token: "token-env", wabaId: null });
    expect(credenciaisDe({ whatsappPhoneNumberId: "222", whatsappToken: cifrar("token-banco") }, "WHATSAPP")).toEqual({ id: "222", token: "token-banco", wabaId: null });
  });

  it("usa a Meta quando há credenciais; PROVEDOR_MENSAGERIA força", () => {
    vi.stubEnv("CHAVE_CRIPTOGRAFIA", "k");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "");
    vi.stubEnv("WHATSAPP_TOKEN", "");
    vi.stubEnv("INSTAGRAM_ACCOUNT_ID", "");
    vi.stubEnv("INSTAGRAM_TOKEN", "");
    vi.stubEnv("PROVEDOR_MENSAGERIA", "");
    const conectado = { whatsappPhoneNumberId: "222", whatsappToken: cifrar("t") };
    expect(nomeProvedorDe({})).toBe("mock");
    expect(nomeProvedorDe(conectado)).toBe("meta");
    vi.stubEnv("PROVEDOR_MENSAGERIA", "mock");
    expect(nomeProvedorDe(conectado)).toBe("mock");
  });

  it("verify token: o gerado e o da variável; sem nenhum, só o padrão fora de produção", () => {
    vi.stubEnv("META_VERIFY_TOKEN", "");
    expect(tokensVerificacaoDe({ metaVerifyToken: "abc" })).toEqual(["abc"]);
    expect(tokensVerificacaoDe({})).toEqual(["crm-farmacia-verify"]);
    vi.stubEnv("NODE_ENV", "production");
    expect(tokensVerificacaoDe({})).toEqual([]);
  });

  it("a tela nunca recebe o token inteiro", () => {
    vi.stubEnv("CHAVE_CRIPTOGRAFIA", "k");
    const pub = configuracaoPublica({ whatsappPhoneNumberId: "222", whatsappToken: cifrar("EAAGsegredo1234"), metaVerifyToken: "v" });
    expect(JSON.stringify(pub)).not.toContain("EAAGsegredo");
    expect(pub.whatsappToken).toBe("••••1234");
  });
});
