import { build } from "esbuild";

await build({
  entryPoints: ["server/api.ts"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  packages: "bundle",
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
  outfile: "api/_api.mjs",
});
