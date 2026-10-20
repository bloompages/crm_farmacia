import { db } from "./db.js";
import { usuarioAtual, ipAtual } from "./usuario.js";

/**
 * Registra um acesso/alteração de dado pessoal. Nunca derruba a ação principal:
 * se a gravação falhar, fica só o log no servidor.
 *   await auditar("VER_LEAD", { entidade: "Lead", entidadeId: id });
 */
export async function auditar(acao, { entidade, entidadeId, detalhe, usuario, ip } = {}) {
  try {
    const u = usuario === undefined ? await usuarioAtual() : usuario;
    await db.auditoria.create({
      data: {
        acao,
        entidade: entidade ?? null,
        entidadeId: entidadeId ?? null,
        detalhe: detalhe ? String(detalhe).slice(0, 500) : null,
        userId: u?.id ?? null,
        ip: ip === undefined ? await ipAtual() : ip,
      },
    });
  } catch (e) {
    console.error(`[auditoria] falha ao registrar ${acao}`, e);
  }
}

/**
 * Acesso de leitura repetido (a mesma imagem renderizada a cada abertura do inbox)
 * conta uma vez por janela — o registro continua útil sem virar ruído.
 */
export async function auditarLeitura(acao, { entidade, entidadeId, detalhe }, janelaMin = 30) {
  try {
    const u = await usuarioAtual();
    const recente = await db.auditoria.findFirst({
      where: { acao, entidade, entidadeId, userId: u?.id ?? null, createdAt: { gte: new Date(Date.now() - janelaMin * 60000) } },
      select: { id: true },
    });
    if (!recente) await auditar(acao, { entidade, entidadeId, detalhe, usuario: u });
  } catch (e) {
    console.error(`[auditoria] falha ao registrar ${acao}`, e);
  }
}

export const ROTULO_ACAO = {
  LOGIN: "entrou",
  LOGIN_FALHOU: "tentativa de login falhou",
  LOGOUT: "saiu",
  VER_LEAD: "abriu a ficha do lead",
  VER_ANEXO: "abriu anexo",
  EXPORTAR_TITULAR: "exportou os dados do titular",
  ANONIMIZAR_TITULAR: "anonimizou o titular",
  CONSENTIMENTO: "alterou consentimento",
  EXCLUIR_LEAD: "excluiu lead",
  EXCLUIR_ORCAMENTO: "excluiu orçamento",
  USUARIO_CRIADO: "criou usuário",
  USUARIO_ALTERADO: "alterou usuário",
  SENHA_ALTERADA: "trocou a própria senha",
  EXPORTAR_CSV: "exportou planilha",
  IMPORTAR_CSV: "importou planilha",
};
