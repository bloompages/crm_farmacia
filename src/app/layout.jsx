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

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default async function RootLayout({ children }) {
  const usuario = await usuarioAtual(); // null só na tela de login e na política de privacidade
  const empresa = usuario ? (await obterConfiguracao()).nomeFantasia : null;
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <div className="flex min-h-screen flex-col lg:flex-row">
          {usuario && <Nav usuario={usuario} empresa={empresa} />}
          <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
