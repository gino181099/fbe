// Levanta Postgres local (si no está corriendo) y después Next.
// Uso: tsx scripts/local.ts dev    → desarrollo (esta PC)
//      tsx scripts/local.ts start  → producción compilada (requiere `npm run build`), visible en la red.
//                                    Hace un backup de la base cada vez que arranca.
import { spawn } from "node:child_process";
import path from "node:path";
import { backup } from "./datos";
import { startDb } from "./db";

async function main() {
  const mode = process.argv[2] === "start" ? "start" : "dev";
  await startDb();
  if (mode === "start") {
    await backup().catch((e) => console.error("No se pudo hacer el backup:", e));
    console.log("ERP en http://localhost:3000 (desde otras PCs: http://<IP de esta PC>:3000)");
  }
  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const args = mode === "start" ? ["start", "-H", "0.0.0.0", "-p", "3000"] : ["dev"];
  const child = spawn(process.execPath, [nextBin, ...args], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
