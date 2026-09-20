import { tratarWebhook, verificarWebhook } from "@/lib/webhook";

export const dynamic = "force-dynamic";

/** Verificação do webhook exigida pela Meta (GET com hub.challenge). */
export async function GET(req) {
  return verificarWebhook(req);
}

export async function POST(req) {
  return tratarWebhook(req, "INSTAGRAM");
}
