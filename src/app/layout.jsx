import "./globals.css";
import Nav from "@/components/Nav";

export const metadata = {
  title: "CRM Farmácia",
  description: "CRM comercial para farmácias: leads, orçamentos e mensagens",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <Nav />
          <main className="flex-1 min-w-0 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
