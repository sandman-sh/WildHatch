import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["--watch", "server/index.ts"], { stdio: "inherit" }),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--strictPort"],
    { stdio: "inherit" },
  ),
];
function stop(code = 0) {
  for (const child of children) child.kill();
  process.exit(code);
}
for (const child of children) child.on("exit", (code) => stop(code ?? 1));
process.on("SIGTERM", () => stop());
process.on("SIGINT", () => stop());
