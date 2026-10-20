import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/usuario";
import { contarEtiquetas, filtroEtiqueta, listaEtiquetas, normalizarEtiquetas, etiquetasParaTexto } from "@/lib/etiquetas";

export const dynamic = "force-dynamic";

/** Etiquetas em uso, com quantos leads têm cada uma. */
export async function GET() {
  const { resposta } = await exigirUsuario();
  if (resposta) return resposta;
  const leads = await db.lead.findMany({ where: { etiquetas: { not: "" } }, select: { etiquetas: true } });
  return NextResponse.json(contarEtiquetas(leads));
}

/**
 * Renomeia ou junta etiquetas em todos os leads (só gerente):
 *   { de: "vip", para: "cliente vip" }   renomeia (se "cliente vip" já existir, as duas viram uma)
 *   { de: "vip", para: "" }              remove a etiqueta de todos os leads
 */
export async function PATCH(req) {
  const { resposta } = await exigirUsuario("GERENTE");
  if (resposta) return resposta;
  const b = await req.json().catch(() => ({}));
  const de = normalizarEtiquetas(b.de)[0];
  const para = normalizarEtiquetas(b.para)[0] ?? null;
  if (!de) return NextResponse.json({ erro: "informe a etiqueta" }, { status: 400 });

  const leads = await db.lead.findMany({ where: filtroEtiqueta(de), select: { id: true, etiquetas: true } });
  await db.$transaction(
    leads.map((l) => {
      const nova = listaEtiquetas(l.etiquetas).flatMap((e) => (e === de ? (para ? [para] : []) : [e]));
      return db.lead.update({ where: { id: l.id }, data: { etiquetas: etiquetasParaTexto(nova) } });
    })
  );
  return NextResponse.json({ ok: true, leads: leads.length });
}
