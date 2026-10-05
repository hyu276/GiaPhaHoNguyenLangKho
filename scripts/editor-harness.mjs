// Installs a temporary local-only route; never part of a production build.
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";

const route = "src/app/editor-test-harness";
if (existsSync(route))
  throw new Error("Harness route already exists; refusing to overwrite it.");
mkdirSync(route);
copyFileSync("tests/fixtures/editor-page.tsx", `${route}/page.tsx`);
const child = spawn(
  "npm",
  ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3100"],
  {
    stdio: "inherit",
  },
);
const cleanup = () => rmSync(route, { recursive: true, force: true });
process.on("exit", cleanup);
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}
child.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 0);
});
