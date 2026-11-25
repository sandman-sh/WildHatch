import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const privateFilename =
  /^(?:\.env(?:\..*)?|\.npmrc|id_(?:rsa|ed25519))$|(?:keypair|devnet-issuer)\.json$|\.(?:p12|pfx|key|sqlite)(?:-|$)/i;
const privateContent = [
  /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/,
  /\bsb_secret_[A-Za-z0-9_-]{12,}/,
  /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@/i,
];

function privateValues(env) {
  const values = [
    env.WILDHATCH_DATABASE_URL,
    env.WILDHATCH_ISSUER_KEYPAIR_JSON,
    env.SUPABASE_SERVICE_ROLE_KEY,
  ];
  try {
    values.push(
      decodeURIComponent(new URL(env.WILDHATCH_DATABASE_URL).password),
    );
  } catch {
    // Unconfigured builds are supported.
  }
  try {
    const text =
      env.WILDHATCH_ISSUER_KEYPAIR_JSON ||
      (env.WILDHATCH_ISSUER_KEYPAIR &&
        readFileSync(env.WILDHATCH_ISSUER_KEYPAIR, "utf8"));
    const key = JSON.parse(text);
    if (Array.isArray(key) && key.length === 64) {
      values.push(JSON.stringify(key), Buffer.from(key).toString("base64"));
    }
  } catch {
    // The mint endpoint validates issuer configuration when it is used.
  }
  return values.filter(
    (value) => typeof value === "string" && value.length >= 12,
  );
}

export function checkClientFiles(directory, env = process.env) {
  const secrets = privateValues(env);
  for (const entry of readdirSync(directory, {
    withFileTypes: true,
    recursive: true,
  })) {
    if (entry.isDirectory()) continue;
    if (entry.isSymbolicLink() || privateFilename.test(entry.name)) {
      throw Error(
        "A private file or symbolic link was found in the frontend files.",
      );
    }
    const content = readFileSync(join(entry.parentPath, entry.name));
    if (
      secrets.some((secret) => content.includes(secret)) ||
      privateContent.some((pattern) => pattern.test(content.toString("latin1")))
    ) {
      throw Error("A credential was found in the frontend files.");
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  checkClientFiles("dist");
  console.log("Frontend credential scan passed.");
}
