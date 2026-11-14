import "./globals.css";
import Nav from "@/components/Nav";
import { usuarioAtual } from "@/lib/usuario";
import { obterConfiguracao, nomeExibicao } from "@/lib/configuracao";

export async function generateMetadata() {
  const nome = await nomeExibicao();
  return {
    title: { default: nome, template: `%s · ${nome}` },
    description: "Atendimento e vendas: leads, orçamentos e mensagens",
  };
}

export default async function RootLayout({ children }) {
  const usuario = await usuarioAtual(); // null só na tela de login e na política de privacidade
  const empresa = usuario ? (await obterConfiguracao()).nomeFantasia : null;
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          {usuario && <Nav usuario={usuario} empresa={empresa} />}
          <main className="flex-1 min-w-0 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
