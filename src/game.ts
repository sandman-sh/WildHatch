import { connectWorld } from "./worldConnection";
import { mountWalletBalances } from "./walletBalances";
import { battleSound, gameAudio } from "./audio";
import {
  enterGameDisplay,
  portraitGame,
  syncRotationPrompt,
} from "./displayMode";
import "./style.css";
import "./field.css";
import "./fieldControls.css";
import "./desktopField.css";
import { mountCreatureStage } from "./creatureStage";
import { mountUsernameEditor } from "./usernameEditor";
import { gameOnlyBeast } from "./importedBeasts";
import {
  fieldCapture,
  frameEncounter,
  configure,
  nearest,
  siteAction,
  freeze,
  quality,
  presence,
  relocate,
  setHabitats,
  removeWild,
  updateGuardian,
  showAtlas,
  ferryRoute,
  selectCompanion,
  setWorldIdentity,
  availableHabitats,
  trackedHabitat,
  trackHabitat,
  trackPlace,
} from "./exploration";
import type { BeastFigure } from "./models";
import {
  habitatAt,
  elements,
  rarities,
  beastStats,
  inheritedMutation,
} from "./shared";
import { selectedRanger, rangerFor } from "./rangers";
import type { Profile, Beast } from "./shared";
import type { PlayMode, WorldPlayer } from "./playMode";
const find = <E extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<E>(s)!;
const panel = find<HTMLDialogElement>("#panel"),
  content = find("#content");
let raid: {
  hp: number;
  max: number;
  health: number;
  players: number;
  damage: number;
  phase: string;
  respawn: number;
};
let tasks: {
  id: string;
  name: string;
  description: string;
  progress: number;
  target: number;
  claimed: boolean;
  reward: number;
}[] = [];
let market: { listings: any[]; history: any[] } = { listings: [], history: [] };
let listingId = "";
let castMethod: import("./fieldCapture").OrbType = "standard";
const guestViews = new Set(["map", "scan", "pack", "profile", "settings"]);
let nearbyRangers: WorldPlayer[] = [];
let nearbyLabel = "";
let mode: PlayMode = "normal";
let profile: Profile,
  connection: ReturnType<typeof connectWorld>,
  view = "",
  selection = "",
  offer: any = null,
  battle: any = null,
  queued = false,
  invitation: { code: string; expires: number } | null = null,
  timer = 0,
  previewStop = () => {};
const send = (type: string, data?: any) => {
  connection?.send(type, data);
};
configure(send);
for (const evt of ["pointerdown", "keydown"])
  addEventListener(evt, () => void gameAudio.unlock(), { once: true });
function notice(s: string) {
  const dest = find(panel.open ? "#panel-notice" : "#toast");
  dest.textContent = s;
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    find("#toast").textContent = "";
    find("#panel-notice").textContent = "";
  }, 3500);
}
const button = (
  text: string,
  fn: () => void,
  primary = false,
  parent = content,
) => {
  const b = document.createElement("button");
  b.className = primary ? "primary" : "secondary";
  b.textContent = text;
  b.onclick = () => {
    gameAudio.play("ui");
    fn();
  };
  parent.append(b);
  return b;
};
function line(tag: string, text: string, parent = content) {
  const e = document.createElement(tag);
  e.textContent = text;
  if (tag === "h2") e.id = "panel-title";
  parent.append(e);
  return e;
}
function renderNearbyRangers(list: HTMLElement) {
  list.replaceChildren();
  if (!nearbyRangers.length) line("p", "You are the only ranger here.", list);
  for (const peer of nearbyRangers)
    line(
      "p",
      peer.name + (peer.beast ? " · " + peer.beast.name : " · Guest"),
      list,
    );
}
function close() {
  if (mode === "pvp") {
    if (view !== "arena") display("arena");
    else if (battle) notice("Finish the duel to return to the main menu.");
    else location.reload();
    return;
  }
  panel.close();
}
panel.addEventListener("cancel", (event) => {
  if (mode === "pvp") event.preventDefault();
});
panel.onclose = () => {
  stopPreview();
  showAtlas();
  freeze(false);
  view = "";
  gameAudio.setMode("explore");
};
find("#close").onclick = close;
function stopPreview() {
  previewStop();
  previewStop = () => {};
}
function preview(beasts: BeastFigure[], action = "idle", parent = content) {
  previewStop = mountCreatureStage(
    parent,
    beasts,
    action,
    previousForm,
    battle?.lastMove,
  );
}
let order = "Species",
  stageFilter = "All stages";
let resultTitle = "",
  resultBeast: Beast | undefined,
  previousForm: Beast | undefined,
  duelResult = "";
