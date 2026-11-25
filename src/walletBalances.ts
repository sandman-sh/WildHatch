export function mountWalletBalances(root: HTMLElement, wallet: string) {
  const container = document.createElement("section");
  container.className = "wallet-balances";
  container.setAttribute("aria-label", "Solana Devnet wallet balances");
  const list = document.createElement("dl");
  const amounts = ["Devnet SOL", "Devnet WILD"].map((label) => {
    const entry = document.createElement("div");
    const title = document.createElement("dt");
    const value = document.createElement("dd");
    title.textContent = label;
    value.textContent = "—";
    entry.append(title, value);
    list.append(entry);
    return value;
  });
  const refreshButton = document.createElement("button");
  refreshButton.className = "secondary";
  refreshButton.type = "button";
  refreshButton.textContent = "Refresh balances";
  const status = document.createElement("p");
  status.className = "wallet-balance-status";
  status.setAttribute("role", "status");
  container.append(list, refreshButton, status);
  root.append(container);

  let latest = 0;
  async function refresh() {
    const request = ++latest;
    refreshButton.disabled = true;
    status.textContent = "Checking wallet balances…";
    try {
      const { readWalletBalances } = await import("./devnet");
      const { sol, wild } = await readWalletBalances(wallet);
      if (request !== latest || !container.isConnected) return;
      amounts[0].textContent = sol;
      amounts[1].textContent = wild;
      status.textContent = "";
    } catch {
      if (request === latest && container.isConnected)
        status.textContent = "Could not refresh Devnet balances.";
    } finally {
      if (request === latest) refreshButton.disabled = false;
    }
  }
  refreshButton.onclick = () => void refresh();
  void refresh();
  return refresh;
}
