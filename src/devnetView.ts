import { PublicKey } from "@solana/web3.js";
import {
  buyWildBundle,
  assetOffer,
  collectibleTraits,
  createDuel,
  deployed,
  duelAction,
  duelState,
  matchCompanions,
  offerAsset,
  openAssetOffers,
  payWithWild,
  pendingReceipt,
  program,
  redeemReceipt,
  settleOffer,
  walletCollectibles,
  wildMint,
  type OwnedCollectible,
} from "./devnet";
import { revealShopBox, shopGrid } from "./shopGrid";
import { rewardLabel, wildItems } from "./wildStore";
import { battleSound, gameAudio } from "./audio";
import { mountWalletBalances } from "./walletBalances";
import { elements } from "./shared";

export function mountDevnetView(
  root: HTMLElement,
  wallet: string,
  mode: "ranked" | "escrow" | "devnet-shop" | "owned-collectibles",
  collectibleMint?: string,
  listCollectible?: (mint: string) => void,
) {
  let closed = false;
  let busy = false;
  let poll: number | undefined;
  const refreshBalances = mountWalletBalances(root, wallet);
  const explorer = (address: string, kind = "address") =>
    "https://explorer.solana.com/" + kind + "/" + address + "?cluster=devnet";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  root.append(status);
  function add(tag: "h3" | "p" | "output", text: string, parent = root) {
    const element = document.createElement(tag);
    element.textContent = text;
    parent.append(element);
    return element;
  }
  function input(label: string) {
    const field = document.createElement("label");
    field.className = "field-select";
    const control = document.createElement("input");
    control.required = true;
    control.autocomplete = "off";
    control.spellcheck = false;
    control.setAttribute("aria-label", label);
    field.append(label, control);
    root.append(field);
    return control;
  }
  function button(
    label: string,
    action: () => Promise<void>,
    parent = root,
    primary = false,
  ) {
    const button = document.createElement("button");
    button.className = primary ? "primary" : "secondary";
    button.textContent = label;
    button.onclick = async () => {
      if (closed || busy) return;
      busy = true;
      button.disabled = true;
      status.textContent = "Working…";
      try {
        await action();
        if (!closed && status.textContent === "Working…")
          status.textContent = "";
      } catch (error) {
        if (!closed)
          status.textContent =
            error instanceof Error ? error.message : "Devnet request failed.";
      } finally {
        busy = false;
        button.disabled = false;
      }
    };
    parent.append(button);
    return button;
  }
  function link(text: string, href: string, parent = root) {
    const anchor = document.createElement("a");
    anchor.textContent = text;
    anchor.href = href;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    parent.append(anchor);
  }
  function reflectTx(signature: string) {
    void refreshBalances();
    status.textContent = "Confirmed. ";
    link("View transaction", explorer(signature, "tx"), status);
  }
  function portrait(species: string, card: HTMLElement) {
    if (!Object.hasOwn(elements, species)) return;
    const image = document.createElement("img");
    image.className = "devnet-beast-portrait";
    image.src = "/beast-portraits/" + encodeURIComponent(species) + ".webp";
    image.alt = "";
    image.loading = "lazy";
    card.append(image);
  }
  async function start() {
    status.textContent = "Checking the WildHatch program on Devnet…";
    if (!(await deployed())) {
      status.textContent =
        "The WildHatch program is awaiting deployment on Solana Devnet.";
      return;
    }
    if (closed) return;
    status.textContent = "";
    link("View WildHatch program", explorer(program.toBase58()));
    if (mode === "ranked") buildDuel();
    else if (mode === "escrow") buildEscrow();
    else if (mode === "owned-collectibles") buildCollection();
    else buildShop();
  }
  function buildCollection() {
    const gallery = document.createElement("div");
    gallery.className = "devnet-asset-list";
    async function refresh() {
      gallery.replaceChildren();
      add("p", "Reading the collectibles in your wallet…", gallery);
      try {
        const collectibles = await walletCollectibles(wallet);
        if (closed) return;
        gallery.replaceChildren();
        if (!collectibles.length) {
          add(
            "p",
            "Your wallet has no verified WildHatch collectibles. Mint an eligible beast from the journal or buy one through Devnet escrow.",
            gallery,
          );
        }
        for (const { mint, traits } of collectibles) {
          const card = document.createElement("article");
          gallery.append(card);
          portrait(traits.species, card);
          add("h3", traits.species, card);
          add(
            "p",
            [
              traits.rarity,
              traits.element,
              "Level " + traits.level,
              "Variant " + traits.variant,
            ].join(" · "),
            card,
          );
          link("Verify mint", explorer(mint.toBase58()), card);
          if (listCollectible)
            button(
              "List for SOL",
              async () => listCollectible(mint.toBase58()),
              card,
              true,
            );
        }
      } catch {
        if (!closed)
          gallery.replaceChildren(
            Object.assign(document.createElement("p"), {
              textContent:
                "Devnet could not verify the collection. Refresh to try again.",
            }),
          );
      }
    }
    button("Refresh collection", refresh);
    root.append(gallery);
    void refresh();
  }

  function buildDuel() {
    add(
      "p",
      "Invite a wallet, activate the match on MagicBlock, then take turns. Each move requires a wallet signature.",
    );
    const opponent = input("Opponent wallet");
    const address = input("Match address");
    address.value = sessionStorage.getItem("wildhatch.devnet.duel") ?? "";
    const companionLabel = document.createElement("label");
    companionLabel.className = "field-select";
    const companionChoice = document.createElement("select");
    companionChoice.add(new Option("No companion", ""));
    companionLabel.append("Wallet companion", companionChoice);
    root.append(companionLabel);
    add(
      "p",
      "Choose a wallet-owned beast to display beside you. Match rules stay the same for both players.",
    );
    let owned: OwnedCollectible[] = [];
    const selected = () =>
      owned.find(({ mint }) => mint.toBase58() === companionChoice.value);
    async function loadCompanions() {
      owned = await walletCollectibles(wallet);
      if (closed) return;
      const choice = companionChoice.value;
      companionChoice.replaceChildren(new Option("No companion", ""));
      for (const { mint, traits } of owned) {
        companionChoice.add(
          new Option(traits.species + " · " + traits.rarity, mint.toBase58()),
        );
      }
      if (owned.some(({ mint }) => mint.toBase58() === choice))
        companionChoice.value = choice;
    }
    button("Refresh wallet companions", loadCompanions);
    void loadCompanions().catch(() => {});
    const board = document.createElement("div");
    const companionBoard = document.createElement("div");
    companionBoard.className = "devnet-asset-list";
    const moves = ["Strike", "Pulse", "Guard", "Scorch"];
    let last = "";
    let settling = "";
    let previousMatch:
      { key: string; moves: number; state: number } | undefined;
    let companionRequest = "";
    async function refresh() {
      const key = address.value.trim();
      if (!key || closed) return;
      const state = await duelState(key);
      if (closed || address.value.trim() !== key) return;
      const lookup = key + ":" + (state.state === 0 ? "host" : "both");
      if (lookup !== companionRequest) {
        companionRequest = lookup;
        companionBoard.replaceChildren();
        void matchCompanions(key, state.players)
          .then((entries) => {
            if (
              closed ||
              companionRequest !== lookup ||
              address.value.trim() !== key
            )
              return;
            entries.forEach((entry, i) => {
              if (!entry) return;
              const card = document.createElement("article");
              companionBoard.append(card);
              portrait(entry.traits.species, card);
              add(
                "h3",
                (i === 0 ? "Host · " : "Challenger · ") + entry.traits.species,
                card,
              );
              add(
                "p",
                entry.traits.rarity + " · Wallet ownership verified at entry",
                card,
              );
              link(
                "View companion mint",
                explorer(entry.mint.toBase58()),
                card,
              );
            });
          })
          .catch(() => {
            if (companionRequest === lookup) companionRequest = "";
          });
      }
      if (settling === key && !state.delegated) {
        settling = "";
        status.textContent = "Match settled on Solana Devnet.";
      }
      sessionStorage.setItem("wildhatch.devnet.duel", key);
      const expired = Date.now() >= state.deadline * 1000;
      const revision = JSON.stringify([key, state, expired]);
      if (revision === last) return;
      last = revision;
      board.replaceChildren();
      const player = state.players.indexOf(wallet);
      if (player >= 0 && previousMatch?.key === key) {
        if (state.moves > previousMatch.moves)
          gameAudio.play(battleSound(moves[state.lastMove]));
        if (state.state === 1 && previousMatch.state === 0)
          gameAudio.play("duelStart");
        if (state.state > 1 && previousMatch.state === 1 && state.state !== 4)
          gameAudio.play(state.state === player + 2 ? "victory" : "defeat");
      }
      previousMatch = { key, moves: state.moves, state: state.state };
      add(
        "h3",
        state.delegated ? "MagicBlock match" : "Solana Devnet match",
        board,
      );
      add(
        "p",
        "Host " + state.hp[0] + "/40 HP · Challenger " + state.hp[1] + "/40 HP",
        board,
      );
      if (state.moves)
        add(
          "p",
          moves[state.lastMove] + " · " + state.damage + " damage",
          board,
        );
      const action = (
        label: string,
        command: Parameters<typeof duelAction>[2],
      ) =>
        button(
          label,
          async () => {
            const signature = await duelAction(
              wallet,
              key,
              command,
              state.moves,
              command === "join" ? selected() : undefined,
            );
            if (command === "settle") {
              settling = key;
              status.textContent =
                "Settlement requested on MagicBlock. Waiting for Solana Devnet.";
            } else if (state.delegated && command !== "reward") {
              status.textContent = "Move confirmed on MagicBlock.";
            } else reflectTx(signature);
          },
          board,
          true,
        );
      if (state.state === 0) {
        add(
          "p",
          "Waiting for the invited wallet. Share this match address.",
          board,
        );
        if (player === 1 && !expired) action("Accept challenge", "join");
      } else if (state.state === 1 && !state.delegated) {
        add(
          "p",
          "Both wallets have joined. The host can activate MagicBlock.",
          board,
        );
        if (player === 0) action("Activate MagicBlock", "delegate");
      } else if (state.state === 1) {
        add(
          "p",
          player === state.turn ? "Your turn" : "Opponent’s turn",
          board,
        );
        if (player === state.turn && !expired)
          moves.forEach((move, index) => action(move, index));
        if (player >= 0 && player !== state.turn && expired)
          action("Claim expired turn", "timeout");
      } else {
        add(
          "p",
          state.state === 4
            ? "Draw"
            : "Winner · " + state.players[state.state - 2],
          board,
        );
        if (state.delegated && player >= 0)
          action("Settle to Solana", "settle");
        if (!state.delegated) {
          link("View settled match", explorer(key), board);
          if (
            state.rolledUp &&
            !state.rewarded &&
            state.state === player + 2 &&
            state.hp[1 - player] === 0
          )
            action("Claim 12 Devnet WILD", "reward");
        }
      }
    }
    button(
      "Create challenge",
      async () => {
        address.value = await createDuel(
          wallet,
          opponent.value.trim(),
          selected(),
        );
        void refreshBalances();
        await refresh();
      },
      root,
      true,
    );
    button("Load match", async () => {
      companionRequest = "";
      await refresh();
    });
    root.append(companionBoard, board);
    poll = window.setInterval(() => {
      if (!busy && last) void refresh().catch(() => {});
    }, 2500);
  }
  function buildEscrow() {
    const listings = document.createElement("div");
    listings.className = "devnet-asset-list";
    let shown = 12;
    async function browse() {
      listings.replaceChildren();
      add("p", "Reading open escrow offers…", listings);
      try {
        const offers = await openAssetOffers();
        if (closed) return;
        listings.replaceChildren();
        if (!offers.length)
          add("p", "There are no open Devnet offers yet.", listings);
        for (const offer of offers.slice(0, shown)) {
          const card = document.createElement("article");
          listings.append(card);
          const short = offer.mint.toBase58();
          add(
            "h3",
            offer.mint.equals(wildMint)
              ? "Devnet WILD"
              : short.slice(0, 6) + "…" + short.slice(-4),
            card,
          );
          add(
            "p",
            offer.sol +
              " Devnet SOL" +
              (offer.seller.toBase58() === wallet ? " · Your offer" : ""),
            card,
          );
          button(
            "Inspect offer",
            async () => {
              address.value = offer.address;
              await load();
              details.scrollIntoView({ block: "nearest" });
            },
            card,
            true,
          );
        }
        if (offers.length > shown)
          button(
            "Load more offers",
            async () => {
              shown += 12;
              await browse();
            },
            listings,
          );
      } catch {
        if (!closed)
          listings.replaceChildren(
            Object.assign(document.createElement("p"), {
              textContent:
                "Devnet offer discovery is unavailable. You can still inspect a known escrow address.",
            }),
          );
      }
    }
    add("h3", "Open Devnet offers");
    button("Refresh market", browse);
    root.append(listings);
    add(
      "p",
      "Set a Devnet SOL price for a classic SPL token or collectible in your wallet. The program holds the asset until purchase or withdrawal.",
    );
    const mint = input("SPL mint address"),
      quantity = input("Token amount"),
      price = input("SOL price");
    mint.value = collectibleMint ?? wildMint.toBase58();
    if (collectibleMint) quantity.value = "1";
    const address = input("Escrow address");
    const details = document.createElement("div");
    function showTraits(
      traits: NonNullable<Awaited<ReturnType<typeof collectibleTraits>>>,
    ) {
      add("h3", traits.species, details);
      add(
        "p",
        [
          traits.rarity,
          traits.element,
          traits.personality,
          "Level " + traits.level,
          "Stage " + traits.stage,
        ].join(" · "),
        details,
      );
      add(
        "p",
        "Variant " +
          traits.variant +
          " · Crest " +
          traits.marking +
          " · Mutation " +
          traits.mutation,
        details,
      );
    }
    async function load() {
      const key = address.value.trim();
      const offer = await assetOffer(key);
      const traits =
        offer.tokens === "1"
          ? await collectibleTraits(offer.mint).catch(() => undefined)
          : undefined;
      if (closed || address.value.trim() !== key) return;
      details.replaceChildren();
      if (traits) showTraits(traits);
      add(
        "p",
        offer.tokens + " tokens for " + offer.sol + " Devnet SOL",
        details,
      );
      link("Verify mint on Devnet", explorer(offer.mint.toBase58()), details);
      if (offer.seller.toBase58() === wallet) {
        button(
          "Withdraw asset",
          async () => {
            reflectTx(await settleOffer(wallet, key, offer, true));
            details.replaceChildren();
            void browse();
          },
          details,
        );
      } else {
        button(
          "Buy for " + offer.sol + " SOL",
          async () => {
            reflectTx(await settleOffer(wallet, key, offer, false));
            details.replaceChildren();
            if (traits)
              add(
                "p",
                "The beast is now in the buyer’s wallet collection.",
                details,
              );
            void browse();
          },
          details,
          true,
        );
      }
    }
    button(
      "Create escrow",
      async () => {
        address.value = await offerAsset(wallet, {
          mint: mint.value.trim(),
          tokens: quantity.value.trim(),
          sol: price.value.trim(),
        });
        void refreshBalances();
        void browse();
        await load();
      },
      root,
      true,
    );
    button("Inspect beast traits", async () => {
      const key = mint.value.trim();
      const traits = await collectibleTraits(new PublicKey(key));
      if (closed || mint.value.trim() !== key) return;
      details.replaceChildren();
      if (traits) showTraits(traits);
      else
        add(
          "p",
          "No verified WildHatch trait record found for this mint.",
          details,
        );
    });
    button("Inspect escrow", load);
    root.append(details);
    void browse();
  }
  function buildShop() {
    const bundle = document.createElement("section");
    bundle.className = "shop-bundle";
    root.append(bundle);
    add("h3", "WILD bundle", bundle);
    add("p", "24 Devnet WILD for 0.1 Devnet SOL, plus network fees.", bundle);
    button(
      "Buy 24 WILD",
      async () => reflectTx(await buyWildBundle(wallet)),
      bundle,
      true,
    );
    add(
      "p",
      "MagicBlock verifies each box roll on-chain. Each opening also uses Devnet SOL for network fees and the receipt.",
      root,
    );
    status.className = "shop-reveal";
    const result = (purchase: Awaited<ReturnType<typeof redeemReceipt>>) => {
      if (closed) return;
      status.textContent =
        "Added to your pack · " + rewardLabel(purchase.reward) + " ";
      link(
        "View on Solana",
        purchase.box
          ? explorer(purchase.box)
          : explorer(purchase.signature, "tx"),
        status,
      );
      revealShopBox(root, purchase.item, purchase.reward);
      gameAudio.play(purchase.reward.aurora ? "rare" : "resource");
    };
    const retry = button("Check pending purchase", async () => {
      try {
        result(await redeemReceipt(wallet));
      } finally {
        sync();
      }
    });
    function sync() {
      const pending = pendingReceipt(wallet);
      retry.hidden = !pending;
      status.classList.toggle("shop-awaiting", !!pending);
      for (const control of purchases) control.disabled = !!pending;
    }
    const purchases: HTMLButtonElement[] = [];
    shopGrid(root, (id, card) => {
      const control = button(
        wildItems[id].cost + " Devnet WILD",
        async () => {
          try {
            status.textContent = "Confirm in your wallet…";
            result(
              await payWithWild(wallet, id, () => {
                status.textContent =
                  "Payment submitted. Waiting for confirmation…";
                sync();
              }),
            );
          } finally {
            sync();
            void refreshBalances();
          }
        },
        card,
      );
      purchases.push(control);
    });
    root.insertBefore(status, bundle);
    root.insertBefore(retry, bundle);
    sync();
    if (pendingReceipt(wallet))
      status.textContent = "Checking your pending purchase…";
    poll = window.setInterval(() => {
      if (closed || busy || !pendingReceipt(wallet)) return;
      busy = true;
      void redeemReceipt(wallet)
        .then(result)
        .catch((error: Error) => {
          if (!closed && status.textContent !== error.message)
            status.textContent = error.message;
        })
        .finally(() => {
          busy = false;
          sync();
        });
    }, 6000);
  }
  void start().catch((error) => {
    if (!closed)
      status.textContent =
        error instanceof Error ? error.message : "Devnet is unavailable.";
  });
  return () => {
    closed = true;
    clearInterval(poll);
  };
}
