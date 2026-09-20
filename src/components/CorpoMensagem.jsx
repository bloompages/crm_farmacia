/**
 * Renderiza o corpo de uma mensagem como o WhatsApp mostra:
 *  - linhas em branco separam parágrafos; quebras simples são preservadas
 *  - *negrito*, _itálico_, ~riscado~ e ```monoespaçado```
 *  - links clicáveis
 * Nunca usa innerHTML: o texto vem do cliente e é tratado como dado.
 */
import { normalizarTexto } from "@/lib/formatacao";

const TOKEN = /(```[\s\S]+?```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|https?:\/\/[^\s<>()]+)/g;

function trecho(t, i) {
  if (t.startsWith("```") && t.endsWith("```") && t.length > 6) return <code key={i}>{t.slice(3, -3)}</code>;
  if (/^https?:\/\//.test(t)) {
    return (
      <a key={i} href={t} target="_blank" rel="noopener noreferrer">
        {t}
      </a>
    );
  }
  const marca = t[0];
  const interno = t.slice(1, -1);
  if (marca === "*") return <strong key={i}>{interno}</strong>;
  if (marca === "_") return <em key={i}>{interno}</em>;
  if (marca === "~") return <s key={i}>{interno}</s>;
  return t;
}

function linhaFormatada(linha, chave) {
  const partes = linha.split(TOKEN);
  return partes.map((p, i) => (i % 2 === 1 ? trecho(p, `${chave}-${i}`) : p));
}

export default function CorpoMensagem({ texto, className = "" }) {
  const limpo = normalizarTexto(texto);
  if (!limpo) return null;
  const paragrafos = limpo.split(/\n{2,}/);
  return (
    <div className={`msg-corpo ${className}`}>
      {paragrafos.map((par, pi) => (
        <p key={pi}>
          {par.split("\n").map((linha, li) => (
            <span key={li}>
              {li > 0 && "\n"}
              {linhaFormatada(linha, `${pi}-${li}`)}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