function selectField(
  label: string,
  items: { label: string; value: string }[],
  value: string,
) {
  const field = document.createElement("label");
  field.className = "field-select";
  field.append(label);
  const select = document.createElement("select");
  select.setAttribute("aria-label", label);
  items.forEach((item) => select.add(new Option(item.label, item.value)));
  select.value = value;
  field.append(select);
  content.append(field);
  return select;
}
function choose(label: string, items: string[], value: string) {
  return selectField(
    label,
    items.map((value) => ({ label: value, value })),
    value,
  );
}
function meter(label: string, value: number, max: number) {
  const field = line("label", label + " · " + value + "/" + max);
  field.className = "stat-meter";
  const bar = document.createElement("progress");
  bar.max = max;
  bar.value = value;
  field.append(bar);
}
function rarityMark(beast: { rarity: string }) {
  const tag = line("span", beast.rarity);
  tag.className = "rarity-tag";
  tag.dataset.rarity = beast.rarity;
}
function inspect(b: Beast) {
  selection = b.id;
  display("detail");
}
function journal() {
  line("h2", "Field journal");
  line(
    "p",
    profile.collection.length +
      (profile.collection.length === 1 ? " beast · " : " beasts · ") +
      new Set(profile.collection.map((b) => b.name)).size +
      " of " +
      Object.keys(elements).length +
      " species",
  );
  const sort = choose(
    "Sort by",
    ["Species", "Rarity", "Element", "Level"],
    order,
  );
  sort.onchange = () => {
    order = sort.value;
    display("collection");
  };
  const stage = choose(
    "Evolution",
    ["All stages", "Base form", "Evolved"],
    stageFilter,
  );
  stage.onchange = () => {
    stageFilter = stage.value;
    display("collection");
  };
  const cards = document.createElement("div");
  cards.className = "beast-cards";
  content.append(cards);
  const beasts = profile.collection.filter(
    (b) =>
      stageFilter === "All stages" ||
      (stageFilter === "Base form" ? b.stage === 1 : b.stage > 1),
  );
  beasts.sort((a, b) =>
    order === "Rarity"
      ? rarities.indexOf(b.rarity) - rarities.indexOf(a.rarity)
      : order === "Level"
        ? b.level - a.level
        : order === "Element"
          ? elements[a.name].localeCompare(elements[b.name])
          : a.name.localeCompare(b.name),
  );
  for (const b of beasts) {
    const card = document.createElement("button");
    card.className = "beast-card";
    card.dataset.rarity = b.rarity;
    const img = document.createElement("img");
    img.src = "/beast-portraits/" + b.name + ".webp";
    img.alt = "";
    img.loading = "lazy";
    const title = document.createElement("strong");
    title.textContent = b.name;
    const meta = document.createElement("small");
    meta.textContent =
      b.rarity +
      " · Lv " +
      b.level +
      (b.id === profile.active ? " · Active" : "");
    card.append(img, title, meta);
    card.onclick = () => inspect(b);
    cards.append(card);
  }
  if (!beasts.length) line("p", "No beasts at this evolution stage.");
  if (profile.collection.length > 1)
    button("Compare beasts", () => display("compare"));
  button("Breeding lab", () => display("lab"));
}
type CapturePhase = "aim" | "casting" | "caught" | "escaped";
let phase: CapturePhase | null = null;
let waitingOffer = false,
  throwTimer = 0;
const field = find("#capture-hud");
const throwButton = find<HTMLButtonElement>("#throw-wild");
const studyButton = find<HTMLButtonElement>("#study-wild");
const leaveButton = find<HTMLButtonElement>("#leave-catch");
const orbButtons = [...field.querySelectorAll<HTMLButtonElement>("[data-orb]")];
let catchesBeast: Beast | undefined;
function leaveCapture() {
  clearTimeout(throwTimer);
  fieldCapture.stop();
  if (catchesBeast) removeWild(offer.index);
  field.hidden = true;
  document.body.classList.remove("in-encounter");
  phase = null;
  waitingOffer = false;
  catchesBeast = undefined;
  freeze(panel.open);
}
function requestOffer(index: number) {
  if (waitingOffer || !connection?.ready) return;
  waitingOffer = true;
  send("encounter", index);
  clearTimeout(throwTimer);
  throwTimer = window.setTimeout(() => {
    waitingOffer = false;
    notice("Move closer to the beast and try again.");
  }, 3500);
}
function renderCapture() {
  if (!phase) return;
  const aim = phase === "aim",
    busy = phase === "casting";
  const name = habitatAt(offer.index)![0],
    focus = castMethod === "focus";
  field.hidden = false;
  field.dataset.phase = phase;
  document.body.classList.toggle("in-encounter", phase !== "caught");
  find("#quarry-name").textContent = name;
  find("#quarry-trait").textContent = [
    elements[name],
    offer.rarity,
    offer.personality,
  ].join(" · ");
  find("#cast-chance").textContent =
    (focus ? offer.focusChance : offer.chance) + "%";
  find("#cast-chance").hidden = !aim;
  find("#cast-status").textContent = busy
    ? "Casting…"
    : phase === "caught"
      ? mode === "guest"
        ? "Practice catch complete"
        : name + " caught!"
      : phase === "escaped"
        ? name + " broke free"
        : profile.orbs + " orbs";
  for (const button of orbButtons) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.orb === castMethod),
    );
    button.disabled =
      !aim || profile.orbs < (button.dataset.orb === "focus" ? 2 : 1);
  }
  studyButton.hidden = !aim;
  studyButton.disabled = !!offer.studied;
  studyButton.querySelector("span")!.textContent = offer.studied
    ? "Studied"
    : "Study";
  throwButton.querySelector("span")!.textContent = busy
    ? "Casting"
    : phase === "caught"
      ? mode === "guest"
        ? "Continue"
        : "Journal"
      : !profile.orbs
        ? "Supplies"
        : phase === "escaped"
          ? "Retry"
          : "Throw";
  throwButton
    .querySelector("use")!
    .setAttribute(
      "href",
      phase === "caught"
        ? mode === "guest"
          ? "#icon-exit"
          : "#icon-book"
        : !profile.orbs
          ? "#icon-pack"
          : "#icon-catch",
    );
  throwButton.disabled =
    busy || (aim && profile.orbs > 0 && profile.orbs < (focus ? 2 : 1));
  leaveButton.disabled = busy;
}
function actOnCapture() {
  if (!phase || phase === "casting" || throwButton.disabled) return;
  if (phase === "caught" && mode === "guest") {
    leaveCapture();
    return;
  }
  if (phase === "caught" && catchesBeast) {
    const beast = catchesBeast;
    leaveCapture();
    inspect(beast);
    return;
  }
  if (!profile.orbs) {
    leaveCapture();
    display("pack");
    return;
  }
  if (phase === "escaped") {
    requestOffer(offer.index);
    return;
  }
  if (!connection?.ready) {
    leaveCapture();
    notice("Connection lost.");
    return;
  }
  phase = "casting";
  renderCapture();
  fieldCapture.launch(castMethod);
  send("capture", castMethod);
  throwTimer = window.setTimeout(() => {
    leaveCapture();
    notice("No response from the island. Try again.");
  }, 8000);
}
function resolveThrow(result: string, data: any) {
  if (phase !== "casting") {
    if (result === "caught" && !data.practice) removeWild(data.index);
    return;
  }
  clearTimeout(throwTimer);
  if (result === "captureUnavailable") {
    leaveCapture();
    notice(data);
    return;
  }
  const outcome = result === "caught" ? "caught" : "escaped";
  if (outcome === "caught" && !data.practice) catchesBeast = data.beast;
  fieldCapture.resolve(outcome, () => {
    if (outcome === "caught") {
      if (!data.practice) removeWild(data.index);
      gameAudio.play(
        rarities.indexOf(data.beast.rarity) >= 2 ? "rare" : "capture",
      );
    } else {
      frameEncounter(offer.index);
      gameAudio.play("escape");
    }
    phase = outcome;
    renderCapture();
    if (outcome === "caught") {
      freeze(false);
      find("#interact").focus({ preventScroll: true });
      throwTimer = window.setTimeout(leaveCapture, 5500);
    } else throwButton.focus({ preventScroll: true });
  });
}
throwButton.onclick = actOnCapture;
leaveButton.onclick = () => {
  if (phase !== "casting") {
    leaveCapture();
    find("#interact").focus({ preventScroll: true });
  }
};
studyButton.onclick = () => {
  if (phase === "aim" && !offer.studied) send("study");
};
for (const button of orbButtons)
  button.onclick = () => {
    if (phase !== "aim") return;
    castMethod = button.dataset.orb === "focus" ? "focus" : "standard";
    fieldCapture.color(castMethod);
    gameAudio.play("ui");
    renderCapture();
  };
