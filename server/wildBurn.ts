import { createHash } from "node:crypto";
import { Connection, PublicKey, type ParsedInstruction } from "@solana/web3.js";
import { wildhatchProgram } from "../src/wildhatchProgram.ts";
import { wildItems, type WildItem } from "../src/wildStore.ts";

const connection = new Connection("https://api.devnet.solana.com", "finalized");
const splToken = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const memo = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const mint = PublicKey.findProgramAddressSync(
  [Buffer.from("wild")],
  new PublicKey(wildhatchProgram),
)[0].toBase58();

export async function verifyWildBurn(
  signature: string,
  wallet: string,
  item: WildItem,
) {
  const record = await connection.getParsedTransaction(signature, {
    commitment: "finalized",
    maxSupportedTransactionVersion: 0,
  });
  if (!record)
    throw Error("Awaiting Devnet finality. Retry this receipt shortly.");
  if (!record.meta || record.meta.err)
    throw Error("The token payment failed on Devnet.");
  const message = record.transaction.message;
  const expected = String(wildItems[item].cost * 1_000_000);
  const burns = message.instructions.filter(
    (instruction): instruction is ParsedInstruction =>
      instruction.programId.toBase58() === splToken &&
      "parsed" in instruction &&
      instruction.parsed?.type === "burnChecked",
  );
  const burn = burns[0]?.parsed.info;
  if (
    burns.length !== 1 ||
    burn.mint !== mint ||
    burn.authority !== wallet ||
    burn.tokenAmount?.amount !== expected ||
    !message.accountKeys.some(
      (key) => key.signer && key.pubkey.toBase58() === wallet,
    ) ||
    !message.instructions.some(
      (i) =>
        i.programId.toBase58() === memo &&
        "parsed" in i &&
        i.parsed === "WildHatch:" + item,
    )
  ) {
    throw Error("The payment does not match this wallet and item.");
  }
}

const boxDiscriminator = createHash("sha256")
  .update("account:BoxOpening")
  .digest()
  .subarray(0, 8);
export async function verifiedBoxRoll(
  address: string,
  wallet: string,
  item: WildItem,
  rpc = connection,
) {
  const key = new PublicKey(address);
  const program = new PublicKey(wildhatchProgram);
  const account = await rpc.getAccountInfo(key, "finalized");
  if (!account) throw Error("Waiting for the box transaction to finalize.");
  const data = account.data;
  if (
    !account.owner.equals(program) ||
    data.length !== 50 ||
    !data.subarray(0, 8).equals(boxDiscriminator)
  )
    throw Error("Invalid box receipt.");
  const buyer = new PublicKey(data.subarray(8, 40));
  const [expected] = PublicKey.findProgramAddressSync(
    [Buffer.from("box"), buyer.toBuffer(), data.subarray(40, 48)],
    program,
  );
  if (
    !expected.equals(key) ||
    buyer.toBase58() !== wallet ||
    (item !== "trail" && item !== "prism") ||
    data[48] !== (item === "trail" ? 0 : 1)
  )
    throw Error("This box belongs to a different purchase.");
  if (data[49] > 99) throw Error("Waiting for the MagicBlock reveal.");
  return data[49];
}
