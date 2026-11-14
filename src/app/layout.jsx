import "./globals.css";
import Nav from "@/components/Nav";
import { usuarioAtual } from "@/lib/usuario";
import { obterConfiguracao } from "@/lib/configuracao";

export const metadata = {
  title: "CRM Farmácia",
  description: "CRM comercial para farmácias: leads, orçamentos e mensagens",
};

export default async function RootLayout({ children }) {
  const usuario = await usuarioAtual(); // null só na tela de login e na política de privacidade
  const farmacia = usuario ? (await obterConfiguracao()).nomeFantasia : null;
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          {usuario && <Nav usuario={usuario} farmacia={farmacia} />}
          <main className="flex-1 min-w-0 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