function display(key: string, collectibleMint?: string) {
  if (!profile) {
    notice("Connecting to the game server");
    return;
  }
  if (mode === "guest" && !guestViews.has(key)) {
    notice("Sign in from the main menu to unlock this feature.");
    return;
  }
  if (phase || waitingOffer) {
    if (phase === "casting" && key !== "arena") return;
    leaveCapture();
  }
  stopPreview();
  showAtlas();
  view = key;
  panel.dataset.view = key;
  find<HTMLButtonElement>("#close").hidden =
    mode === "pvp" && key === "arena" && !!battle;
  find("#panel-notice").textContent = "";
  gameAudio.setMode(
    key === "boss" ? "boss" : key === "arena" && battle ? "battle" : "explore",
  );
  content.replaceChildren();
  if (!panel.open) {
    panel.showModal();
    syncRotationPrompt(true);
  }
  freeze(key !== "map");
  if (key === "pack" && mode === "guest") {
    line("h2", "Practice orbs");
    line("p", profile.orbs + " of 3 Jade orbs remaining for this visit.");
    line(
      "p",
      "Try a throw at a wild beast. Practice catches release the beast and award no items or progress.",
    );
    button("Continue exploring", close, true);
    return;
  }
  if (key === "map") {
    line("h2", "Island atlas");
    const c = document.createElement("canvas");
    c.width = c.height = 400;
    c.className = "maplarge";
    c.setAttribute("role", "img");
    c.setAttribute(
      "aria-label",
      "Live island atlas with your position marked in gold",
    );
    content.append(c);
    line(
      "p",
      "Gold marks your position and heading. Squares mark wild habitats.",
    );
    const ferryButton = button("Track ferry camp", () => {
      const ferry = ferryRoute();
      if (ferry.ready) send("ferry");
      else {
        trackPlace(["Ferry camp", ferry.x, ferry.z]);
        close();
      }
    });
    const updateFerry = () => {
      const ferry = ferryRoute();
      const label = ferry.ready ? ferry.label : "Track ferry camp";
      if (ferryButton.textContent !== label) ferryButton.textContent = label;
    };
    updateFerry();
    showAtlas(c, updateFerry);
  }
  if (key === "collection") journal();
  if (key === "compare") {
    line("h2", "Compare beasts");
    const options = profile.collection.map((b) => ({
      label: b.name + " · Lv " + b.level + " · " + b.variant.toString(16),
      value: b.id,
    }));
    const first = selectField("First beast", options, options[0].value);
    const second = selectField("Second beast", options, options[1].value);
    const table = document.createElement("table");
    table.className = "compare-stats";
    content.append(table);
    function compare() {
      table.replaceChildren();
      const pair = [first, second].map((s) =>
        profile.collection.find((b) => b.id === s.value)!,
      );
      for (const [label, values] of [
        ["", pair.map((b) => b.name)],
        ["Element", pair.map((b) => elements[b.name])],
        ...(["health", "attack", "defense", "speed"] as const).map((k) => [
          k,
          pair.map((b) => beastStats(b)[k]),
        ]),
      ] as [string, (string | number)[]][]) {
        const row = table.insertRow();
        for (const val of [label, ...values])
          row.insertCell().textContent = String(val);
      }
    }
    first.onchange = second.onchange = compare;
    compare();
    button("Field journal", () => display("collection"));
  }
  if (key === "profile") {
    const username = line("h2", profile.name);
    const portrait = document.createElement("img");
    portrait.src = "/ranger-portraits/" + selectedRanger() + ".webp";
    portrait.className = "ranger-portrait";
    portrait.alt = rangerFor(selectedRanger()).name;
    content.append(portrait);
    if (mode === "guest") {
      line("p", "Guest visit · " + profile.orbs + " practice orbs remaining");
    } else {
      mountUsernameEditor(content, profile.name, (name) => {
        username.textContent = name;
      });
      const xp = profile.rangerXp ?? 0;
      line(
        "p",
        rangerFor(selectedRanger()).name +
          " · Ranger level " +
          (1 + Math.floor(xp / 50)),
      );
      meter("Next ranger level", xp % 50, 50);
      line(
        "p",
        profile.collection.length + " beasts · " + profile.wins + " arena wins",
      );
      line(
        "p",
        `${profile.wild ?? 0} Game WILD · ${profile.shards} shards · ${profile.orbs} capture orbs`,
      );
      if (profile.wallet) {
        line("p", "Linked wallet · " + profile.wallet).classList.add(
          "wallet-address",
        );
        mountWalletBalances(content, profile.wallet);
        button("Wallet collectibles", () => display("owned-collectibles"));
      }
    }
    if (mode !== "pvp") {
      line("h3", "On this island");
      const list = line("div", "");
      list.id = "nearby-rangers";
      renderNearbyRangers(list);
    }
    if (mode !== "guest") button("Field missions", () => send("missions"));
    button("Settings", () => display("settings"));
  }
  if (key === "scan") {
    line("h2", "Habitat scanner");
    line(
      "p",
      "Track a signal on your atlas and approach within 7 m to catch the beast.",
    );
    for (const h of availableHabitats())
      button(
        h.name + " · " + elements[h.name] + " · " + h.distance + " m",
        () => {
          trackHabitat(h.i);
          close();
        },
      );
    if (trackedHabitat >= 0)
      button("Clear tracking", () => {
        trackHabitat(-1);
        close();
      });
  }
  if (key === "map") button("Track a habitat", () => display("scan"));
  if (key === "lab") {
    line("h2", "Breeding lab");
    line(
      "p",
      "Choose two parents. The offspring inherits the first parent’s species and upper pigment byte, and the second parent’s temperament and lower pigment byte. Each parent can breed three times with a 24-hour cooldown.",
    );
    const options = profile.collection.filter(
      (b) => (b.offspring || 0) < 3 && (b.breedAfter || 0) <= Date.now(),
    );
    const picks = ["First parent", "Second parent"].map((label, i) => {
      line("h3", label);
      const s = document.createElement("select");
      s.setAttribute("aria-label", label);
      for (const b of options)
        s.add(new Option(b.name + " · " + b.variant.toString(16), b.id));
      s.selectedIndex = Math.min(i, options.length - 1);
      content.append(s);
      return s;
    });
    const hatch = button(
      "Breed · 2 shards",
      () =>
        send(
          "breed",
          picks.map((s) => s.value),
        ),
      true,
    );
    const forecast = line("p", "");
    const update = () => {
      const [a, b] = picks.map((s) => options.find((b) => b.id === s.value));
      hatch.disabled = !a || !b || a.id === b.id || profile.shards < 2;
      forecast.textContent =
        a && b && a.id !== b.id
          ? "Hatch forecast · " +
            a.name +
            " · " +
            b.personality +
            " · " +
            (inheritedMutation(a.name, b.name) ?? "Standard lineage")
          : "Select two different eligible parents.";
    };
    picks.forEach((s) => (s.onchange = update));
    update();
    line(
      "p",
      options.length +
        " eligible parents · " +
        profile.shards +
        " shards available",
    );
  }
  if (key === "detail") {
    const b = profile.collection.find((c) => c.id === selection)!;
    if (!b) {
      display("collection");
      return;
    }
    line("h2", b.name);
    rarityMark(b);
    const sheet = line("div", "");
    sheet.className = "beast-sheet";
    const figure = line("div", "", sheet),
      record = line("div", "", sheet);
    preview([b], "idle", figure);
    line(
      "p",
      elements[b.name] + " · Level " + b.level + " · Stage " + b.stage,
      figure,
    );
    line("h3", "Genetic record", record);
    line(
      "p",
      b.personality +
        " · Pigment " +
        b.variant.toString(16).padStart(4, "0").toUpperCase() +
        " · " +
        b.xp +
        " XP",
      record,
    );
    line(
      "p",
      ["Amber", "Cyan", "Violet", "Green"][(b.variant >>> 3) % 4] +
        " eyes · " +
        ["Natural", "Warm", "Cool", "Golden", "Deep"][b.variant % 5] +
        " coat",
      record,
    );
    const stats = beastStats(b);
    const attributes = line("dl", "", record);
    attributes.className = "beast-attributes";
    for (const [label, value] of Object.entries({
      HP: stats.health,
      Attack: stats.attack,
      Defense: stats.defense,
      Speed: stats.speed,
    })) {
      const stat = line("div", "", attributes);
      line("dt", label, stat);
      line("dd", String(value), stat);
    }
    line("p", "Moves · Strike, Pulse, Guard, Scorch", record);
    if (b.mutation) line("p", "Inherited mutation · " + b.mutation, record);
    line(
      "p",
      "Owned by " + profile.name + " · " + b.history.join(" / "),
      record,
    );
    const marking = choose(
      "Crest color",
      ["None", "Amber", "Jade", "Violet"],
      b.marking ?? "None",
    );
    marking.onchange = () =>
      send("marking", { id: b.id, marking: marking.value });
    figure.append(marking.closest("label")!);
    const actions = line("div", "");
    actions.className = "beast-actions";
    button(
      b.id === profile.active ? "Active companion" : "Set active",
      () => send("active", b.id),
      false,
      actions,
    ).disabled = b.id === profile.active;
    button(
      "Train · 1 shard",
      () => send("train", b.id),
      false,
      actions,
    ).disabled = profile.shards < 1;
    if (b.stage === 1)
      button(
        "Evolve · Lv 3",
        () => send("evolve", b.id),
        true,
        actions,
      ).disabled = b.level < 3;
    button("Field journal", () => display("collection"), false, actions);
    if (gameOnlyBeast(b.name)) {
      line("small", "In-game collectible", actions);
    } else if (profile.wallet) {
      const address = profile.wallet;
      const claim = button(
        "Mint Devnet collectible",
        async () => {
          claim.disabled = true;
          try {
            const { mintBeast, ownsCollectible } = await import("./devnet");
            const mint = await mintBeast(address, b.id);
            const owned = await ownsCollectible(address, mint);
            if (!claim.isConnected) return;
            const link = document.createElement("a");
            link.href =
              "https://explorer.solana.com/address/" + mint + "?cluster=devnet";
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = "View Devnet collectible";
            claim.replaceWith(link);
            if (owned) {
              notice("Verified in your Devnet wallet collection.");
              button(
                "List collectible for SOL",
                () => display("escrow", mint),
                true,
                actions,
              );
              button(
                "Wallet collectibles",
                () => display("owned-collectibles"),
                false,
                actions,
              );
            } else {
              notice(
                "This collectible was already minted. Your wallet does not currently hold it.",
              );
            }
          } catch (error) {
            notice(
              error instanceof Error
                ? error.message
                : "Collectible mint failed.",
            );
          } finally {
            claim.disabled = false;
          }
        },
        false,
        actions,
      );
    }
  }
  if (key === "pack") {
    line("h2", "Expedition pack");
    line(
      "p",
      profile.orbs + " capture orbs · " + profile.shards + " training shards",
    );
    line(
      "p",
      "Refill at the trailhead or a frontier camp. Each arena victory earns three training shards.",
    );
    button("Refill orbs", () => send("supply"), true).disabled =
      profile.orbs >= 8;
    button("Wild shop", () => display("shop"));
    const camp = ferryRoute();
    button(camp.frontier ? "Track frontier camp" : "Track trailhead", () => {
      trackPlace([
        camp.frontier ? "Frontier camp" : "Trailhead",
        camp.x,
        camp.z,
      ]);
      close();
    });
  }
  if (key === "shop") {
    line("h2", "Wild shop");
    line("p", (profile.wild ?? 0) + " game WILD available");
    line(
      "p",
      "Win an arena duel by knockout to earn 12 WILD for the shop and trading post.",
    );
    button("4 capture orbs · 4 WILD", () => send("buyOrbs"), true).disabled =
      (profile.wild ?? 0) < 4 || profile.orbs > 95;
    line("h3", "Mystery boxes");
    line("p", "Trail box · 70% for 3 orbs and 1 shard, 30% for 4 shards.");
    button("Trail box · 6 WILD", () => send("openCache", "trail")).disabled =
      (profile.wild ?? 0) < 6 || profile.orbs > 95;
    line("p", "Prism box · 75% for 4 orbs and 3 shards, 25% for 8 shards.");
    button("Prism box · 12 WILD", () => send("openCache", "prism")).disabled =
      (profile.wild ?? 0) < 12 || profile.orbs > 95;
    button("Devnet WILD shop", () => display("devnet-shop"));
  }
  if (
    key === "ranked" ||
    key === "escrow" ||
    key === "devnet-shop" ||
    key === "owned-collectibles"
  ) {
    line(
      "h2",
      key === "ranked"
        ? "Devnet PvP"
        : key === "escrow"
          ? "Devnet escrow"
          : key === "owned-collectibles"
            ? "Wallet collectibles"
            : "Devnet WILD shop",
    );
    const address = profile.wallet;
    if (address) {
      const mount = line("div", "");
      void import("./devnetView")
        .then(({ mountDevnetView }) => {
          if (mount.isConnected && view === key)
            previewStop = mountDevnetView(
              mount,
              address,
              key,
              collectibleMint,
              (mint) => display("escrow", mint),
            );
        })
        .catch(() => notice("Devnet controls could not load."));
    } else {
      line("p", "Sign in with a Solana browser wallet to use Devnet.");
      button("Wallet settings", () => display("settings"));
    }
    if (key === "ranked") button("Battle arena", () => display("arena"));
    else if (key === "escrow") {
      button("Wallet collectibles", () => display("owned-collectibles"));
      button("Trading post", () => send("market"));
    } else if (key === "owned-collectibles") {
      button("Devnet escrow", () => display("escrow"));
      button("Profile", () => display("profile"));
    } else button("Wild shop", () => display("shop"));
  }
  if (key === "missions") {
    line("h2", "Field missions");
    for (const task of tasks) {
      line("h3", task.name);
      meter(task.description, task.progress, task.target);
      button(
        task.claimed ? "Reward claimed" : "Claim " + task.reward + " shards",
        () => send("claim", task.id),
      ).disabled = task.claimed || task.progress < task.target;
    }
  }
  if (key === "pack") button("Field missions", () => send("missions"));
  if (key === "pack") button("Trading post", () => send("market"));
  if (key === "market") {
    line("h2", "Trading post");
    button("Devnet escrow", () => display("escrow"));
    button("Wallet collectibles", () => display("owned-collectibles"));
    line(
      "p",
      profile.shards +
        " shards · " +
        (profile.wild ?? 0) +
        " game WILD. Listed reserve beasts are locked until sold or withdrawn.",
    );
    line("h3", "Open listings");
    if (!market.listings.length) line("p", "No creatures listed yet.");
    for (const l of market.listings) {
      line(
        "p",
        l.beast.name +
          " · " +
          l.beast.rarity +
          " · " +
          l.seller +
          " · " +
          l.price +
          " " +
          l.currency,
      );
      button("Inspect " + l.beast.name, () => {
        listingId = l.id;
        display("listing");
      });
    }
    const reserve = profile.collection.filter(
      (b) =>
        b.id !== profile.active &&
        !market.listings.some((l) => l.beast.id === b.id),
    );
    if (reserve.length) {
      line("h3", "List a reserve beast");
      const s = document.createElement("select");
      s.setAttribute("aria-label", "Reserve beast");
      for (const b of reserve)
        s.add(new Option(b.name + " · Lv " + b.level, b.id));
      content.append(s);
      const price = document.createElement("input");
      price.type = "number";
      price.min = "1";
      price.max = "999";
      price.value = "2";
      price.setAttribute("aria-label", "Listing price");
      content.append(price);
      const currency = choose("Currency", ["shards", "WILD"], "shards");
      button(
        "Create listing",
        () =>
          send("list", {
            beast: s.value,
            price: Number(price.value),
            currency: currency.value,
          }),
        true,
      );
    }
    line("h3", "Recent sales");
    if (!market.history.length) line("p", "No completed trades yet.");
    for (const sale of market.history)
      line(
        "p",
        sale.species +
          " · " +
          sale.price +
          " " +
          sale.currency +
          " · " +
          new Date(sale.sold_at).toLocaleDateString(),
      );
  }
  if (key === "listing") {
    const listing = market.listings.find((l) => l.id === listingId);
    if (!listing) {
      display("market");
      notice("This listing has closed.");
      return;
    }
    const b = listing.beast;
    const balance =
      listing.currency === "WILD" ? (profile.wild ?? 0) : profile.shards;
    line("h2", b.name);
    rarityMark(b);
    preview([b]);
    line(
      "p",
      elements[b.name] +
        " · Lv " +
        b.level +
        " · Stage " +
        b.stage +
        " · " +
        b.personality,
    );
    line(
      "p",
      "Seller " +
        listing.seller +
        " · Price " +
        listing.price +
        " " +
        listing.currency +
        " · Your balance " +
        balance,
    );
    button(
      listing.mine
        ? "Withdraw listing"
        : "Buy for " + listing.price + " " + listing.currency,
      () => send(listing.mine ? "unlist" : "buy", listing.id),
      true,
    ).disabled = !listing.mine && balance < listing.price;
    button("Trading post", () => send("market"));
  }
  if (key === "settings") {
    line("h2", "Field settings");
    if (document.fullscreenEnabled && !document.fullscreenElement)
      button("Enter fullscreen", () => void enterGameDisplay());
    const credits = document.createElement("a");
    credits.href = "/scenery-credits.html";
    credits.target = "_blank";
    credits.rel = "noopener";
    credits.textContent = "Scenery credits";
    content.append(credits);
    line("p", "Rendering quality");
    const s = document.createElement("select");
    for (const q of ["Low", "Medium", "High", "Ultra"]) s.add(new Option(q, q));
    s.value =
      localStorage.getItem("quality") ||
      (matchMedia("(pointer: coarse)").matches ? "Low" : "High");
    s.onchange = () => {
      localStorage.setItem("quality", s.value);
      quality(s.value);
    };
    content.append(s);
    line("h3", "Audio");
    for (const channel of ["music", "ambience", "effects"] as const) {
      const label = document.createElement("label");
      label.className = "row";
      label.textContent = channel[0].toUpperCase() + channel.slice(1);
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = "100";
      slider.value = String(gameAudio.settings[channel] * 100);
      slider.oninput = () =>
        gameAudio.setVolume(channel, Number(slider.value) / 100);
      label.append(slider);
      content.append(label);
    }
    button(gameAudio.settings.muted ? "Unmute" : "Mute", () => {
      gameAudio.setMuted(!gameAudio.settings.muted);
      display("settings");
    });
    if (!battle && !queued) button("Return to title", () => location.reload());
    if (profile.wallet) {
      line("h3", "Wallet");
      line("p", profile.wallet);
    }
    line("h3", "Controls");
    line(
      "p",
      "WASD or arrows to move, Shift to run, Space to jump. Drag to orbit and scroll to zoom.",
    );
  }
  if (key === "boss") {
    line("h2", "Green Dragon of the Sanctuary");
    preview(
      [{ name: "Green Dragon" }],
      raid.hp === 0 ? "hit" : raid.phase === "Enraged" ? "attack" : "idle",
    );
    meter(raid.phase, raid.hp, raid.max);
    line(
      "p",
      "Your health " +
        raid.health +
        " · Your damage " +
        raid.damage +
        " · " +
        raid.players +
        " participating",
    );
    if (raid.hp > 0 && raid.health > 0)
      button("Strike dragon", () => send("bossStrike"), true);
    else
      line(
        "p",
        raid.hp === 0
          ? "The dragon fell. Contributors earned five shards."
          : "Your beast is exhausted. Fellow rangers can finish the raid.",
      );
  }
  if (key === "arena") {
    if (battle) {
      const d = battle;
      line("h2", "Arena duel");
      line("p", d.players.join("  vs  "));
      preview(d.names, "duel");
      const vitals = document.createElement("div");
      vitals.className = "duel-vitals";
      content.append(vitals);
      d.names.forEach((b: Beast, i: number) => {
        const label = document.createElement("strong");
        label.textContent =
          b.name +
          (i === d.you ? " · You" : " · Opponent") +
          " · " +
          d.hp[i] +
          "/" +
          d.max[i];
        vitals.append(label);
        const hp = document.createElement("progress");
        hp.max = d.max[i];
        hp.value = d.hp[i];
        hp.setAttribute("aria-label", b.name + " health");
        vitals.append(hp);
        if (d.guard?.[i] || d.burn?.[i]) {
          const status = document.createElement("small");
          status.textContent = [
            d.guard[i] ? "Guarding" : "",
            d.burn[i] ? "Burn · " + d.burn[i] + " turns" : "",
          ]
            .filter(Boolean)
            .join(" · ");
          vitals.append(status);
        }
      });
      const turn = line(
        "h3",
        d.turn === d.you ? "Your turn" : "Opponent’s turn",
      );
      const clock = document.createElement("span");
      clock.className = "duel-clock";
      turn.append(clock);
      const tick = () => {
        clock.textContent =
          " · " + Math.max(0, Math.ceil((d.expires - Date.now()) / 1000)) + "s";
      };
      tick();
      const interval = window.setInterval(tick, 1000),
        dispose = previewStop;
      previewStop = () => {
        clearInterval(interval);
        dispose();
      };
      const actions = document.createElement("div");
      actions.className = "duel-commands";
      content.append(actions);
      if (d.turn === d.you) {
        const moves = {
          Strike: "Steady hit",
          Pulse: "Element bonus",
          Guard: "Halve next hit",
          Scorch: "Burn 2 turns",
        };
        for (const [name, hint] of Object.entries(moves)) {
          const control = button(name, () => {
            for (const sibling of actions.querySelectorAll("button"))
              sibling.disabled = true;
            send("attack", name);
          });
          control.setAttribute("aria-label", name);
          const detail = document.createElement("small");
          detail.textContent = hint;
          control.append(detail);
          actions.append(control);
        }
      }
      const log = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = d.log.at(-1);
      log.append(summary);
      for (const entry of d.log.slice(0, -1)) {
        const item = document.createElement("p");
        item.textContent = entry;
        log.append(item);
      }
      content.append(log);
    } else {
      line("h2", "Battle arena");
      button("Devnet PvP · MagicBlock", () => display("ranked"));
      line("p", "Bring your active beast into a one-on-one, turn-based duel.");
      line("strong", profile.wins + " victories");
      if (mode === "pvp") {
        const links = line("div", "");
        links.className = "arena-links";
        button("Wild shop", () => display("shop"), false, links);
        button("Profile", () => display("profile"), false, links);
        button("Settings", () => display("settings"), false, links);
        button("Main menu", () => location.reload(), false, links);
      } else if (siteAction() === "boss")
        button("Challenge the Green Dragon", () => send("boss"));
      else
        button("Track dragon sanctuary", () => {
          trackPlace(["Dragon sanctuary", -6, -21]);
          close();
        });
      button(
        queued ? "Cancel matchmaking" : "Find opponent",
        () => send("queue"),
        true,
      );
      if (queued) line("p", "Searching for another ranger…");
      line("h3", "Private duel");
      if (invitation && invitation.expires > Date.now()) {
        const code = line("p", invitation.code);
        code.className = "invite-code";
        button("Copy invite", () =>
          navigator.clipboard
            .writeText(invitation!.code)
            .then(() => notice("Code copied."))
            .catch(() => notice("Select the code to copy it.")),
        );
        button("Cancel invite", () => send("inviteCancel"));
      } else button("Invite player", () => send("inviteCreate"));
      const join = document.createElement("form");
      join.className = "invite-join";
      const code = document.createElement("input");
      code.placeholder = "Invite code";
      code.setAttribute("aria-label", "Invite code");
      code.maxLength = 10;
      code.required = true;
      const submit = document.createElement("button");
      submit.className = "secondary";
      submit.textContent = "Join";
      join.append(code, submit);
      join.onsubmit = (event) => {
        event.preventDefault();
        send("inviteJoin", code.value);
      };
      content.append(join);
    }
  }
  if (key === "growth" && resultBeast) {
    line("h2", resultTitle);
    rarityMark(resultBeast);
    preview(
      [resultBeast],
      resultTitle === "Evolution complete"
        ? "evolve"
        : resultTitle === "A new hatchling"
          ? "hatch"
          : "victory",
    );
    line(
      "p",
      resultBeast.name +
        " · Lv " +
        resultBeast.level +
        " · Stage " +
        resultBeast.stage +
        " · " +
        (resultBeast.mutation ?? resultBeast.personality),
    );
    button("Inspect beast", () => inspect(resultBeast!), true);
    button("Back to the trail", close);
  }
  if (key === "duel-result") {
    line("h2", duelResult);
    if (resultBeast)
      preview(
        [resultBeast],
        duelResult.startsWith("Victory") ? "victory" : "hit",
      );
    button("Battle arena", () => display("arena"), true);
    if (mode === "pvp") button("Main menu", () => location.reload());
    else button("Back to the trail", close);
  }
}
export function enterArena() {
  display("arena");
}
document
  .querySelectorAll<HTMLButtonElement>("[data-open]")
  .forEach((button) => {
    if (button.closest(".kit-content")) {
      const icons: Record<string, [string, string]> = {
        collection: ["book", "Journal"],
        pack: ["pack", "Pack"],
        missions: ["missions", "Missions"],
        lab: ["egg", "Hatchery"],
        market: ["trade", "Trade"],
        map: ["map", "Atlas"],
        profile: ["profile", "Ranger"],
        arena: ["raid", "Arena"],
        settings: ["settings", "Settings"],
        shop: ["pack", "Wild shop"],
      };
      const [icon, label] = icons[button.dataset.open!];
      button.title = button.textContent!.trim();
      button.innerHTML =
        '<svg class="hud-icon" aria-hidden="true"><use href="#icon-' +
        icon +
        '"/></svg><span>' +
        label +
        "</span>";
    }
    button.onclick = () => {
      const kit = button.closest("details");
      if (kit) kit.open = false;
      if (["missions", "market"].includes(button.dataset.open!))
        send(button.dataset.open!);
      else display(button.dataset.open!);
    };
  });
