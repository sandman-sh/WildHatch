import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type BlockhashWithExpiryBlockHeight,
} from "@solana/web3.js";
import { wildhatchIssuer, wildhatchProgram } from "../src/wildhatchProgram.ts";
import type { Beast, Profile } from "../src/shared.ts";
import { gameOnlyBeast } from "../src/importedBeasts.ts";
import { beastMemo, beastMemoProgram } from "../src/collectibleTraits.ts";

const program = new PublicKey(wildhatchProgram);
const token = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const associated = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);
const devnet = new Connection("https://api.devnet.solana.com", "confirmed");
const tag = createHash("sha256")
  .update("global:mint_beast")
  .digest()
  .subarray(0, 8);
const key = (pubkey: PublicKey, isWritable = false, isSigner = false) => ({
  pubkey,
  isWritable,
  isSigner,
});
const mintAddressFor = (id: string) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("beast"), Buffer.from(id.replaceAll("-", ""), "hex")],
    program,
  )[0];

export async function prepareCollectible(profile: Profile, id: unknown) {
  if (!profile.wallet) throw Error("Sign in with your Solana wallet.");
  const beast = profile.collection.find((entry) => entry.id === id);
  if (!beast || typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id)) {
    throw Error("Select a beast in your collection.");
  }
  if (gameOnlyBeast(beast.name))
    throw Error("This species is available as an in-game collectible.");
  const path = process.env.WILDHATCH_ISSUER_KEYPAIR;
  const json = process.env.WILDHATCH_ISSUER_KEYPAIR_JSON;
  if (!json && !path) throw Error("The Devnet collectible issuer is not configured.");
  let issuer: Keypair;
  try {
    issuer = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(json || readFileSync(path!, "utf8"))),
    );
  } catch {
    throw Error("The Devnet collectible issuer keypair could not be loaded.");
  }
  if (issuer.publicKey.toBase58() !== wildhatchIssuer)
    throw Error("The Devnet collectible issuer is misconfigured.");
  if (!(await devnet.getAccountInfo(program))?.executable)
    throw Error("The WildHatch Devnet program is awaiting deployment.");
  const owner = new PublicKey(profile.wallet);
  const mint = mintAddressFor(id);
  if (await devnet.getAccountInfo(mint, "finalized"))
    return { mint: mint.toBase58() };
  const block = await devnet.getLatestBlockhash();
  const tx = buildCollectibleTransaction(beast, owner, issuer, block);
  return {
    mint: mint.toBase58(),
    transaction: tx
      .serialize({ requireAllSignatures: false })
      .toString("base64"),
    ...block,
  };
}

export function buildCollectibleTransaction(
  beast: Beast,
  owner: PublicKey,
  issuer: Keypair,
  block: BlockhashWithExpiryBlockHeight,
) {
  const encoded = Buffer.from(beast.id.replaceAll("-", ""), "hex");
  const mint = mintAddressFor(beast.id);
  const destination = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), token.toBuffer(), mint.toBuffer()],
    associated,
  )[0];
  const tx = new Transaction({ feePayer: owner, ...block }).add(
    new TransactionInstruction({
      programId: program,
      keys: [
        key(owner, true, true),
        key(issuer.publicKey, false, true),
        key(mint, true),
        key(destination, true),
        key(SystemProgram.programId),
        key(token),
        key(associated),
      ],
      data: Buffer.concat([tag, encoded]),
    }),
    new TransactionInstruction({
      programId: new PublicKey(beastMemoProgram),
      keys: [key(issuer.publicKey, false, true)],
      data: Buffer.from(beastMemo(beast)),
    }),
  );
  tx.partialSign(issuer);
  return tx;
}
