import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import bs58 from "bs58";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { wildhatchProgram, wildhatchIssuer } from "../src/wildhatchProgram.ts";
import {
  arenaCompanionPrefix,
  verifyArenaCompanionEntry,
} from "../src/arenaCompanion.ts";
import { beastMemo, beastMemoProgram } from "../src/collectibleTraits.ts";

const endpoint = new URL(
  process.env.WILDHATCH_TEST_RPC ?? "http://127.0.0.1:18899",
);
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname),
  "Use a local test validator.",
);
const rpc = new Connection(endpoint.href, "confirmed");
const rollupEndpoint = process.env.WILDHATCH_TEST_ROLLUP;
const rollup = rollupEndpoint
  ? new Connection(rollupEndpoint, "confirmed")
  : undefined;
if (rollup)
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(rollupEndpoint).hostname,
    ),
  );
const program = new PublicKey(wildhatchProgram);
const token = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const associated = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);
const system = SystemProgram.programId;
const meta = (pubkey, isWritable = false, isSigner = false) => ({
  pubkey,
  isWritable,
  isSigner,
});
const pda = (seed, ...keys) =>
  PublicKey.findProgramAddressSync([Buffer.from(seed), ...keys], program)[0];
const ata = (mint, owner) =>
  PublicKey.findProgramAddressSync(
    [owner.toBuffer(), token.toBuffer(), mint.toBuffer()],
    associated,
  )[0];
const u64 = (value) => {
  const data = Buffer.alloc(8);
  data.writeBigUInt64LE(value);
  return data;
};
const instruction = (name, keys, ...args) =>
  new TransactionInstruction({
    keys,
    programId: program,
    data: Buffer.concat([
      createHash("sha256")
        .update("global:" + name)
        .digest()
        .subarray(0, 8),
      ...args,
    ]),
  });
const host = Keypair.generate(),
  rival = Keypair.generate();
const issuer = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(await readFile(process.env.WILDHATCH_TEST_ISSUER, "utf8")),
  ),
);
assert.equal(issuer.publicKey.toBase58(), wildhatchIssuer);
const hostKey = meta(host.publicKey, true, true),
  rivalKey = meta(rival.publicKey, true, true);
const sendVia = (connection, signers, ...ixs) =>
  sendAndConfirmTransaction(
    connection,
    new Transaction().add(...ixs),
    signers,
    {
      commitment: "confirmed",
    },
  );
const send = (signers, ...ixs) => sendVia(rpc, signers, ...ixs);
for (const wallet of [host, rival, issuer]) {
  const signature = await rpc.requestAirdrop(wallet.publicKey, 1_000_000_000);
  await rpc.confirmTransaction(
    { signature, ...(await rpc.getLatestBlockhash()) },
    "confirmed",
  );
}
const nonce = randomBytes(8);
const duel = pda("duel", host.publicKey.toBuffer(), nonce);
await send(
  [host],
  instruction(
    "create_duel",
    [hostKey, meta(duel, true), meta(system)],
    nonce,
    rival.publicKey.toBuffer(),
  ),
);
await assert.rejects(
  send([host], instruction("join_duel", [hostKey, meta(duel, true)])),
);
await send([rival], instruction("join_duel", [rivalKey, meta(duel, true)]));
async function waitUntil(check) {
  for (let attempt = 0; attempt < 25; attempt++) {
    if (await check()) return;
    await delay(500);
  }
  throw Error("Validator state did not reach the expected value.");
}
if (rollup) {
  const delegation = new PublicKey(
    "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh",
  );
  const delegationPda = (seed) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from(seed), duel.toBuffer()],
      delegation,
    )[0];
  await send(
    [host],
    instruction("delegate_duel", [
      hostKey,
      meta(pda("buffer", duel.toBuffer()), true),
      meta(delegationPda("delegation"), true),
      meta(delegationPda("delegation-metadata"), true),
      meta(duel, true),
      meta(program),
      meta(delegation),
      meta(system),
    ]),
  );
  await waitUntil(
    async () => (await rollup.getAccountInfo(duel))?.data[101] === 1,
  );
}
const venue = rollup ?? rpc;
const move = (wallet, revision) =>
  instruction(
    "play_move",
    [wallet, meta(duel, true)],
    Buffer.from([1]),
    Buffer.from([revision, 0]),
  );
