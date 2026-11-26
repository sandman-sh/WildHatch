import { Buffer } from "buffer";
import bs58 from "bs58";
import { parseJsonBody, readApiJson } from "./apiJson";
import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_SLOT_HASHES_PUBKEY,
  Transaction,
  TransactionInstruction,
  type AccountMeta,
} from "@solana/web3.js";
import { browserWallet, type BrowserWallet } from "./browserWallet";
import { wildhatchIssuer, wildhatchProgram } from "./wildhatchProgram";
import {
  isWildItem,
  mysteryBox,
  wildItems,
  type WildReward,
  type WildItem,
} from "./wildStore";
import {
  beastMemoPrefix,
  beastMemoProgram,
  readBeastMemo,
} from "./collectibleTraits";
import {
  arenaCompanionPrefix,
  verifyArenaCompanionEntry,
} from "./arenaCompanion";

export const program = new PublicKey(wildhatchProgram);
const base = new Connection("https://api.devnet.solana.com", "confirmed");
const router = "https://devnet-router.magicblock.app";
const delegate = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const magic = new PublicKey("Magic11111111111111111111111111111111111111");
const context = new PublicKey("MagicContext1111111111111111111111111111111");
const token = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const associated = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);
const system = SystemProgram.programId;
const account = (
  pubkey: PublicKey,
  isWritable = false,
  isSigner = false,
): AccountMeta => ({ pubkey, isWritable, isSigner });
const pda = (
  seed: string,
  key: PublicKey,
  owner = program,
  extra: Uint8Array[] = [],
) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from(seed), key.toBuffer(), ...extra],
    owner,
  )[0];
const u64 = (n: bigint) => {
  const data = Buffer.alloc(8);
  data.writeBigUInt64LE(n);
  return data;
};
const nonce = () => Buffer.from(crypto.getRandomValues(new Uint8Array(8)));
export const wildMint = PublicKey.findProgramAddressSync(
  [Buffer.from("wild")],
  program,
)[0];
const tag = async (name: string) =>
  Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(name)),
  ).subarray(0, 8);

type SigningWallet = BrowserWallet & {
  signTransaction?: (tx: Transaction) => Promise<Transaction>;
};
async function signer(expected: string) {
  const wallet = browserWallet() as SigningWallet | undefined;
  if (!wallet?.signTransaction)
    throw Error(
      "Use a browser Solana wallet that supports transaction signing.",
    );
  const { publicKey } = await wallet.connect();
  const key = new PublicKey(publicKey.toString());
  if (key.toBase58() !== expected)
    throw Error("Switch your browser wallet to the one signed into WildHatch.");
  return { wallet, key };
}
export async function deployed() {
  return Boolean((await base.getAccountInfo(program))?.executable);
}
async function previewShopPayment(tx: Transaction) {
  const { value } = await base.simulateTransaction(tx);
  if (!value.err) return;
  if (value.logs?.some((line) => line.includes("InstructionFallbackNotFound")))
    throw Error(
      "This purchase opens after the WildHatch Devnet shop program upgrade.",
    );
  throw Error(
    "Devnet could not approve this purchase. Check your WILD and SOL balances for the price and fees.",
  );
}
async function transaction(
  user: Awaited<ReturnType<typeof signer>>,
  connection: Connection,
  name: string,
  accounts: AccountMeta[],
  args: Uint8Array[] = [],
  setup: TransactionInstruction[] = [],
) {
  const block = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: user.key, ...block }).add(
    ...setup,
    new TransactionInstruction({
      programId: program,
      keys: accounts,
      data: Buffer.concat([await tag("global:" + name), ...args]),
    }),
  );
  if (name === "buy_wild") await previewShopPayment(tx);
  const signed = await user.wallet.signTransaction!(tx);
  const signature = await connection.sendRawTransaction(signed.serialize());
  const result = await connection.confirmTransaction(
    { signature, ...block },
    "confirmed",
  );
  if (result.value.err)
    throw Error(
      "Devnet rejected the transaction. Check the match or listing and try again.",
    );
  return signature;
}
async function rpc(endpoint: string, method: string, params: string[] = []) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return undefined;
  const parsed = await parseJsonBody(response);
  return parsed?.result;
}
async function rollupFor(key: PublicKey) {
  const result = await rpc(router, "getDelegationStatus", [key.toBase58()]);
  if (typeof result?.isDelegated !== "boolean")
    throw Error("MagicBlock Router is unavailable.");
  if (!result.isDelegated) return undefined;
  const endpoint = new URL(result.fqdn);
  if (
    endpoint.protocol !== "https:" ||
    !endpoint.hostname.endsWith(".magicblock.app")
  )
    throw Error("Unexpected MagicBlock endpoint.");
  return new Connection(endpoint.href, "confirmed");
}
async function readAccount(
  connection: Connection,
  address: PublicKey,
  name: string,
  size: number,
) {
  const info = await connection.getAccountInfo(address);
  if (
    !info ||
    !info.owner.equals(program) ||
    info.data.length !== size ||
    !info.data.subarray(0, 8).equals(await tag("account:" + name))
  ) {
    throw Error("No active " + name.toLowerCase() + " at that address.");
  }
  return info.data;
}
async function companionEntry(wallet: PublicKey, choice?: OwnedCollectible) {
  if (!choice) return { accounts: [], instructions: [] };
  const holding = await findWalletHolding(wallet, choice.mint, 1n);
  if (!holding || !(await collectibleTraits(choice.mint)))
    throw Error("Your wallet must currently hold this WildHatch collectible.");
  return {
    // Include SPL Token so the runtime records the holding in transaction metadata.
    accounts: [account(token), account(holding)],
    instructions: [
      new TransactionInstruction({
        programId: new PublicKey(beastMemoProgram),
        keys: [account(wallet, false, true)],
        data: Buffer.from(arenaCompanionPrefix + choice.mint.toBase58()),
      }),
    ],
  };
}

