import { PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";
import bs58 from "bs58";

export const arenaCompanionPrefix = "WildHatch Arena Companion v1 ";

export function verifyArenaCompanionEntry(
  record: ParsedTransactionWithMeta,
  match: PublicKey,
  player: PublicKey,
  program: PublicKey,
  memoProgram: string,
  tokenProgram: PublicKey,
  entryTag: Uint8Array,
) {
  if (!record.meta || record.meta.err) return;
  const { instructions, accountKeys } = record.transaction.message;
  const [memo, entry] = instructions;
  if (
    instructions.length !== 2 ||
    memo.programId.toBase58() !== memoProgram ||
    !("parsed" in memo) ||
    typeof memo.parsed !== "string" ||
    !memo.parsed.startsWith(arenaCompanionPrefix) ||
    !entry.programId.equals(program) ||
    !("accounts" in entry) ||
    !entry.accounts[0]?.equals(player) ||
    !entry.accounts[1]?.equals(match) ||
    !entry.accounts.at(-2)?.equals(tokenProgram) ||
    !accountKeys.some((key) => key.signer && key.pubkey.equals(player))
  )
    return;
  try {
    const data = bs58.decode(entry.data);
    if (!entryTag.every((byte, index) => data[index] === byte)) return;
    const mint = new PublicKey(memo.parsed.slice(arenaCompanionPrefix.length));
    const tokenAccount = entry.accounts.at(-1);
    const owner = player.toBase58();
    const balance = record.meta.preTokenBalances?.some(
      (balance) =>
        balance.owner === owner &&
        balance.programId === tokenProgram.toBase58() &&
        balance.mint === mint.toBase58() &&
        balance.uiTokenAmount.amount === "1" &&
        balance.uiTokenAmount.decimals === 0 &&
        tokenAccount !== undefined &&
        accountKeys[balance.accountIndex]?.pubkey.equals(tokenAccount),
    );
    if (balance) return mint;
  } catch {
    return;
  }
}
