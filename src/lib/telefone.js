/**
 * Forma canônica de telefone usada no Lead: só dígitos, com DDI.
 * Para o Brasil (55) o celular sempre leva o 9º dígito — o WhatsApp às vezes
 * entrega o wa_id sem ele (5511 8765-4321), e sem essa regra o mesmo cliente
 * vira dois leads.
 *
 *   "(11) 98765-4321"  → "5511987654321"
 *   "011 98765-4321"   → "5511987654321"
 *   "551187654321"     → "5511987654321"  (celular sem o 9)
 *   "551133334444"     → "551133334444"   (fixo fica como está)
 *   "+1 415 555 0100"  → "14155550100"    (estrangeiro mantém o DDI)
 */
export function normalizarTelefone(valor) {
  const bruto = String(valor ?? "").trim();
  let d = bruto.replace(/\D/g, "");
  if (!d) return null;
  // "+1 415…" / "00 1 415…" já trazem o DDI; sem isso, só DDD + número é brasileiro
  const comDdi = /^(\+|00)/.test(bruto);
  d = d.replace(/^0+/, ""); // prefixo de operadora / discagem nacional ou internacional
  if (!comDdi && (d.length === 10 || d.length === 11)) d = `55${d}`;
  // 55 + DDD + 8 dígitos começando em 6–9 = celular sem o 9º dígito
  if (d.length === 12 && d.startsWith("55") && /[6-9]/.test(d[4])) d = `${d.slice(0, 4)}9${d.slice(4)}`;
  return d;
}

/** "5511987654321" → "(11) 98765-4321"; outros formatos voltam como estão. */
export function formatarTelefone(t) {
  if (!t) return t;
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(t);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : t;
}