export async function createDuel(
  wallet: string,
  rival: string,
  companion?: OwnedCollectible,
) {
  const user = await signer(wallet),
    id = nonce(),
    opponent = new PublicKey(rival);
  const address = pda("duel", user.key, program, [id]);
  const entry = await companionEntry(user.key, companion);
  await transaction(
    user,
    base,
    "create_duel",
    [
      account(user.key, true, true),
      account(address, true),
      account(system),
      ...entry.accounts,
    ],
    [id, opponent.toBuffer()],
    entry.instructions,
  );
  return address.toBase58();
}
export async function duelState(address: string) {
  const key = new PublicKey(address);
  const rollup = await rollupFor(key);
  const data = await readAccount(rollup ?? base, key, "Duel", 102);
  return {
    players: [
      new PublicKey(data.subarray(8, 40)).toBase58(),
      new PublicKey(data.subarray(40, 72)).toBase58(),
    ],
    hp: [data[80], data[81]],
    turn: data[86],
    moves: data.readUInt16LE(87),
    lastMove: data[89],
    damage: data[90],
    deadline: Number(data.readBigInt64LE(91)),
    state: data[99],
    delegated: Boolean(rollup),
    rewarded: Boolean(data[100]),
    rolledUp: Boolean(data[101]),
  };
}
export async function duelAction(
  wallet: string,
  address: string,
  command: "join" | "delegate" | "settle" | "timeout" | "reward" | number,
  moves: number,
  companion?: OwnedCollectible,
) {
  const user = await signer(wallet),
    key = new PublicKey(address),
    player = account(user.key, false, true),
    duel = account(key, true);
  if (command === "join") {
    const entry = await companionEntry(user.key, companion);
    return transaction(
      user,
      base,
      "join_duel",
      [player, duel, ...entry.accounts],
      [],
      entry.instructions,
    );
  }
  if (command === "delegate") {
    return transaction(user, base, "delegate_duel", [
      account(user.key, true, true),
      account(pda("buffer", key), true),
      account(pda("delegation", key, delegate), true),
      account(pda("delegation-metadata", key, delegate), true),
      duel,
      account(program),
      account(delegate),
      account(system),
    ]);
  }
  if (command === "reward") {
    const destination = ata(wildMint, user.key);
    return transaction(
      user,
      base,
      "claim_wild",
      [
        player,
        duel,
        account(wildMint, true),
        account(destination, true),
        account(token),
      ],
      [],
      [createAta(user.key, destination, wildMint)],
    );
  }
  const rollup = await rollupFor(key);
  if (!rollup) throw Error("The host must activate MagicBlock before playing.");
  if (command === "settle")
    return transaction(user, rollup, "settle_duel", [
      account(user.key, true, true),
      duel,
      account(magic),
      account(context, true),
    ]);
  if (command === "timeout")
    return transaction(user, rollup, "claim_timeout", [player, duel]);
  const revision = Buffer.alloc(2);
  revision.writeUInt16LE(moves);
  return transaction(
    user,
    rollup,
    "play_move",
    [player, duel],
    [Uint8Array.of(command), revision],
  );
}

