import FormLogin from "@/components/FormLogin";
import { nomeExibicao } from "@/lib/configuracao";

export const metadata = { title: "Entrar" };

export default async function Login({ searchParams }) {
  const sp = await searchParams;
  // só caminhos internos: evita usar o login para redirecionar a outro site
  const nome = await nomeExibicao();
  const voltar = typeof sp?.voltar === "string" && /^\/(?!\/)/.test(sp.voltar) ? sp.voltar : "/";
  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-semibold tracking-tight text-emerald-700">{nome}</div>
          <div className="text-sm text-slate-500">Entre com o seu usuário da equipe</div>
        </div>
        <FormLogin voltar={voltar} />
      </div>
    </div>
  );
}
