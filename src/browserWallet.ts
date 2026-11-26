export type BrowserWallet = {
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signMessage(
    bytes: Uint8Array,
  ): Promise<Uint8Array | { signature: Uint8Array }>;
};
export function browserWallet() {
  const providers = window as Window & {
    phantom?: { solana?: BrowserWallet };
    solflare?: BrowserWallet;
    backpack?: { solana?: BrowserWallet };
    solana?: BrowserWallet;
  };
  return (
    providers.phantom?.solana ??
    providers.solflare ??
    providers.backpack?.solana ??
    providers.solana
  );
}
export async function walletSignature(wallet: BrowserWallet, message: string) {
  const signed = await wallet.signMessage(new TextEncoder().encode(message));
  return btoa(
    String.fromCharCode(
      ...(signed instanceof Uint8Array ? signed : signed.signature),
    ),
  );
}
export async function signInWithWallet() {
  const wallet = browserWallet();
  if (!wallet) throw Error("Open WildHatch in a browser with a Solana wallet.");
  const { publicKey } = await wallet.connect();
  async function post(path: string, payload: object) {
    const response = await fetch("/api/wallet/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || "Wallet sign-in failed.");
    return result;
  }
  const { id, message } = await post("challenge", {
    address: publicKey.toString(),
  });
  return post("login", {
    id,
    signature: await walletSignature(wallet, message),
  }) as Promise<{ wallet: string; unlockedRangers: number[] }>;
}