function amount(value: string, decimals: number) {
  if (!/^\d+(?:\.\d+)?$/.test(value) || value.length > 40)
    throw Error("Enter a positive decimal amount.");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals)
    throw Error("Amount has too many decimal places.");
  const n = BigInt(whole + fraction.padEnd(decimals, "0"));
  if (!n || n > 0xffff_ffff_ffff_ffffn) throw Error("Amount is out of range.");
  return n;
}
function format(n: bigint, decimals: number) {
  const digits = n.toString().padStart(decimals + 1, "0");
  return decimals
    ? digits.slice(0, -decimals) +
        "." +
        digits.slice(-decimals).replace(/0+$/, "").padEnd(1, "0")
    : digits;
}

export async function readWalletBalances(wallet: string) {
  const owner = new PublicKey(wallet);
  const [lamports, accounts] = await Promise.all([
    base.getBalance(owner),
    base.getParsedTokenAccountsByOwner(owner, { mint: wildMint }),
  ]);
  const wild = accounts.value.reduce(
    (sum, { account }) =>
      sum + BigInt(account.data.parsed.info.tokenAmount.amount),
    0n,
  );
  return { sol: format(BigInt(lamports), 9), wild: format(wild, 6) };
}
function ata(mint: PublicKey, owner: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), token.toBuffer(), mint.toBuffer()],
    associated,
  )[0];
}
function createAta(payer: PublicKey, destination: PublicKey, mint: PublicKey) {
  return new TransactionInstruction({
    programId: associated,
    keys: [
      account(payer, true, true),
      account(destination, true),
      account(payer),
      account(mint),
      account(system),
      account(token),
    ],
    data: Buffer.from([1]),
  });
}
async function mintDecimals(mint: PublicKey) {
  const info = await base.getAccountInfo(mint);
  if (!info?.owner.equals(token) || info.data.length !== 82 || !info.data[45])
    throw Error("Choose an initialized classic SPL mint.");
  return info.data[44];
}
export async function offerAsset(
  wallet: string,
  input: { mint: string; tokens: string; sol: string },
) {
  const user = await signer(wallet),
    mint = new PublicKey(input.mint),
    id = nonce();
  const offer = pda("offer", user.key, program, [id]),
    vault = pda("vault", offer);
  const quantity = amount(input.tokens, await mintDecimals(mint)),
    price = amount(input.sol, 9);
  const source = await findWalletHolding(user.key, mint, quantity);
  if (!source)
    throw Error(
      "This wallet does not hold the listing amount in a single token account.",
    );
  await transaction(
    user,
    base,
    "offer_asset",
    [
      account(user.key, true, true),
      account(mint),
      account(source, true),
      account(offer, true),
      account(vault, true),
      account(system),
      account(token),
    ],
    [id, u64(quantity), u64(price)],
  );
  return offer.toBase58();
}
export async function assetOffer(address: string) {
  const key = new PublicKey(address),
    data = await readAccount(base, key, "Offer", 96);
  const { seller, mint, quantity, price } = offerFields(data);
  return {
    seller,
    mint,
    quantity,
    price,
    tokens: format(quantity, await mintDecimals(mint)),
    sol: format(price, 9),
  };
}

function offerFields(data: Buffer) {
  const seller = new PublicKey(data.subarray(8, 40));
  const mint = new PublicKey(data.subarray(40, 72));
  const quantity = data.readBigUInt64LE(80),
    price = data.readBigUInt64LE(88);
  return { seller, mint, quantity, price };
}

