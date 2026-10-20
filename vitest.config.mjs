import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// banco dos testes: um schema próprio ("?schema=teste"), recriado do zero a cada execução
try { process.loadEnvFile(".env"); } catch {} // sem .env: vale o que estiver no ambiente (ex.: CI)
const urlTeste = process.env.DATABASE_URL_TESTE ?? "";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    env: { DATABASE_URL: urlTeste, NODE_ENV: "test" },
    globalSetup: ["./tests/preparar-banco.mjs"],
    setupFiles: ["./tests/simular-next.mjs"],
    fileParallelism: false, // um único banco: arquivos em sequência
  },
});
