import "./style.css";
import "./menu.css";
import "./desktopMenu.css";
import { guestSessionId } from "./worldConnection";
import {
  chooseFieldRanger,
  rangerFor,
  selectedRanger,
  setWalletRoster,
} from "./rangers";
import { gameAudio } from "./audio";
import { enterGameDisplay, setExpeditionDisplay } from "./displayMode";
import { signInWithWallet } from "./browserWallet";
import { mountUsernameEditor } from "./usernameEditor";
import { mountWalletBalances } from "./walletBalances";
import type { Profile } from "./shared";
import type { PlayMode } from "./playMode";

const menu = document.querySelector<HTMLElement>("#main-menu")!;
const start = document.querySelector<HTMLButtonElement>("#start-game")!;
const startLabel = document.querySelector<HTMLElement>("#start-label")!;
const pvp = document.querySelector<HTMLButtonElement>("#start-pvp")!;
const guest = document.querySelector<HTMLButtonElement>("#start-guest")!;
const modeEntry = document.querySelector<HTMLDialogElement>("#mode-entry")!;
const modeTitle = document.querySelector<HTMLElement>("#mode-entry-title")!;
const modeDescription = document.querySelector<HTMLElement>(
  "#mode-entry-description",
)!;
const modeAction =
  document.querySelector<HTMLButtonElement>("#mode-entry-action")!;