export async function openAssetOffers() {
  const discriminator = await tag("account:Offer");
  const entries = await base.getProgramAccounts(program, {
    filters: [
      { dataSize: 96 },
      { memcmp: { offset: 0, bytes: bs58.encode(discriminator) } },
    ],
  });
  return entries
    .map(({ pubkey, account }) => {
      const { seller, mint, price } = offerFields(account.data);
      return {
        address: pubkey.toBase58(),
        seller,
        mint,
        price,
        sol: format(price, 9),
      };
    })
    .sort((a, b) => (a.price < b.price ? -1 : a.price === b.price ? 0 : 1));
}
export async function settleOffer(
  wallet: string,
  address: string,
  offer: Awaited<ReturnType<typeof assetOffer>>,
  cancel: boolean,
) {
  const user = await signer(wallet),
    key = new PublicKey(address),
    vault = pda("vault", key);
  const destination = ata(offer.mint, user.key);
  const accounts = [
    account(offer.mint),
    account(destination, true),
    account(key, true),
    account(vault, true),
  ];
  const setup = [createAta(user.key, destination, offer.mint)];
  if (cancel)
    return transaction(
      user,
      base,
      "cancel_offer",
      [account(user.key, true, true), ...accounts, account(token)],
      [],
      setup,
    );
  return transaction(
    user,
    base,
    "buy_asset",
    [
      account(user.key, true, true),
      account(offer.seller, true),
      ...accounts,
      account(system),
      account(token),
    ],
    [u64(offer.price), u64(offer.quantity)],
    setup,
  );
}
function beastMintAddress(beast: string) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("beast"), Buffer.from(beast.replaceAll("-", ""), "hex")],
    program,
  )[0];
}

type CollectibleTraits = NonNullable<ReturnType<typeof readBeastMemo>>;
const verifiedTraits = new Map<string, CollectibleTraits>();
export type OwnedCollectible = { mint: PublicKey; traits: CollectibleTraits };

export async function collectibleTraits(mint: PublicKey) {
  const address = mint.toBase58();
  const cached = verifiedTraits.get(address);
  if (cached) return cached;
  const discriminator = await tag("global:mint_beast");
  let before: string | undefined;
  for (let page = 0; page < 5; page++) {
    const signatures = await base.getSignaturesForAddress(
      mint,
      { before, limit: 100 },
      "finalized",
    );
    for (const item of signatures) {
      if (item.err || !item.memo?.includes(beastMemoPrefix)) continue;
      const record = await base.getParsedTransaction(item.signature, {
        commitment: "finalized",
        maxSupportedTransactionVersion: 0,
      });
      if (!record?.meta || record.meta.err) continue;
      const message = record.transaction.message;
      const [issue, note] = message.instructions;
      if (
        message.instructions.length !== 2 ||
        !issue.programId.equals(program) ||
        !("accounts" in issue) ||
        issue.accounts[1]?.toBase58() !== wildhatchIssuer ||
        !issue.accounts[2]?.equals(mint) ||
        note.programId.toBase58() !== beastMemoProgram ||
        !("parsed" in note) ||
        typeof note.parsed !== "string" ||
        !message.accountKeys.some(
          (account) =>
            account.signer && account.pubkey.toBase58() === wildhatchIssuer,
        )
      )
        continue;
      const traits = readBeastMemo(note.parsed);
      if (
        traits &&
        beastMintAddress(traits.id).equals(mint) &&
        issue.data ===
          bs58.encode(
            Buffer.concat([
              discriminator,
              Buffer.from(traits.id.replaceAll("-", ""), "hex"),
            ]),
          )
      ) {
        verifiedTraits.set(address, traits);
        return traits;
      }
    }
    if (signatures.length < 100) break;
    before = signatures.at(-1)?.signature;
  }
}

async function findWalletHolding(
  owner: PublicKey,
  mint: PublicKey,
  amount: bigint,
) {
  const holdings = await base.getParsedTokenAccountsByOwner(owner, { mint });
  return holdings.value.find(
    ({ account }) =>
      account.owner.equals(token) &&
      account.data.parsed.info.state === "initialized" &&
      BigInt(account.data.parsed.info.tokenAmount.amount) >= amount,
  )?.pubkey;
}

export async function ownsCollectible(wallet: string, mint: string) {
  return Boolean(
    await findWalletHolding(new PublicKey(wallet), new PublicKey(mint), 1n),
  );
}

