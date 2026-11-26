import {
  mysteryBox,
  rewardLabel,
  wildItems,
  type WildItem,
  type WildReward,
} from "./wildStore";
import "./shop.css";

const sprites = {
  box: [
    "................",
    ".....ooooooo....",
    "...ooaaabbbboo..",
    "..oaacaaabbccbo.",
    ".oaaacaaaabbccbo",
    ".oaaacaaaabbccbo",
    ".odddcddddbbccbo",
    ".oeeeccceebbeebo",
    ".oaaacfcaaabbbbo",
    ".oaaaccaaaabbbbo",
    ".oaaacaaaabbbcbo",
    ".odddcddddbbccbo",
    "..ooddddddbbcbo.",
    "....ooooddbboo..",
    "........oooo....",
    "................",
  ],
  orbs: [
    "................",
    "......oooo......",
    "....ooccccoo....",
    "...occcaaacco...",
    "..occcaaaaabco..",
    "..ocaaaaaaabbo..",
    ".ocaaaaaaaabbbo.",
    ".oeeeefcfeeeeebo",
    ".oddddcfcdddddbo",
    ".obbbbecebbbbbo.",
    "..obbbdddabbbo..",
    "..obbbbbbbbboo..",
    "...oobbbbboo....",
    ".....ooooo......",
    "................",
    "................",
  ],
  charm: [
    "......oooo......",
    ".....oc..co.....",
    ".....oc..co.....",
    "......occo......",
    ".......oo.......",
    "......ocbo......",
    ".....ocaabo.....",
    "....ocaabbbo....",
    "...ocaafbbbbo...",
    "..ocaafffbbbbo..",
    "...ocaaabbbo....",
    "....ocaabbo.....",
    ".....ocabo......",
    "......obo.......",
    ".......o........",
    "................",
  ],
};
export function shopGrid(
  root: HTMLElement,
  action: (id: WildItem, card: HTMLElement) => void,
) {
  const grid = document.createElement("div");
  grid.className = "shop-stock";
  for (const id of Object.keys(wildItems) as WildItem[]) {
    const card = document.createElement("article");
    card.className = "shop-stock-item";
    card.dataset.stock = id;
    const icon = document.createElement("canvas");
    icon.width = icon.height = 16;
    icon.setAttribute("aria-hidden", "true");
    const ctx = icon.getContext("2d");
    const [a, b, c] =
      id === "prism"
        ? ["#9977ca", "#504271", "#f5c2fc"]
        : id === "trail"
          ? ["#b8854e", "#704e34", "#efd28a"]
          : ["#58baa7", "#326b66", "#aaefcb"];
    const palette: Record<string, string> = {
      o: "#192723",
      a,
      b,
      c,
      d: "#6e6144",
      e: "#443e37",
      f: "#fff3c6",
    };
    (id === "orbs"
      ? sprites.orbs
      : id === "charm"
        ? sprites.charm
        : sprites.box
    ).forEach((row, y) =>
      [...row].forEach((pixel, x) => {
        if (ctx && palette[pixel]) {
          ctx.fillStyle = palette[pixel];
          ctx.fillRect(x, y, 1, 1);
        }
      }),
    );
    const title = document.createElement("h3");
    title.textContent = wildItems[id].name;
    const description = document.createElement("p");
    description.textContent = wildItems[id].description;
    const art = document.createElement("span");
    art.className = "stock-art";
    art.setAttribute("aria-hidden", "true");
    art.append(icon);
    card.append(art, title, description);
    action(id, card);
    grid.append(card);
  }
  root.append(grid);
}

export function revealShopBox(
  root: HTMLElement,
  item: WildItem,
  reward: Partial<WildReward>,
) {
  if (!mysteryBox(item)) return;
  const card = root.querySelector<HTMLElement>(`[data-stock="${item}"]`);
  const art = card?.querySelector<HTMLElement>(".stock-art");
  const sprite = art?.querySelector("canvas");
  if (!card || !art || !sprite) return;

  // Keep the original sprite as the source so a second opening starts closed again.
  const stage = document.createElement("span");
  stage.className = "chest-opening";
  if (reward.aurora) stage.classList.add("aurora-opening");
  for (const part of ["base", "lid"] as const) {
    const layer = document.createElement("canvas");
    layer.width = layer.height = 16;
    const y = part === "base" ? 8 : 0;
    layer.getContext("2d")?.drawImage(sprite, 0, y, 16, 8, 0, y, 16, 8);
    layer.className = "chest-" + part;
    stage.append(layer);
  }
  const light = document.createElement("i");
  light.className = "chest-light";
  stage.append(light);
  art.querySelector(".chest-opening")?.remove();
  art.append(stage);
  sprite.hidden = true;
  const loot = document.createElement("span");
  loot.className = "chest-loot";
  loot.textContent = rewardLabel(reward);
  if (reward.ranger !== undefined) {
    const portrait = document.createElement("img");
    portrait.src = "/ranger-portraits/" + reward.ranger + ".webp";
    portrait.alt = "";
    portrait.width = portrait.height = 40;
    loot.prepend(portrait);
  }
  card.querySelector(".chest-loot")?.remove();
  card.append(loot);
}
