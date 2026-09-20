import { db } from "@/lib/db";
import { obterProvedor } from "@/lib/integrations";
import { nomeArquivo } from "@/lib/conversa";

export const dynamic = "force-dynamic";

/**
 * Serve o anexo de uma mensagem com o Content-Type e o nome de arquivo corretos.
 * É isso que faz "o documento abrir": o navegador recebe `arquivo.pdf` como
 * application/pdf, e não um blob sem extensão.
 *   ?baixar=1 força download (Content-Disposition: attachment).
 */
export async function GET(req, { params }) {
  const { id } = await params;
  const baixar = new URL(req.url).searchParams.get("baixar") === "1";
  const m = await db.mensagem.findUnique({ where: { id }, include: { conversa: { select: { canal: true } } } });
  if (!m || (!m.midiaId && !m.midiaUrl)) return new Response("anexo não encontrado", { status: 404 });

  // Localização: só redireciona para o mapa
  if (m.tipo === "LOCALIZACAO" && m.midiaUrl) return Response.redirect(m.midiaUrl, 302);

  try {
    const { corpo, mime, tamanho } = await obterProvedor().baixarMidia({
      canal: m.conversa.canal,
      midiaId: m.midiaId,
      midiaUrl: m.midiaUrl,
    });
    const tipo = (mime || m.midiaMime || "application/octet-stream").split(";")[0].trim();
    const nome = nomeArquivo({ ...m, midiaMime: tipo });
    const inline = !baixar && (/^(image|audio|video)\//.test(tipo) || tipo === "application/pdf");
    const headers = {
      "Content-Type": tipo,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(nome)}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    };
    if (tamanho) headers["Content-Length"] = String(tamanho);
    return new Response(corpo, { status: 200, headers });
  } catch (e) {
    // Provedor mock ou link expirado: tenta a URL direta (Instagram), senão explica o motivo
    if (m.midiaUrl && /^https?:\/\//.test(m.midiaUrl)) return Response.redirect(m.midiaUrl, 302);
    return new Response(`Não foi possível obter o anexo: ${e?.message ?? e}`, { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