export async function walletCollectibles(
  wallet: string,
): Promise<OwnedCollectible[]> {
  const { value } = await base.getParsedTokenAccountsByOwner(
    new PublicKey(wallet),
    { programId: token },
  );
  const candidates = [
    ...new Set(
      value.flatMap(({ account }) => {
        const info = account.data.parsed.info;
        return info.state === "initialized" &&
          info.tokenAmount.amount === "1" &&
          info.tokenAmount.decimals === 0
          ? [String(info.mint)]
          : [];
      }),
    ),
  ];
  const owned: OwnedCollectible[] = [];
  for (let i = 0; i < candidates.length; i += 4) {
    const page = await Promise.all(
      candidates.slice(i, i + 4).map(async (address) => {
        const mint = new PublicKey(address);
        const traits = await collectibleTraits(mint);
        return traits && { mint, traits };
      }),
    );
    for (const entry of page) if (entry) owned.push(entry);
  }
  return owned;
}

export async function matchCompanions(address: string, players: string[]) {
  const match = new PublicKey(address);
  const tags = await Promise.all(
    ["create_duel", "join_duel"].map((name) => tag("global:" + name)),
  );
  const owners = players.map((player) => new PublicKey(player));
  const companions: (OwnedCollectible | undefined)[] = [undefined, undefined];
  let before: string | undefined;
  for (let page = 0; page < 3; page++) {
    const entries = await base.getSignaturesForAddress(
      match,
      { before, limit: 40 },
      "confirmed",
    );
    for (const entry of entries) {
      if (entry.err || !entry.memo?.includes(arenaCompanionPrefix)) continue;
      const record = await base.getParsedTransaction(entry.signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!record) continue;
      for (const [i, owner] of owners.entries()) {
        if (companions[i]) continue;
        const mint = verifyArenaCompanionEntry(
          record,
          match,
          owner,
          program,
          beastMemoProgram,
          token,
          tags[i],
        );
        const traits = mint && (await collectibleTraits(mint));
        if (mint && traits) companions[i] = { mint, traits };
      }
      if (companions.every(Boolean)) return companions;
    }
    if (entries.length < 40) break;
    before = entries.at(-1)?.signature;
  }
  return companions;
}