find("#active-shortcut").onclick = () =>
  inspect(profile.collection.find((b) => b.id === profile.active)!);
find("#missions").onclick = () => send("missions");
const interact = () => {
  if (!profile || mode === "pvp") return;
  if (phase === "caught") leaveCapture();
  const site = siteAction();
  if (site) {
    send(site);
    return;
  }
  if (nearest >= 0) requestOffer(nearest);
  else display("scan");
};
find("#interact").onclick = interact;
addEventListener("keydown", (e) => {
  if (
    document.body.classList.contains("at-title") ||
    portraitGame.matches ||
    e.repeat ||
    e.ctrlKey ||
    e.metaKey ||
    panel.open
  )
    return;
  const k = e.key.toLowerCase();
  if (phase && phase !== "caught") {
    if (k === "escape" && phase !== "casting") leaveCapture();
    if (k === "e") {
      e.preventDefault();
      actOnCapture();
    }
    return;
  }
  if (phase === "caught" && k === "escape") leaveCapture();
  const menus: Record<string, string> = {
    c: "collection",
    i: "pack",
    m: "map",
    b: "arena",
  };
  if (menus[k]) display(menus[k]);
  if (k === "e") interact();
});
function hud() {
  find<HTMLImageElement>("#ranger-headshot").src =
    "/ranger-portraits/" + selectedRanger() + ".webp";
  const companion = profile.collection.find((b) => b.id === profile.active);
  setWorldIdentity(profile.name, mode === "guest");
  selectCompanion(companion);
  if (companion) {
    find<HTMLImageElement>("#active-portrait").src =
      "/beast-portraits/" + companion.name + ".webp";
    find("#active-label").textContent =
      companion.name + " · Lv " + companion.level;
  }
  find("#orb-count").textContent = String(profile.orbs);
  find("#shard-count").textContent = String(profile.shards);
  find("#ranger").textContent =
    mode === "guest"
      ? profile.name
      : profile.name +
        " · Lv " +
        (1 + Math.floor((profile.rangerXp ?? 0) / 50));
  find("#ranger-level span").textContent = find("#ranger").textContent;
  find<HTMLProgressElement>("#ranger-level progress").value =
    (profile.rangerXp ?? 0) % 50;
  if (mode === "guest") {
    find("#objective").textContent = "Practice catching";
    find("#questText").textContent = profile.orbs
      ? "Try a Jade orb on a wild beast."
      : "All orbs used. Keep exploring with other rangers.";
    return;
  }
  if (profile.collection.length > 1) {
    find("#objective").textContent = "Genetic fieldwork";
    find("#questText").textContent =
      "Inspect your catch and train a beast to level 3.";
  } else {
    find("#objective").textContent = "First encounter";
    find("#questText").textContent = "Approach a wild beast along the trail.";
  }
  if (profile.collection.some((b) => b.stage > 1)) {
    find("#objective").textContent = "Sanctuary expedition";
    find("#questText").textContent =
      "Find the ruined arch at X −6, Z −21 to challenge the dragon.";
  }
}
let sessionReady = false;
export async function joinExpedition(playMode = mode) {
  if (sessionReady && connection?.ready) return;
  mode = playMode;
  document.body.classList.toggle("guest-mode", mode === "guest");
  document.body.classList.toggle("pvp-mode", mode === "pvp");
  find("#field-mode-label").textContent =
    mode === "guest" ? "GUEST MODE" : "WILDHATCH";
  find('.field-belt [data-open="pack"]').setAttribute(
    "aria-label",
    mode === "guest" ? "Open practice orbs" : "Open supplies",
  );
  connection = connectWorld(
    mode,
    ({ type, data }) => {
      switch (type) {
        case "boss":
          if (raid && view === "boss" && data.hp < raid.hp)
            gameAudio.play(data.hp ? "strike" : "victory");
          raid = data;
          updateGuardian(raid.respawn);
          display("boss");
          break;
        case "bossUpdate":
          if (view === "boss" && raid && data.hp < raid.hp)
            gameAudio.play(data.hp ? "strike" : "victory");
          raid = data;
          updateGuardian(raid.respawn);
          if (view === "boss") display("boss");
          break;
        case "missions": {
          const reward = (data as typeof tasks).find(
            (task) =>
              task.claimed &&
              tasks.some(
                (previous) => previous.id === task.id && !previous.claimed,
              ),
          );
          tasks = data;
          display("missions");
          if (reward) {
            gameAudio.play("resource");
            notice(reward.name + " complete · +" + reward.reward + " shards");
          }
          break;
        }
        case "habitats":
          if (mode !== "pvp") setHabitats(data);
          sessionReady = true;
          break;
        case "market":
          market = data;
          display("market");
          break;
        case "marketChanged":
          if (view === "market") send("market");
          break;
        case "joined":
          relocate(0, 0);
          find("#online").textContent =
            mode === "pvp" ? "Arena online" : "Island online";
          break;
        case "presence": {
          nearbyRangers = data;
          if (view === "profile") {
            const labels = nearbyRangers
              .map((p) => [p.id, p.name, p.beast?.name])
              .join("|");
            if (nearbyLabel !== labels) {
              nearbyLabel = labels;
              const list =
                content.querySelector<HTMLElement>("#nearby-rangers");
              if (list) renderNearbyRangers(list);
            }
          }
          presence(data);
          break;
        }
        case "position":
          relocate(...(data as [number, number]));
          break;
        case "ferry":
          if (panel.open) close();
          relocate(...(data as [number, number]));
          trackHabitat(-1);
          notice("Arrived at camp.");
          break;
        case "profile": {
          const before = profile;
          profile = data;
          if (!sessionReady || !before) {
            hud();
            break;
          }
          const growth =
            view === "detail"
              ? profile.collection.find((b) => b.id === selection)
              : undefined;
          const previous = before.collection.find((b) => b.id === selection);
          const child =
            view === "lab"
              ? profile.collection.find(
                  (b) =>
                    b.parents && !before.collection.some((p) => p.id === b.id),
                )
              : undefined;
          if (
            child ||
            (growth &&
              previous &&
              (growth.stage > previous.stage || growth.level > previous.level))
          ) {
            previousForm = previous;
            resultBeast = child ?? growth;
            resultTitle = child
              ? "A new hatchling"
              : growth!.stage > previous!.stage
                ? "Evolution complete"
                : "Training complete";
            hud();
            if (!child)
              gameAudio.play(
                growth!.stage > previous!.stage ? "evolve" : "resource",
              );
            display("growth");
            break;
          }
          hud();
          if (phase) renderCapture();
          if (
            [
              "detail",
              "pack",
              "collection",
              "settings",
              "lab",
              "shop",
            ].includes(view)
          )
            display(view);
          break;
        }
        case "encounter": {
          if (
            !waitingOffer &&
            !(phase === "aim" && data.studied && offer.index === data.index)
          )
            break;
          clearTimeout(throwTimer);
          waitingOffer = false;
          if (!data.studied && phase !== "escaped") castMethod = "standard";
          if (data.studied && !offer?.studied) gameAudio.play("study");
          offer = data;
          phase = "aim";
          if (castMethod === "focus" && profile.orbs < 2)
            castMethod = "standard";
          find<HTMLDetailsElement>(".field-tools").open = false;
          frameEncounter(data.index);
          fieldCapture.color(castMethod);
          freeze(true);
          renderCapture();
          if (!data.studied) throwButton.focus({ preventScroll: true });
          break;
        }
        case "caught":
        case "escaped":
        case "captureUnavailable":
          resolveThrow(type, data);
          break;
        case "notice":
          if (view === "arena" && battle) display("arena");
          if (data.includes("slipped")) gameAudio.play("escape");
          notice(data);
          break;
        case "queue":
          queued = data;
          invitation = null;
          display("arena");
          break;
        case "invite":
          invitation = data;
          queued = false;
          display("arena");
          break;
        case "cacheOpened":
          gameAudio.play("resource");
          notice(
            (data.kind === "prism" ? "Prism box" : "Trail box") +
              " opened · +" +
              data.orbs +
              " orbs · +" +
              data.shards +
              " shards",
          );
          break;
        case "battle":
          queued = false;
          invitation = null;
          battle = data;
          gameAudio.play(
            battle.lastMove ? battleSound(battle.lastMove.name) : "duelStart",
          );
          display("arena");
          break;
        case "end":
          gameAudio.play(data.startsWith("Victory") ? "victory" : "defeat");
          duelResult = data;
          resultBeast =
            battle?.names[battle.you] ??
            profile.collection.find((b) => b.id === profile.active);
          battle = null;
          display("duel-result");
          break;
      }
    },
    (reason, retry) => {
      sessionReady = false;
      if (phase || waitingOffer) {
        leaveCapture();
        notice("Connection lost during the encounter.");
      }
      find("#online").textContent = "Disconnected";
      if (retry) setTimeout(reconnect, 2000);
      else notice(reason);
    },
  );
  await connection.start();
}
function reconnect() {
  void joinExpedition().catch(() => {
    find("#online").textContent = "Server offline";
    setTimeout(reconnect, 3000);
  });
}
quality(
  localStorage.getItem("quality") ||
    (matchMedia("(pointer: coarse)").matches ? "Low" : "High"),
);