await assert.rejects(sendVia(venue, [rival], move(rivalKey, 0)));
for (let index = 0; index < 7; index++) {
  const [signer, account] = index % 2 ? [rival, rivalKey] : [host, hostKey];
  await sendVia(venue, [signer], move(account, index));
}
assert.equal((await venue.getAccountInfo(duel)).data[99], 2);
await assert.rejects(sendVia(venue, [rival], move(rivalKey, 7)));
if (rollup) {
  await sendVia(
    rollup,
    [host],
    instruction("settle_duel", [
      hostKey,
      meta(duel, true),
      meta(new PublicKey("Magic11111111111111111111111111111111111111")),
      meta(new PublicKey("MagicContext1111111111111111111111111111111"), true),
    ]),
  );
  await waitUntil(async () => {
    const account = await rpc.getAccountInfo(duel);
    return account?.owner.equals(program) && account.data[99] === 2;
  });
}
const wild = pda("wild");
if (!(await rpc.getAccountInfo(wild))) {
  await send(
    [issuer],
    instruction("initialize_currency", [
      meta(issuer.publicKey, true, true),
      meta(wild, true),
      meta(system),
      meta(token),
    ]),
  );
}
assert.equal((await rpc.getTokenSupply(wild)).value.decimals, 6);
if (rollup) {
  const destination = ata(wild, host.publicKey);
  const create = new TransactionInstruction({
    programId: associated,
    data: Buffer.from([1]),
    keys: [
      hostKey,
      meta(destination, true),
      meta(host.publicKey),
      meta(wild),
      meta(system),
      meta(token),
    ],
  });
  const reward = instruction("claim_wild", [
    hostKey,
    meta(duel, true),
    meta(wild, true),
    meta(destination, true),
    meta(token),
  ]);
  await send([host], create, reward);
  await assert.rejects(send([host], reward));
  assert.equal(
    (await rpc.getTokenAccountBalance(destination)).value.amount,
    "12000000",
  );
  console.log(
    "PASS: MagicBlock delegation, play, settlement, and single-claim reward",
  );
}
const id = randomBytes(16),
  collectible = pda("beast", id);
const source = ata(collectible, host.publicKey);
const beastId = id
  .toString("hex")
  .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
const mint = (authority) =>
  instruction(
    "mint_beast",
    [
      hostKey,
      meta(authority, false, true),
      meta(collectible, true),
      meta(source, true),
      meta(system),
      meta(token),
      meta(associated),
    ],
    id,
  );
await assert.rejects(send([host, rival], mint(rival.publicKey)));
await send(
  [host, issuer],
  mint(issuer.publicKey),
  new TransactionInstruction({
    programId: new PublicKey(beastMemoProgram),
    keys: [meta(issuer.publicKey, false, true)],
    data: Buffer.from(
      beastMemo({
        id: beastId,
        name: "Mosskin",
        variant: 23,
        rarity: "Rare",
        personality: "Curious",
        stage: 1,
        level: 1,
        xp: 0,
        history: [],
      }),
    ),
  }),
);
assert.equal((await rpc.getTokenSupply(collectible)).value.amount, "1");
const mintInfo = await rpc.getAccountInfo(collectible);
assert.equal(
  mintInfo.data.readUInt32LE(0),
  0,
  "No authority remains to increase collectible supply",
);
const offer = pda("offer", host.publicKey.toBuffer(), nonce),
  vault = pda("vault", offer.toBuffer());
