/**
 * Arquivos de demonstração gerados em memória para o provedor mock — servem para
 * testar que o CRM entrega anexos com o Content-Type/nome certos (o "documento
 * que não abre" de outros sistemas).
 */
import { deflateSync } from "node:zlib";

/** PDF mínimo, válido, com uma linha de texto. */
export function pdfDemo(texto = "Receita medica (demonstracao)") {
  const objetos = [];
  const add = (s) => objetos.push(s);
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>");
  const conteudo = `BT /F1 18 Tf 60 760 Td (${texto.replace(/[()\\]/g, "")}) Tj ET`;
  add(`<< /Length ${Buffer.byteLength(conteudo)} >>\nstream\n${conteudo}\nendstream`);
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let corpo = "%PDF-1.4\n";
  const offsets = [];
  objetos.forEach((o, i) => {
    offsets.push(Buffer.byteLength(corpo));
    corpo += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(corpo);
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) corpo += `${String(off).padStart(10, "0")} 00000 n \n`;
  corpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(corpo, "latin1");
}

/** PNG sólido (degradê simples) — para simular uma foto recebida. */
export function pngDemo(largura = 320, altura = 200) {
  const linhas = [];
  for (let y = 0; y < altura; y++) {
    const linha = Buffer.alloc(1 + largura * 3);
    linha[0] = 0; // filtro none
    for (let x = 0; x < largura; x++) {
      const i = 1 + x * 3;
      linha[i] = 5 + Math.round((x / largura) * 40);       // R
      linha[i + 1] = 120 + Math.round((y / altura) * 60);  // G
      linha[i + 2] = 105;                                  // B
    }
    linhas.push(linha);
  }
  const dados = deflateSync(Buffer.concat(linhas));
  const chunk = (tipo, corpo) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(corpo.length);
    const tc = Buffer.concat([Buffer.from(tipo, "ascii"), corpo]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(tc) >>> 0);
    return Buffer.concat([len, tc, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0); ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", dados), chunk("IEND", Buffer.alloc(0)),
  ]);
}

let tabela;
function crc32(buf) {
  if (!tabela) {
    tabela = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabela[n] = c;
    }
  }
  let crc = -1;
  for (const b of buf) crc = tabela[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return crc ^ -1;
}
