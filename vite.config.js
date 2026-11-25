import { defineConfig } from "vite";
import { checkClientFiles } from "./scripts/check-client-build.mjs";

checkClientFiles("public");
const api = "127.0.0.1:" + (process.env.PORT || 8787);
export default defineConfig({
  envPrefix: [],
  server: {
    port: Number(process.env.WEB_PORT || 5173),
    fs: {
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem,key,p12,pfx,cer,der}",
        ".npmrc",
        ".yarnrc.yml",
        "**/.git/**",
        "*-keypair.json",
        "devnet-issuer.json",
        "*.sqlite*",
        "**/target/**",
      ],
    },
    proxy: {
      "/api": { target: "http://" + api, changeOrigin: false },
    },
  },
});
