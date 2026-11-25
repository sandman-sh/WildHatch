import { createPublicKey, randomBytes, verify } from "node:crypto";
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function walletKey(address: string) {
  if (typeof address !== "string" || address.length < 32 || address.length > 44)
    throw Error("Invalid wallet");
  let n = 0n;
  for (const c of address) {
    const i = alphabet.indexOf(c);
    if (i < 0) throw Error("Invalid wallet");
    n = n * 58n + BigInt(i);
  }
  const bytes = [];
  while (n) {
    bytes.unshift(Number(n % 256n));
    n /= 256n;
  }
  for (const c of address) {
    if (c !== "1") break;
    bytes.unshift(0);
  }
  if (bytes.length !== 32) throw Error("Invalid wallet");
  return createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      Buffer.from(bytes),
    ]),
    format: "der",
    type: "spki",
  });
}
export function challenge(address: string, origin: string) {
  walletKey(address);
  return {
    address,
    expires: Date.now() + 120000,
    message:
      "WildHatch wallet link\nOrigin: " +
      origin +
      "\nWallet: " +
      address +
      "\nNonce: " +
      randomBytes(24).toString("hex"),
  };
}
export function check(c: ReturnType<typeof challenge>, signature: string) {
  return (
    c.expires > Date.now() &&
    typeof signature === "string" &&
    signature.length <= 90 &&
    verify(
      null,
      Buffer.from(c.message),
      walletKey(c.address),
      Buffer.from(signature, "base64"),
    )
  );
}