await send(
  [host],
  instruction(
    "offer_asset",
    [
      hostKey,
      meta(collectible),
      meta(source, true),
      meta(offer, true),
      meta(vault, true),
      meta(system),
      meta(token),
    ],
    nonce,
    u64(1n),
    u64(1_000_000n),
  ),
);
assert.equal((await rpc.getTokenAccountBalance(vault)).value.amount, "1");
const offerAccountTag = createHash("sha256")
  .update("account:Offer")
  .digest()
  .subarray(0, 8);
const offerFilter = [
  { dataSize: 96 },
  { memcmp: { offset: 0, bytes: bs58.encode(offerAccountTag) } },
];
assert.ok(
  (await rpc.getProgramAccounts(program, { filters: offerFilter })).some(
    ({ pubkey }) => pubkey.equals(offer),
  ),
);
const destination = ata(collectible, rival.publicKey);
const newAta = new TransactionInstruction({
  programId: associated,
  keys: [
    rivalKey,
    meta(destination, true),
    meta(rival.publicKey),
    meta(collectible),
    meta(system),
    meta(token),
  ],
  data: Buffer.from([1]),
});
const purchase = (price) =>
  instruction(
    "buy_asset",
    [
      rivalKey,
      meta(host.publicKey, true),
      meta(collectible),
      meta(destination, true),
      meta(offer, true),
      meta(vault, true),
      meta(system),
      meta(token),
    ],
    u64(price),
    u64(1n),
  );
await assert.rejects(send([rival], newAta, purchase(999_999n)));
assert.equal((await rpc.getTokenAccountBalance(vault)).value.amount, "1");
await send([rival], newAta, purchase(1_000_000n));
assert.equal((await rpc.getTokenAccountBalance(destination)).value.amount, "1");
assert.equal(await rpc.getAccountInfo(offer), null);
assert.ok(
  !(await rpc.getProgramAccounts(program, { filters: offerFilter })).some(
    ({ pubkey }) => pubkey.equals(offer),
  ),
);

const nextNonce = randomBytes(8);
const nextDuel = pda("duel", host.publicKey.toBuffer(), nextNonce);
const arenaMemo = (player) =>
  new TransactionInstruction({
    programId: new PublicKey(beastMemoProgram),
    keys: [meta(player, false, true)],
    data: Buffer.from(arenaCompanionPrefix + collectible.toBase58()),
  });
const hostEntry = await send(
  [host],
  arenaMemo(host.publicKey),
  instruction(
    "create_duel",
    [hostKey, meta(nextDuel, true), meta(system), meta(token), meta(source)],
    nextNonce,
    rival.publicKey.toBuffer(),
  ),
);
const buyerEntry = await send(
  [rival],
  arenaMemo(rival.publicKey),
  instruction("join_duel", [
    rivalKey,
    meta(nextDuel, true),
    meta(token),
    meta(destination),
  ]),
);
async function verifyEntry(signature, player, method, match = nextDuel) {
  const record = await rpc.getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  assert.ok(record);
  return verifyArenaCompanionEntry(
    record,
    match,
    player,
    program,
    beastMemoProgram,
    token,
    createHash("sha256")
      .update("global:" + method)
      .digest()
      .subarray(0, 8),
  );
}
assert.equal(
  await verifyEntry(hostEntry, host.publicKey, "create_duel"),
  undefined,
);
assert.ok(
  (await verifyEntry(buyerEntry, rival.publicKey, "join_duel"))?.equals(
    collectible,
  ),
);
assert.equal(
  await verifyEntry(buyerEntry, rival.publicKey, "join_duel", duel),
  undefined,
);
console.log(
  "PASS: escrow discovery, ownership transfer and verified arena companion at entry",
);
assert.equal(await rpc.getAccountInfo(vault), null);
console.log(
  "PASS: local Solana duel and turn authorization, WILD mint, unique collectible and atomic SOL escrow",
);
