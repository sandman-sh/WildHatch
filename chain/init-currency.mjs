import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { wildhatchIssuer, wildhatchProgram } from "../src/wildhatchProgram.ts";

const path = process.env.WILDHATCH_ISSUER_KEYPAIR;
const json = process.env.WILDHATCH_ISSUER_KEYPAIR_JSON;
if (!path && !json)
  throw Error(
    "Set WILDHATCH_ISSUER_KEYPAIR_JSON or WILDHATCH_ISSUER_KEYPAIR to the Devnet issuer keypair.",
  );
let payer;
try {
  payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(json || (await readFile(path, "utf8")))),
  );
} catch {
  throw Error("The Devnet collectible issuer keypair could not be loaded.");
}
if (payer.publicKey.toBase58() !== wildhatchIssuer)
  throw Error("Incorrect WildHatch Devnet issuer.");
const program = new PublicKey(wildhatchProgram);
const token = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
if (!(await connection.getAccountInfo(program))?.executable)
  throw Error("Deploy WildHatch to Devnet first.");
const [mint] = PublicKey.findProgramAddressSync([Buffer.from("wild")], program);
const initial = await connection.getAccountInfo(mint);
if (!initial) {
  const transaction = new Transaction().add(
    new TransactionInstruction({
      programId: program,
      data: createHash("sha256")
        .update("global:initialize_currency")
        .digest()
        .subarray(0, 8),
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: token, isSigner: false, isWritable: false },
      ],
    }),
  );
  const signature = await sendAndConfirmTransaction(connection, transaction, [
    payer,
  ]);
  console.log("Devnet WILD initialized", signature);
}
const supply = await connection.getTokenSupply(mint);
if (supply.value.decimals !== 6) throw Error("Unexpected WILD mint precision.");
console.log("Devnet WILD mint", mint.toBase58());