const modeStatus = document.querySelector<HTMLElement>("#mode-entry-status")!;
const titlePanel = document.querySelector<HTMLDialogElement>("#title-panel")!;
type WalletMode = Exclude<PlayMode, "guest">;
const walletModes = {
  normal: {
    title: "Normal mode",
    description: "Explore the shared world and save your ranger’s progress.",
    play: "Start game",
  },
  pvp: {
    title: "PvP Arena",
    description: "Find an opponent or use an invite code for a 1v1 duel.",
    play: "Enter arena",
  },
};
let mode: PlayMode = "normal";
let entryMode: WalletMode = "normal";
let signedInWallet: string | null = null;
let signingIn = false;
let launching = false;
let walletError = "";
function updateTitle() {
  start.disabled = pvp.disabled = guest.disabled = launching;
  startLabel.textContent = signedInWallet
    ? walletModes.normal.play
    : walletModes.normal.title;
  if (!modeEntry.open) return;
  modeAction.disabled = signingIn;
  modeAction.textContent = signingIn
    ? "Connecting…"
    : signedInWallet
      ? walletModes[entryMode].play
      : "Connect wallet";
  modeStatus.textContent = signingIn
    ? "Approve the sign-in message in your wallet."
    : signedInWallet
      ? "Wallet connected."
      : walletError || "Connect a Solana wallet to continue.";
}
async function fetchProfile() {
  const response = await fetch("/api/profile");
  if (response.status === 401)
    throw Error(
      "Connect your wallet in Normal mode or PvP Arena to view your ranger profile.",
    );
  if (!response.ok) throw Error("The game server is unavailable.");
  return response.json() as Promise<Profile>;
}
async function restoreSession() {
  const previousWallet = signedInWallet;
  try {
    const response = await fetch("/api/session", {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return;
    const { wallet: address, unlockedRangers } = await response.json();
    if (!signingIn && signedInWallet === previousWallet) {
      signedInWallet = address;
      setWalletRoster(address, unlockedRangers);
      menuExplorer();
      updateTitle();
    }
  } catch {
    // Mode entry remains available after a network interruption.
  }
}
const sessionReady = restoreSession();
function openMode(playMode: WalletMode) {
  if (signedInWallet) {
    mode = playMode;
    void launch();
    return;
  }
  entryMode = playMode;
  walletError = "";
  modeTitle.textContent = walletModes[entryMode].title;
  modeDescription.textContent = walletModes[entryMode].description;
  modeEntry.showModal();
  updateTitle();
}
document.querySelector<HTMLButtonElement>("#mode-entry-close")!.onclick = () =>
  modeEntry.close();
modeAction.onclick = async () => {
  if (signingIn) return;
  if (signedInWallet) {
    mode = entryMode;
    modeEntry.close();
    void launch();
    return;
  }
  signingIn = true;
  updateTitle();
  try {
    const account = await signInWithWallet();
    signedInWallet = account.wallet;
    setWalletRoster(account.wallet, account.unlockedRangers);
    menuExplorer();
  } catch (error) {
    walletError =
      error instanceof Error ? error.message : "Wallet connection failed.";
  } finally {
    signingIn = false;
    updateTitle();
    if (modeEntry.open && !modeEntry.contains(document.activeElement))
      modeAction.focus({ preventScroll: true });
  }
};
function titleScreen(name: string) {
  titlePanel.querySelector("h2")!.textContent = name;
  const body = titlePanel.querySelector("#title-panel-content")!;
  body.replaceChildren();
  if (!titlePanel.open) titlePanel.showModal();
  return body;
}
document.querySelector<HTMLButtonElement>("#title-panel-close")!.onclick = () =>
  titlePanel.close();
document.querySelector<HTMLButtonElement>("#title-profile")!.onclick =
  async () => {
    const body = titleScreen("Ranger profile");
    body.textContent = "Loading profile…";
    try {
      const profile = await fetchProfile();
      const fields = [
        ["Wallet", profile.wallet ?? "Guest"],
        ["Beasts", String(profile.collection.length)],
        ["Arena wins", String(profile.wins)],
        ["Game WILD", String(profile.wild ?? 0)],
        ["Shards", String(profile.shards)],
        ["Capture orbs", String(profile.orbs)],
      ];
      const list = document.createElement("dl");
      for (const [key, value] of fields) {
        const label = document.createElement("dt"),
          detail = document.createElement("dd");
        label.textContent = key;
        detail.textContent = value;
        list.append(label, detail);
      }
      if (
        titlePanel.open &&
        titlePanel.querySelector("h2")!.textContent === "Ranger profile"
      ) {
        body.replaceChildren(list);
        if (profile.wallet)
          mountWalletBalances(body as HTMLElement, profile.wallet);
        mountUsernameEditor(body as HTMLElement, profile.name);
      }
    } catch (error) {
      body.textContent =
        error instanceof Error ? error.message : "Could not load profile.";
    }
  };
document.querySelector<HTMLButtonElement>("#title-settings")!.onclick = () => {
  const body = titleScreen("Settings");
  const label = document.createElement("label"),
    quality = document.createElement("select");
  label.textContent = "Graphics quality";
  for (const option of ["Low", "Medium", "High", "Ultra"])
    quality.add(new Option(option, option));
  quality.value =
    localStorage.getItem("quality") ??
    (matchMedia("(pointer: coarse)").matches ? "Low" : "High");
  quality.onchange = () => localStorage.setItem("quality", quality.value);
  label.append(quality);
  body.append(label);
};
function menuExplorer() {
  const index = selectedRanger();
  document.querySelector<HTMLImageElement>("#menu-ranger-portrait")!.src =
    "/ranger-portraits/" + index + ".webp";
  document.querySelector("#menu-ranger-name")!.textContent =
    rangerFor(index).name;
}
menuExplorer();
document
  .querySelector("#ranger-picker")!
  .addEventListener("close", menuExplorer);
const controls = document.querySelector<HTMLDialogElement>("#controls-dialog")!;
const sound = document.querySelector<HTMLButtonElement>("#menu-sound")!;
function soundLabel() {
  const muted = gameAudio.settings.muted;
  sound.setAttribute("aria-pressed", String(muted));
  sound.setAttribute(
    "aria-label",
    muted ? "Enable game audio" : "Mute game audio",
  );
  sound.querySelector("#sound-value")!.textContent = muted
    ? "Sound off"
    : "Sound on";
}
soundLabel();
sound.onclick = () => {
  gameAudio.setMuted(!gameAudio.settings.muted);
  void gameAudio.unlock();
  soundLabel();
};
document.querySelector<HTMLButtonElement>("#how-to")!.onclick = () =>
  controls.showModal();
document.querySelector<HTMLButtonElement>("#close-controls")!.onclick = () =>
  controls.close();

const loading = document.querySelector<HTMLElement>("#expedition-loading")!;
const stage = document.querySelector<HTMLElement>("#loading-stage")!;
const progress = loading.querySelector<HTMLElement>('[role="progressbar"]')!;
const fill = progress.querySelector<HTMLElement>("i")!;
const percent = document.querySelector<HTMLElement>("#loading-percent")!;
const retry = document.querySelector<HTMLButtonElement>("#retry-launch")!;
const cancel = document.querySelector<HTMLButtonElement>("#cancel-launch")!;
let generation = 0;
cancel.onclick = () => location.reload();

async function launch() {
  if (launching || (mode !== "guest" && (!signedInWallet || signingIn))) return;
  launching = true;
  updateTitle();
  const attempt = ++generation;
  void enterGameDisplay();
  void gameAudio.unlock();
  menu.inert = true;
  retry.hidden = true;
  cancel.hidden = true;
  loading.hidden = false;
  loading.classList.remove("failed");
  setExpeditionDisplay(true);
  function report(label: string, value: number) {
    if (attempt !== generation) return;
    if (stage.textContent !== label) stage.textContent = label;
    const rounded = Math.round(value);
    progress.setAttribute("aria-valuenow", String(rounded));
    fill.style.transform = "scaleX(" + value / 100 + ")";
    percent.textContent = rounded + "%";
  }
  const paint = () =>
    new Promise<void>((done) =>
      requestAnimationFrame(() => requestAnimationFrame(() => done())),
    );
  try {
    report("Opening field kit…", 0);
    await paint();
    const [{ loadWildlife }, { loadExplorer }, { preloadScenery }] =
      await Promise.all([
        import("./wildlife"),
        import("./voxelExplorer"),
        import("./scenery"),
      ]);
    if (mode !== "guest") {
      const current = await fetchProfile();
      signedInWallet = current.wallet ?? null;
      setWalletRoster(signedInWallet, current.unlockedRangers);
      menuExplorer();
    }
    await loadExplorer(
      chooseFieldRanger(mode === "guest" ? guestSessionId() : undefined),
    );
    report("Gathering wildlife…", 8);
    await loadWildlife((done, total) =>
      report("Gathering wildlife…", 8 + (30 * done) / total),
    );
    if (mode !== "pvp") {
      report("Preparing island scenery…", 38);
      await paint();
      await preloadScenery((done, total) =>
        report("Preparing island scenery…", 38 + (43 * done) / total),
      );
      report("Building the archipelago…", 81);
      await paint();
    }
    const game = await import("./game");
    const world = await import("./exploration");
    report(mode === "pvp" ? "Opening the arena…" : "Joining the island…", 87);
    await game.joinExpedition(mode);
    if (mode !== "pvp") {
      report("Rendering the trailhead…", 96);
      await paint();
      await world.prepareTrailhead();
    }
    report(mode === "pvp" ? "Arena ready" : "Expedition ready", 100);
    await paint();
    menu.hidden = true;
    loading.hidden = true;
    document.body.classList.remove("at-title");
    if (mode === "pvp") game.enterArena();
    else {
      world.startExploring();
      const canvas = document.querySelector<HTMLCanvasElement>("#world")!;
      canvas.tabIndex = -1;
      canvas.focus({ preventScroll: true });
    }
  } catch (error) {
    generation++;
    launching = false;
    updateTitle();
    setExpeditionDisplay(false);
    console.error("Expedition launch failed", error);
    loading.classList.add("failed");
    stage.textContent =
      error instanceof Error && error.message
        ? error.message
        : "Connection interrupted. Try again.";
    retry.hidden = false;
    cancel.hidden = false;
    retry.focus();
  }
}
start.onclick = () => openMode("normal");
pvp.onclick = () => openMode("pvp");
guest.onclick = () => {
  mode = "guest";
  void launch();
};
retry.onclick = () => void launch();
import "@fontsource/pixelify-sans/latin-400.css";
import "@fontsource/pixelify-sans/latin-700.css";
document.querySelector<HTMLButtonElement>("#choose-ranger")!.onclick =
  async () => {
    await sessionReady;
    await restoreSession();
    const { pickExplorer } = await import("./picker");
    pickExplorer();
  };