export async function mintBeast(wallet: string, beast: string) {
  const user = await signer(wallet);
  const response = await fetch("/api/collectible", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ beast }),
  });
  const result = await readApiJson(
    response,
    "The collectible issuer is unavailable.",
  );
  const expected = beastMintAddress(beast);
  if (result.mint !== expected.toBase58())
    throw Error("The collectible mint does not match this beast.");
  if (!result.transaction) return expected.toBase58();
  const tx = Transaction.from(Buffer.from(result.transaction, "base64"));
  const [issue, note] = tx.instructions;
  if (
    !tx.feePayer?.equals(user.key) ||
    tx.instructions.length !== 2 ||
    !issue.programId.equals(program) ||
    !issue.data.equals(
      Buffer.concat([
        await tag("global:mint_beast"),
        Buffer.from(beast.replaceAll("-", ""), "hex"),
      ]),
    ) ||
    issue.keys[1]?.pubkey.toBase58() !== wildhatchIssuer ||
    !issue.keys[2]?.pubkey.equals(expected) ||
    note.programId.toBase58() !== beastMemoProgram ||
    note.keys.length !== 1 ||
    !note.keys[0].isSigner ||
    note.keys[0].pubkey.toBase58() !== wildhatchIssuer ||
    readBeastMemo(note.data.toString("utf8"))?.id !== beast
  ) {
    throw Error("The collectible transaction does not match this beast.");
  }
  const signed = await user.wallet.signTransaction!(tx);
  const signature = await base.sendRawTransaction(signed.serialize());
  const status = await base.confirmTransaction(
    {
      signature,
      blockhash: result.blockhash,
      lastValidBlockHeight: result.lastValidBlockHeight,
    },
    "finalized",
  );
  if (status.value.err)
    throw Error("Devnet rejected the collectible transaction.");
  return expected.toBase58();
}
const receiptKey = (wallet: string) => "wildhatch.devnet.receipt." + wallet;
export async function buyWildBundle(wallet: string) {
  const user = await signer(wallet);
  const destination = ata(wildMint, user.key);
  return transaction(
    user,
    base,
    "buy_wild",
    [
      account(user.key, true, true),
      account(new PublicKey(wildhatchIssuer), true),
      account(wildMint, true),
      account(destination, true),
      account(token),
      account(system),
    ],
    [],
    [createAta(user.key, destination, wildMint)],
  );
}
type Receipt = {
  signature: string;
  item: WildItem;
  box?: string;
  expires?: number;
};
export function pendingReceipt(wallet: string): Receipt | null {
  try {
    const prefix = receiptKey(wallet);
    const keys = Object.keys(localStorage).filter(
      (key) => key === prefix || key.startsWith(prefix + "."),
    );
    for (const key of keys) {
      let saved;
      try {
        saved = JSON.parse(localStorage.getItem(key) ?? "null");
      } catch {
        continue;
      }
      if (
        isWildItem(saved?.item) &&
        typeof saved.signature === "string" &&
        /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(saved.signature)
      )
        return saved as Receipt;
    }
  } catch {
    // A damaged receipt or unavailable storage should leave the shop usable.
  }
  return null;
}
function clearReceipt(wallet: string, receipt: Receipt) {
  const prefix = receiptKey(wallet);
  localStorage.removeItem(prefix + "." + receipt.signature);
  const legacy = localStorage.getItem(prefix);
  if (legacy) {
    try {
      if (JSON.parse(legacy)?.signature === receipt.signature)
        localStorage.removeItem(prefix);
    } catch {
      localStorage.removeItem(prefix);
    }
  }
}
export async function redeemReceipt(
  wallet: string,
  receipt = pendingReceipt(wallet),
) {
  if (!receipt) throw Error("There is no pending receipt.");
  if (receipt.expires) {
    const signature = (
      await base.getSignatureStatuses([receipt.signature], {
        searchTransactionHistory: true,
      })
    ).value[0];
    if (
      signature?.err ||
      (!signature && (await base.getBlockHeight("finalized")) > receipt.expires)
    ) {
      clearReceipt(wallet, receipt);
      throw Error("Payment failed or expired. You can try again.");
    }
  }
  const response = await fetch("/api/wild-receipt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(receipt),
  });
  const reward = await readApiJson(
    response,
    "Could not redeem the receipt.",
  );
  clearReceipt(wallet, receipt);
  return {
    reward: reward as WildReward,
    signature: receipt.signature,
    item: receipt.item,
    box: receipt.box,
  };
}
export async function payWithWild(
  wallet: string,
  item: WildItem,
  onSubmitted: () => void,
) {
  if (pendingReceipt(wallet))
    throw Error("Redeem the pending receipt before buying again.");
  const user = await signer(wallet);
  const block = await base.getLatestBlockhash();
  const tx = new Transaction({ feePayer: user.key, ...block });
  let box: string | undefined;
  if (mysteryBox(item)) {
    const seed = nonce();
    const opening = pda("box", user.key, program, [seed]);
    box = opening.toBase58();
    const [identity] = PublicKey.findProgramAddressSync(
      [Buffer.from("identity")],
      program,
    );
    tx.add(
      new TransactionInstruction({
        programId: program,
        keys: [
          account(user.key, true, true),
          account(opening, true),
          account(wildMint, true),
          account(ata(wildMint, user.key), true),
          account(
            new PublicKey("Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh"),
            true,
          ),
          account(token),
          account(identity),
          account(new PublicKey("Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz")),
          account(SYSVAR_SLOT_HASHES_PUBKEY),
          account(system),
        ],
        data: Buffer.concat([
          await tag("global:open_box"),
          seed,
          Uint8Array.of(item === "trail" ? 0 : 1),
        ]),
      }),
    );
  } else
    tx.add(
      new TransactionInstruction({
        programId: token,
        keys: [
          account(ata(wildMint, user.key), true),
          account(wildMint, true),
          account(user.key, false, true),
        ],
        data: Buffer.concat([
          Uint8Array.of(15),
          u64(BigInt(wildItems[item].cost) * 1_000_000n),
          Uint8Array.of(6),
        ]),
      }),
      new TransactionInstruction({
        programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
        keys: [account(user.key, false, true)],
        data: Buffer.from("WildHatch:" + item),
      }),
    );
  await previewShopPayment(tx);
  const signed = await user.wallet.signTransaction!(tx);
  const signature = bs58.encode(signed.signature!);
  const receipt = { signature, item, box, expires: block.lastValidBlockHeight };
  localStorage.setItem(
    receiptKey(wallet) + "." + signature,
    JSON.stringify(receipt),
  );
  await base.sendRawTransaction(signed.serialize());
  onSubmitted();
  const result = await base.confirmTransaction(
    { signature, ...block },
    "finalized",
  );
  if (result.value.err) {
    clearReceipt(wallet, receipt);
    throw Error("Devnet rejected the WILD payment.");
  }
  return redeemReceipt(wallet, receipt);
}
