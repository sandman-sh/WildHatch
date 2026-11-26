import { build } from "esbuild";

await build({
  entryPoints: ["server/handler.ts"],
  bundle: true,
  platform: "node",
  target: "node26",
  format: "esm",
  packages: "external",
  outfile: "api/handler.js",
});
