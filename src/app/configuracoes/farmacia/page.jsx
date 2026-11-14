import { redirect } from "next/navigation";

/** Endereço antigo (quando o CRM era só para farmácias): leva para a tela nova. */
export default function EnderecoAntigo() {
  redirect("/configuracoes/empresa");
}
