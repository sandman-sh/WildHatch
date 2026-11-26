// server/api.ts
import { createHash as createHash3, randomInt as randomInt3, randomUUID as randomUUID4 } from "node:crypto";

// src/username.ts
var usernameMaxLength = 20;
var usernameHint = "3\u201320 characters. Use letters, numbers, spaces, hyphens or underscores.";
function validateUsername(value) {
  const name = typeof value === "string" ? value.trim().replace(/ +/g, " ") : "";
  if (name.length < 3 || name.length > usernameMaxLength || !/^[a-z0-9][a-z0-9 _-]*$/i.test(name))
    return { error: usernameHint };
  if (/^guest(?:[ _-]|$)/i.test(name))
    return {
      error: "Names beginning with Guest are reserved for guest players."
    };
  return { name };
}

// src/avatarNames.ts
var avatarNames = [
  "Crimson",
  "Cool Alien",
  "Jimmy",
  "Old Moustache",
  "Skull",
  "Cappy",
  "Observer",
  "Hugo",
  "Cactus Boy",
  "Froggy",
  "Teddy",
  "Chill",
  "Mint",
  "Anchor",
  "Nightmare",
  "Pumpkin",
  "Robothead",
  "Retroman",
  "Wizzir",
  "Wambo",
  "Polydancer",
  "Wire Friend",
  "Carrot Kid",
  "Cool Banana",
  "Mushy",
  "Udom",
  "Astrodisco",
  "Bullidan",
  "Skelly",
  "Bloody",
  "Devil",
  "Clown",
  "Franky",
  "Ghost",
  "Wolfman",
  "Mummy",
  "Eyelids",
  "Kate",
  "Witch",
  "Sticker",
  "Horror Nurse",
  "Scarecrow",
  "Dracula",
  "Zombie",
  "Dino Kid",
  "Mafiossini",
  "David",
  "Astronaut",
  "Captain Lobster",
  "Samuela",
  "Polybot",
  "Jennifer",
  "Erika",
  "Lydia",
  "Fungus",
  "Olivia",
  "Rose",
  "Shiro",
  "Rabbit",
  "Angry",
  "Amazonas",
  "Aesthetica",
  "Cubiq",
  "Confirmed",
  "Disturbing Eyes",
  "Bacon Dude",
  "Ferk",
  "Always Watching",
  "Kyle",
  "Robert",
  "Lil Bro",
  "Mikel",
  "Pepo",
  "Baldman",
  "Expol",
  "Muscary",
  "Weird Flex But Ok",
  "Pipe",
  "Chad",
  "Coffee",
  "Toothpaste",
  "Good Tomato",
  "Butter",
  "Milk",
  "Cucumber",
  "Toilet Paper",
  "Hotdog",
  "Avocado",
  "Watermelon",
  "Eggplant",
  "Lil Bro Big Bro",
  "Chili",
  "Ice Cream",
  "Cool Choco",
  "Candy Cane",
  "Xmas Tree",
  "Snowy",
  "Cookieman",
  "Present",
  "Saint Claus",
  "Egg Boy",
  "Bizdude",
  "Cool Pizza",
  "Sunflower Person",
  "Goldfish Bag Person",
  "Cool Loops",
  "Pyre Sorcerer",
  "Chill Palm",
  "Alien Skeleton",
  "Unicorn Person",
  "Square Cosmonaut",
  "Ban Hammer Dude",
  "Eye Wizard",
  "Wop Wop",
  "Lalo Bot",
  "Mr Zurbzurb",
  "Slim Ringo",
  "Cool Fries",
  "Captain Lantern",
  "Shark Person",
  "Balloony",
  "Mowchok",
  "Super Sup",
  "Cosmic Dweller",
  "Hodler King",
  "Cool Battery",
  "Cool Jam",
  "Random Boi",
  "Cosmic Person",
  "Falcon Dude",
  "Cool Shovel",
  "Salty Salt",
  "Cool Baguette",
  "Cool Ketchup",
  "Coffee Maker",
  "Slug Person",
  "Cool Can",
  "Cool Ramen",
  "Cool Hydrant",
  "Bubble Boi",
  "Cool Drumstick",
  "Cool Pan",
  "Cool Guitar",
  "Real Cake",
  "Cool Pirate",
  "Cool Trash",
  "Wonkerls",
  "Eye Cleric",
  "Eye Summomer",
  "Cool Asparagoose",
  "Lup Lup",
  "Cool TNT",
  "Cool Barrel",
  "Cool Mail",
  "Cool Plunger",
  "Cool Pin",
  "Awesome Lemon",
  "Super Ice Pop",
  "Cool Drink",
  "Chill Penguin",
  "Cool Pancake",
  "Cool Taco",
  "Eye Mouth Eye",
  "Pencil Being",
  "Cool Candle",
  "Cool Broom",
  "Mister Contract",
  "Eye Fighter",
  "Cool Cone",
  "Cool Board",
  "Cool Door",
  "Conehead Being",
  "Circle Boi",
  "Cylinder Head",
  "Cool Orange",
  "Cool Poo",
  "Moon Girl",
  "Dope Screwdriver",
  "Cool Bunny",
  "Sr Stickbug",
  "Hourglass Person",
  "Cool Turtle",
  "Cool Bed",
  "Cool Coconut",
  "Tasty Sandwich",
  "Cool Sword",
  "Cool Peanut",
  "Cool Potato",
  "Cool Egg",
  "Cool Cow",
  "Cool Steak",
  "Cool Wash Machine",
  "Cool Cola",
  "Cool Cloud",
  "Cool Shield",
  "Cool Fridge",
  "Cool Bell",
  "Cool Stickman",
  "Cool Money Bag",
  "Cool Polygonal Mind"
];

// src/rangers.ts
var rangers = [
  { id: 0, name: "Sukuna", file: "sukuna", facesForward: true },
  { id: 6, name: "Seb", file: "seb" },
  ...avatarNames.map((name, index) => ({
    id: index + 7,
    name,
    file: String(index + 1).padStart(3, "0")
  }))
];
var rangerById = new Map(rangers.map((ranger) => [ranger.id, ranger]));
var starterRangers = rangers.slice(0, 6).map((ranger) => ranger.id);
function ownsRanger(id, earned = []) {
  return rangerById.has(id) && (starterRangers.includes(id) || earned.includes(id));
}
function guestRanger(guestId) {
  const slot = Number.parseInt(guestId.slice(0, 8), 16) % rangers.length;
  return rangers[slot].id;
}
var fieldRanger = rangers[0].id;

// src/wildStore.ts
var wildItems = {
  orbs: {
    name: "Orb pouch",
    cost: 4,
    description: "Four capture orbs for your next hunt."
  },
  trail: {
    name: "Trail box",
    cost: 6,
    description: "Three orbs and one unowned explorer while any remain. 70% chance of one shard, 30% chance of a Focus Charm."
  },
  prism: {
    name: "Prism box",
    cost: 12,
    description: "Four orbs, three shards and one unowned explorer while any remain. 90% chance of two extra shards, 10% chance of the Aurora orb finish."
  },
  charm: {
    name: "Focus Charm",
    cost: 5,
    description: "+10 percentage points on your next wild throw, up to 90%. Used automatically."
  }
};
function isWildItem(value) {
  return typeof value === "string" && Object.hasOwn(wildItems, value);
}
function mysteryBox(item) {
  return item === "trail" || item === "prism";
}
function wildReward(item, roll) {
  const reward = { orbs: 0, shards: 0, charms: 0, aurora: false };
  switch (item) {
    case "orbs":
      reward.orbs = 4;
      break;
    case "charm":
      reward.charms = 1;
      break;
    case "trail":
      reward.orbs = 3;
      if (roll < 30) reward.charms = 1;
      else reward.shards = 1;
      break;
    case "prism":
      reward.orbs = 4;
      reward.shards = roll < 10 ? 3 : 5;
      reward.aurora = roll < 10;
      break;
  }
  return reward;
}
function grantWildReward(profile, reward, explorerSeed) {
  if (explorerSeed !== void 0) {
    const remaining = rangers.filter(
      (r) => !ownsRanger(r.id, profile.unlockedRangers)
    );
    if (remaining.length) {
      reward.ranger = remaining[explorerSeed % remaining.length].id;
      (profile.unlockedRangers ??= []).push(reward.ranger);
    }
  }
  profile.orbs += reward.orbs;
  profile.shards += reward.shards;
  profile.charms = (profile.charms ?? 0) + reward.charms;
  if (reward.aurora) profile.aurora = true;
}

// server/collectibles.ts
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js";

// src/wildhatchProgram.ts
var wildhatchProgram = "BUfh4GsJjyH52oLkgyG3U2UT7qJwo6opLDmEUW4w7PpJ";
var wildhatchIssuer = "3azzbKB2FBqNjwd6HVnz1vjcqfA2whrj8SeaMVYBEfE6";

// src/importedBeasts.ts
var importedBeasts = [
  {
    name: "Bramblebear",
    source: "Cubicle Studio",
    file: "Bramblebear",
    element: "Nature",
    color: "#6f9565",
    size: 2.5,
    fallback: 1,
    habitat: [-10, -12]
  },
  {
    name: "Ashbison",
    source: "Cubicle Studio",
    file: "Ashbison",
    element: "Fire",
    color: "#ae7157",
    size: 2.65,
    fallback: 3,
    habitat: [72, 9]
  },
  {
    name: "Frostmoose",
    source: "Cubicle Studio",
    file: "Frostmoose",
    element: "Ice",
    color: "#8ca3bd",
    size: 2.7,
    fallback: 7,
    habitat: [30, -62]
  },
  {
    name: "Reedgnaw",
    source: "Cubicle Studio",
    file: "Reedgnaw",
    element: "Water",
    color: "#80a7a1",
    size: 1.6,
    fallback: 4,
    habitat: [6, 51]
  },
  {
    name: "Tidefang",
    source: "Cubicle Studio",
    file: "Tidefang",
    element: "Water",
    color: "#5a9277",
    size: 2.8,
    fallback: 4,
    habitat: [17, 80]
  },
  {
    name: "Lanternfrog",
    source: "Catching Animals",
    file: "Lanternfrog",
    element: "Nature",
    color: "#91c96f",
    size: 1.35,
    fallback: 0,
    habitat: [-6, 20]
  },
  {
    name: "Duskpanther",
    source: "Catching Animals",
    file: "Duskpanther",
    element: "Crystal",
    color: "#9b71ce",
    size: 2.15,
    fallback: 1,
    habitat: [-55, -5]
  },
  {
    name: "Snowwaddle",
    source: "Catching Animals",
    file: "Snowwaddle",
    element: "Ice",
    color: "#aad8fa",
    size: 1.55,
    fallback: 7,
    habitat: [14, -73]
  },
  {
    name: "Glideray",
    source: "Catching Animals",
    file: "Glideray",
    element: "Water",
    color: "#7dc5d6",
    size: 2.25,
    fallback: 5,
    habitat: [-21, 88]
  },
  {
    name: "Runehorn",
    source: "Catching Animals",
    file: "Runehorn",
    element: "Crystal",
    color: "#b193d7",
    size: 2.65,
    fallback: 3,
    habitat: [-30, 10]
  },
  {
    name: "Cinderplate",
    source: "Catching Animals",
    file: "Cinderplate",
    element: "Fire",
    color: "#c57b49",
    size: 2.45,
    fallback: 3,
    habitat: [59, -13]
  },
  {
    name: "Emberjaw",
    source: "monogon",
    file: "Emberjaw",
    element: "Fire",
    color: "#bc804c",
    size: 3.25,
    fallback: 2,
    habitat: [69, -25]
  },
  {
    name: "Sunwing",
    source: "Cubicle Studio",
    file: "Sunwing",
    element: "Nature",
    color: "#bfaa73",
    size: 2.5,
    fallback: 2,
    habitat: [-14, -6],
    flight: { altitude: 4.4, radius: 5.5, turnRate: 0.65 }
  },
  {
    name: "Skyrake",
    source: "Catching Animals",
    file: "Skyrake",
    element: "Crystal",
    color: "#a899df",
    size: 3.1,
    fallback: 2,
    habitat: [25, -12],
    flight: { altitude: 5.4, radius: 6.4, turnRate: 0.56 }
  }
];
var byName = new Map(importedBeasts.map((animal) => [animal.name, animal]));
var gameOnlyBeast = (name) => byName.has(name);

// src/frontier.ts
var sectorSize = 128;
var sectorAt = (n) => Math.floor(n / sectorSize + 0.5);
var isFrontier = (cx, cz) => Math.max(Math.abs(cx), Math.abs(cz)) >= 2;
var frontierAt = (x, z) => isFrontier(sectorAt(x), sectorAt(z));
function sample(x, z, salt) {
  let h = Math.imul(x, 521288629) ^ Math.imul(z, 1597334677) ^ Math.imul(salt, 668265261) ^ 1464355908;
  h = Math.imul(h ^ h >>> 16, 73244475);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
var ranges = [
  {
    name: "Amberwood",
    climate: "Emerald Forest",
    animal: "Amberhart",
    native: "Mosskin",
    top: 12166744,
    rock: 9598807,
    peak: 10,
    props: [
      "range-BirchTree_Autumn_1",
      "range-CommonTree_Autumn_2",
      "range-BushBerries_1"
    ],
    camp: "range-Tent"
  },
  {
    name: "Saffron Badlands",
    climate: "Lava Realm",
    animal: "Dunebull",
    native: "Cinderclaw",
    top: 13866329,
    rock: 11098169,
    peak: 17,
    props: ["range-Cactus_2", "range-CactusFlower_1", "range-Rock_1"],
    camp: "range-Well"
  },
  {
    name: "Cloudpine Tundra",
    climate: "Frozen Peaks",
    animal: "Cloudwool",
    native: "Snowpup",
    top: 13951966,
    rock: 7902112,
    peak: 21,
    props: ["range-PineTree_Snow_1", "range-Bush_Snow_1", "range-Rock_1"],
    camp: "range-Tent"
  },
  {
    name: "Lotus Marsh",
    climate: "Ocean Frontier",
    animal: "Fenstride",
    native: "Aquabit",
    top: 8824426,
    rock: 6714971,
    peak: 5,
    props: ["range-PalmTree_2", "range-Flowers", "range-Lilypad"],
    camp: "Altar"
  },
  {
    name: "Obsidian Heath",
    climate: "Crystal Valley",
    animal: "Cinderfox",
    native: "Crystalimp",
    top: 8484739,
    rock: 5591144,
    peak: 14,
    props: ["range-BirchTree_Dead_1", "frontier-Crystal_Big", "range-Rock_1"],
    camp: "PillarRoundCut"
  },
  {
    name: "Windgrass Steppe",
    climate: "Emerald Forest",
    animal: "Galemane",
    native: "Sunplume",
    top: 11385194,
    rock: 10061411,
    peak: 7,
    props: [
      "range-Flowers",
      "range-BushBerries_1",
      "range-CommonTree_Autumn_2"
    ],
    camp: "range-Well"
  }
];
var nativeBeasts = [
  ["Amberhart", "Nature", "#deaa64", "Stag", 6],
  ["Dunebull", "Fire", "#ba7859", "Bull", 3],
  ["Cloudwool", "Ice", "#9dcbd9", "Alpaca", 7],
  ["Fenstride", "Water", "#83b6a0", "Deer", 1],
  ["Cinderfox", "Fire", "#df8b5c", "Fox", 1],
  ["Galemane", "Nature", "#9db679", "Horse", 7]
];
function makeSector(cx, cz) {
  const kind = Math.floor(sample(cx, cz, 2) * ranges.length);
  const x = cx * sectorSize + Math.round(sample(cx, cz, 3) * 14 - 7), z = cz * sectorSize + Math.round(sample(cx, cz, 4) * 14 - 7);
  return {
    cx,
    cz,
    x,
    z,
    kind,
    range: ranges[kind],
    rx: 44 + sample(cx, cz, 5) * 10,
    rz: 43 + sample(cx, cz, 6) * 11,
    phase: sample(cx, cz, 7) * 6.28
  };
}
var sectors = /* @__PURE__ */ new Map();
function sector(cx, cz) {
  const key2 = cx + "," + cz;
  let s = sectors.get(key2);
  if (s) return s;
  s = makeSector(cx, cz);
  if (sectors.size >= 160) sectors.delete(sectors.keys().next().value);
  sectors.set(key2, s);
  return s;
}
function frontierHeight(x, z) {
  const s = sector(sectorAt(x), sectorAt(z)), u = (x - s.x) / s.rx, v = (z - s.z) / s.rz;
  const r = Math.hypot(u, v), angle = Math.atan2(v, u);
  const rim = 0.1 * Math.sin(3 * angle + s.phase) + 0.065 * Math.cos(5 * angle - s.phase) + 0.035 * Math.sin(9 * angle + s.phase);
  const edge = 64 - Math.max(Math.abs(x - s.cx * 128), Math.abs(z - s.cz * 128));
  const shore = Math.min(
    (edge - 4) / 30,
    1 - r + rim * Math.min(1, r) + 0.048 * Math.sin(7 * u + s.phase) * Math.cos(6 * v - s.phase)
  );
  if (shore < -0.07) return -2.4;
  const ridge = Math.max(
    0,
    1 - Math.hypot((u - 0.29) * 1.45, (v + 0.31) * 1.8)
  );
  const rolls = Math.sin(x * 0.081 + s.phase) * Math.cos(z * 0.073) * 1.25 + Math.sin(z * 0.14 + s.phase) * 0.55;
  let h = Math.min(shore * 24, 3.1 + rolls + ridge * s.range.peak);
  if (s.kind === 3) {
    const stream = Math.abs(u + 0.38 + 0.13 * Math.sin(6 * v + s.phase));
    h = Math.min(h, -0.65 + Math.max(0, stream - 0.06) * 17 + rolls * 0.32);
  }
  if (s.kind === 1)
    h = Math.min(
      h,
      4 + Math.floor(Math.max(0, ridge - 0.08) * 5) * 1.7 + rolls * 0.5
    );
  if (s.kind === 4)
    h += Math.max(0, 1 - r * 1.5) * Math.abs(Math.sin(8 * u - 2 * v + s.phase)) * 1.8;
  return Math.floor(h / 0.3) * 0.3;
}
var signed = (v) => v >= 0 ? 2 * v : -2 * v - 1;
var unpack = (v) => v % 2 ? -(v + 1) / 2 : v / 2;
var frontierWildlife = [
  ["Bramblebear", "Lanternfrog", "Sunwing"],
  ["Ashbison", "Cinderplate", "Emberjaw"],
  ["Frostmoose", "Snowwaddle"],
  ["Reedgnaw", "Tidefang"],
  ["Duskpanther", "Runehorn", "Skyrake"],
  ["Bramblebear", "Runehorn"]
];
function siteId(cx, cz, slot) {
  const a = signed(cx), b = signed(cz), n = a + b;
  return 32 + 2 * (n * (n + 1) / 2 + b) + slot;
}
function frontierSite(id) {
  if (!Number.isSafeInteger(id) || id < 32) return;
  const k = Math.floor((id - 32) / 2), n = Math.floor((Math.sqrt(8 * k + 1) - 1) / 2), b = k - n * (n + 1) / 2, cx = unpack(n - b), cz = unpack(b);
  if (!isFrontier(cx, cz)) return;
  const s = sector(cx, cz);
  if (!(id % 2)) return [s.range.animal, s.x + 5, s.z + 3];
  const pool2 = [s.range.native, ...frontierWildlife[s.kind]];
  return [
    pool2[Math.floor(sample(cx, cz, 39) * pool2.length)],
    s.x - 15,
    s.z + 8
  ];
}
function ferryCamp(x, z) {
  if (!frontierAt(x, z))
    return { x: 0, z: 0, frontier: false, ready: Math.hypot(x, z) <= 9 };
  const s = sector(sectorAt(x), sectorAt(z));
  return {
    x: s.x,
    z: s.z,
    frontier: true,
    ready: Math.hypot(x - s.x, z - s.z) < 15
  };
}
var propCache = /* @__PURE__ */ new Map();
function sectorProps(cx, cz) {
  const key2 = cx + "," + cz;
  const known = propCache.get(key2);
  if (known) return known;
  const s = sector(cx, cz), props = [];
  const first = frontierSite(siteId(cx, cz, 0)), second = frontierSite(siteId(cx, cz, 1));
  for (let i = 0; i < 205; i++) {
    const x = s.x + (sample(cx, cz, 11 + i * 4) - 0.5) * s.rx * 2, z = s.z + (sample(cx, cz, 12 + i * 4) - 0.5) * s.rz * 2;
    if (Math.hypot(x - s.x, z - s.z) < 9 || Math.hypot(x - s.x + 6, z - s.z + 8) < 6 || [first, second].some((h) => Math.hypot(x - h[1], z - h[2]) < 4))
      continue;
    const t = sample(cx, cz, 13 + i * 4), model = s.range.props[Math.floor(t * 3)], y = frontierHeight(x, z);
    if (model === "range-Lilypad" ? y > -0.2 || y < -1.6 : y < 0.35) continue;
    const tree = /Tree|Palm/.test(model), scale = (tree ? 4 : /Cactus|Crystal/.test(model) ? 2 : 0.75) * (1 + sample(cx, cz, 14 + i * 4));
    props.push({
      model,
      x,
      z,
      height: scale,
      yaw: t * 6.28,
      radius: tree ? 0.35 : /Rock|Cactus|Crystal/.test(model) ? scale * 0.18 : 0
    });
  }
  const understory = [
    "range-Flowers",
    "Agave",
    "range-Bush_Snow_1",
    "coast-ferns",
    "frontier-Mushroom",
    "range-BushBerries_1"
  ][s.kind];
  for (let i = 0; i < 36; i++) {
    const x = s.x + sample(cx, cz, 1200 + i) * 84 - 42, z = s.z + sample(cx, cz, 1300 + i) * 80 - 40;
    for (let k = 0; k < 4; k++) {
      const px = x + sample(cx + i, cz + k, 1500) * 4, pz = z + sample(cx + i, cz + k, 1600) * 4;
      if (frontierHeight(px, pz) < 0.2 || Math.hypot(px - s.x, pz - s.z) < 6)
        continue;
      props.push({
        model: understory,
        x: px,
        z: pz,
        height: 0.5 + 0.65 * sample(cx + i, cz + k, 1700),
        yaw: k * 1.8,
        radius: 0
      });
    }
  }
  const equipment = [
    ["frontier-Fence_Center", "frontier-Chest_Closed"],
    ["frontier-Cart", "frontier-Prop_Barrel"],
    ["frontier-Chest_Closed", "frontier-Fence_Center"],
    ["frontier-Environment_Dock_Broken", "frontier-Prop_Bucket_Fishes"],
    ["frontier-Cart", "frontier-Crystal_Big"],
    ["frontier-Fence_Center", "frontier-Prop_Barrel"]
  ][s.kind];
  equipment.forEach(
    (model, i) => props.push({
      model,
      x: s.x - 8 + i * 5,
      z: s.z - 11,
      height: i ? 1.2 : 3,
      yaw: s.phase,
      radius: 0.4
    })
  );
  props.push({
    model: s.range.camp,
    x: s.x - 6,
    z: s.z - 8,
    height: 3.3,
    yaw: s.phase,
    radius: 1
  });
  if (propCache.size >= 100) propCache.delete(propCache.keys().next().value);
  propCache.set(key2, props);
  return props;
}

// src/shared.ts
var habitats = [
  ["Mosskin", 3, -5],
  ["Bloomtail", -10, 4],
  ["Emberling", 9, -9],
  ["Cinderclaw", 49, -27],
  ["Aquabit", -12, 36],
  ["Bubblefin", 0, 86],
  ["Frostbite", 1, -34],
  ["Snowpup", 18, -62],
  ["Crystalimp", -33, -11],
  ["Prismtail", -68, 6],
  ["Sunplume", 13, 9],
  ["Reedmask", -131, -46],
  ["Rimehorn", 52, -128],
  ["Geodeback", 133, 30],
  ["Saltfleece", -46, 132],
  ...importedBeasts.map(({ name, habitat }) => [name, ...habitat])
];
function habitatAt(id) {
  return habitats[id] ?? frontierSite(id);
}
var elements = {
  Mosskin: "Nature",
  Bloomtail: "Nature",
  Emberling: "Fire",
  Cinderclaw: "Fire",
  Aquabit: "Water",
  Bubblefin: "Water",
  Frostbite: "Ice",
  Snowpup: "Ice",
  Crystalimp: "Crystal",
  Prismtail: "Crystal",
  Sunplume: "Fire",
  Reedmask: "Nature",
  Rimehorn: "Ice",
  Geodeback: "Crystal",
  Saltfleece: "Water",
  ...Object.fromEntries(nativeBeasts.map(([name, element]) => [name, element])),
  ...Object.fromEntries(
    importedBeasts.map(({ name, element }) => [name, element])
  )
};
var rarities = [
  "Normal",
  "Unusual",
  "Rare",
  "Epic",
  "Legendary",
  "Mythic"
];
function beastStats(b) {
  return {
    health: 30 + b.level * 4 + (b.stage - 1) * 4,
    attack: 5 + b.level + (b.variant >>> 8) % 3 + b.stage - 1,
    defense: (b.variant >>> 4) % 3,
    speed: 4 + b.variant % 3
  };
}
function inheritedMutation(first, second) {
  const pair = [elements[first], elements[second]].sort().join("/");
  return {
    "Fire/Water": "Steam",
    "Crystal/Nature": "Ancient Grove",
    "Crystal/Fire": "Magma Crystal",
    "Ice/Water": "Glacier"
  }[pair];
}

// src/collectibleTraits.ts
var beastMemoProgram = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
var beastMemoPrefix = "WildHatch Beast v1 ";
function beastMemo(beast2) {
  return beastMemoPrefix + JSON.stringify({
    id: beast2.id,
    species: beast2.name,
    element: elements[beast2.name],
    variant: beast2.variant,
    rarity: beast2.rarity,
    personality: beast2.personality,
    stage: beast2.stage,
    level: beast2.level,
    marking: beast2.marking ?? "None",
    mutation: beast2.mutation ?? "None"
  });
}

// server/collectibles.ts
var program = new PublicKey(wildhatchProgram);
var token = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
var associated = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);
var devnet = new Connection("https://api.devnet.solana.com", "confirmed");
var tag = createHash("sha256").update("global:mint_beast").digest().subarray(0, 8);
var key = (pubkey, isWritable = false, isSigner = false) => ({
  pubkey,
  isWritable,
  isSigner
});
var mintAddressFor = (id) => PublicKey.findProgramAddressSync(
  [Buffer.from("beast"), Buffer.from(id.replaceAll("-", ""), "hex")],
  program
)[0];
async function prepareCollectible(profile, id) {
  if (!profile.wallet) throw Error("Sign in with your Solana wallet.");
  const beast2 = profile.collection.find((entry) => entry.id === id);
  if (!beast2 || typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id)) {
    throw Error("Select a beast in your collection.");
  }
  if (gameOnlyBeast(beast2.name))
    throw Error("This species is available as an in-game collectible.");
  const path = process.env.WILDHATCH_ISSUER_KEYPAIR;
  const json = process.env.WILDHATCH_ISSUER_KEYPAIR_JSON;
  if (!json && !path) throw Error("The Devnet collectible issuer is not configured.");
  let issuer;
  try {
    issuer = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(json || readFileSync(path, "utf8")))
    );
  } catch {
    throw Error("The Devnet collectible issuer keypair could not be loaded.");
  }
  if (issuer.publicKey.toBase58() !== wildhatchIssuer)
    throw Error("The Devnet collectible issuer is misconfigured.");
  if (!(await devnet.getAccountInfo(program))?.executable)
    throw Error("The WildHatch Devnet program is awaiting deployment.");
  const owner = new PublicKey(profile.wallet);
  const mint2 = mintAddressFor(id);
  if (await devnet.getAccountInfo(mint2, "finalized"))
    return { mint: mint2.toBase58() };
  const block = await devnet.getLatestBlockhash();
  const tx = buildCollectibleTransaction(beast2, owner, issuer, block);
  return {
    mint: mint2.toBase58(),
    transaction: tx.serialize({ requireAllSignatures: false }).toString("base64"),
    ...block
  };
}
function buildCollectibleTransaction(beast2, owner, issuer, block) {
  const encoded = Buffer.from(beast2.id.replaceAll("-", ""), "hex");
  const mint2 = mintAddressFor(beast2.id);
  const destination = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), token.toBuffer(), mint2.toBuffer()],
    associated
  )[0];
  const tx = new Transaction({ feePayer: owner, ...block }).add(
    new TransactionInstruction({
      programId: program,
      keys: [
        key(owner, true, true),
        key(issuer.publicKey, false, true),
        key(mint2, true),
        key(destination, true),
        key(SystemProgram.programId),
        key(token),
        key(associated)
      ],
      data: Buffer.concat([tag, encoded])
    }),
    new TransactionInstruction({
      programId: new PublicKey(beastMemoProgram),
      keys: [key(issuer.publicKey, false, true)],
      data: Buffer.from(beastMemo(beast2))
    })
  );
  tx.partialSign(issuer);
  return tx;
}

// server/database.ts
import pg from "pg";
var pool;
var database = async (write, run) => {
  if (!pool) {
    const connectionString = process.env.WILDHATCH_DATABASE_URL;
    if (!connectionString) throw Error("WildHatch database is not configured.");
    const url = new URL(connectionString);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const ca = process.env.WILDHATCH_DATABASE_CA?.replaceAll("\\n", "\n");
    if (!local) {
      for (const parameter of [
        "sslmode",
        "sslrootcert",
        "sslcert",
        "sslkey",
        "uselibpqcompat"
      ])
        url.searchParams.delete(parameter);
    }
    pool = new pg.Pool({
      connectionString: url.href,
      ssl: local ? void 0 : { rejectUnauthorized: true, ca },
      max: 3,
      allowExitOnIdle: true,
      connectionTimeoutMillis: 5e3,
      idleTimeoutMillis: 5e3
    });
    pool.on("error", (error) => {
      console.error(
        "WildHatch database connection ended",
        error.code ?? "unavailable"
      );
    });
  }
  const client = await pool.connect();
  try {
    const begin = write ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY";
    await client.query(
      begin + "; SET LOCAL search_path = wildhatch; SET LOCAL statement_timeout = '8s'" + (write ? "; SELECT pg_advisory_xact_lock(287467, 2)" : "")
    );
    const result = await run((sql, params) => client.query(sql, params));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {
    });
    throw error;
  } finally {
    client.release();
  }
};

// server/profiles.ts
import { randomBytes, randomInt } from "node:crypto";
function profiles(query) {
  async function get(token2) {
    if (!token2) return;
    const { rows } = await query("SELECT data FROM profiles WHERE token=$1", [
      token2
    ]);
    return rows[0]?.data;
  }
  async function read(token2) {
    const profile = await get(token2);
    if (!profile) throw Error("Ranger profile is missing.");
    return profile;
  }
  async function save(token2, profile) {
    await query("UPDATE profiles SET data=$1 WHERE token=$2", [
      JSON.stringify(profile),
      token2
    ]);
  }
  async function signedIn(token2) {
    const profile = await get(token2);
    return profile?.wallet ? profile : void 0;
  }
  async function create(starter) {
    const token2 = randomBytes(32).toString("hex");
    let name;
    do {
      name = "Ranger " + randomInt(1e5, 1e6);
    } while ((await query(
      "SELECT 1 FROM profiles WHERE lower(data->>'name')=lower($1) LIMIT 1",
      [name]
    )).rows.length);
    const profile = {
      name,
      orbs: 8,
      shards: 4,
      collection: [starter],
      active: starter.id,
      wins: 0
    };
    await query("INSERT INTO profiles VALUES ($1, $2)", [
      token2,
      JSON.stringify(profile)
    ]);
    return { token: token2, profile };
  }
  return { get, read, save, signedIn, create };
}

// server/wallet.ts
import { createPublicKey, randomBytes as randomBytes2, verify } from "node:crypto";
var alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function walletKey(address) {
  if (typeof address !== "string" || address.length < 32 || address.length > 44)
    throw Error("Invalid wallet");
  let n = 0n;
  for (const c of address) {
    const i = alphabet.indexOf(c);
    if (i < 0) throw Error("Invalid wallet");
    n = n * 58n + BigInt(i);
  }
  const bytes = [];
  while (n) {
    bytes.unshift(Number(n % 256n));
    n /= 256n;
  }
  for (const c of address) {
    if (c !== "1") break;
    bytes.unshift(0);
  }
  if (bytes.length !== 32) throw Error("Invalid wallet");
  return createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      Buffer.from(bytes)
    ]),
    format: "der",
    type: "spki"
  });
}
function challenge(address, origin) {
  walletKey(address);
  return {
    address,
    expires: Date.now() + 12e4,
    message: "WildHatch wallet link\nOrigin: " + origin + "\nWallet: " + address + "\nNonce: " + randomBytes2(24).toString("hex")
  };
}
function check(c, signature) {
  return c.expires > Date.now() && typeof signature === "string" && signature.length <= 90 && verify(
    null,
    Buffer.from(c.message),
    walletKey(c.address),
    Buffer.from(signature, "base64")
  );
}

// server/wildBurn.ts
import { createHash as createHash2 } from "node:crypto";
import { Connection as Connection2, PublicKey as PublicKey2 } from "@solana/web3.js";
var connection = new Connection2("https://api.devnet.solana.com", "finalized");
var splToken = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
var memo = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
var mint = PublicKey2.findProgramAddressSync(
  [Buffer.from("wild")],
  new PublicKey2(wildhatchProgram)
)[0].toBase58();
async function verifyWildBurn(signature, wallet, item) {
  const record = await connection.getParsedTransaction(signature, {
    commitment: "finalized",
    maxSupportedTransactionVersion: 0
  });
  if (!record)
    throw Error("Awaiting Devnet finality. Retry this receipt shortly.");
  if (!record.meta || record.meta.err)
    throw Error("The token payment failed on Devnet.");
  const message = record.transaction.message;
  const expected = String(wildItems[item].cost * 1e6);
  const burns = message.instructions.filter(
    (instruction) => instruction.programId.toBase58() === splToken && "parsed" in instruction && instruction.parsed?.type === "burnChecked"
  );
  const burn = burns[0]?.parsed.info;
  if (burns.length !== 1 || burn.mint !== mint || burn.authority !== wallet || burn.tokenAmount?.amount !== expected || !message.accountKeys.some(
    (key2) => key2.signer && key2.pubkey.toBase58() === wallet
  ) || !message.instructions.some(
    (i) => i.programId.toBase58() === memo && "parsed" in i && i.parsed === "WildHatch:" + item
  )) {
    throw Error("The payment does not match this wallet and item.");
  }
}
var boxDiscriminator = createHash2("sha256").update("account:BoxOpening").digest().subarray(0, 8);
async function verifiedBoxRoll(address, wallet, item, rpc = connection) {
  const key2 = new PublicKey2(address);
  const program2 = new PublicKey2(wildhatchProgram);
  const account = await rpc.getAccountInfo(key2, "finalized");
  if (!account) throw Error("Waiting for the box transaction to finalize.");
  const data = account.data;
  if (!account.owner.equals(program2) || data.length !== 50 || !data.subarray(0, 8).equals(boxDiscriminator))
    throw Error("Invalid box receipt.");
  const buyer = new PublicKey2(data.subarray(8, 40));
  const [expected] = PublicKey2.findProgramAddressSync(
    [Buffer.from("box"), buyer.toBuffer(), data.subarray(40, 48)],
    program2
  );
  if (!expected.equals(key2) || buyer.toBase58() !== wallet || item !== "trail" && item !== "prism" || data[48] !== (item === "trail" ? 0 : 1))
    throw Error("This box belongs to a different purchase.");
  if (data[49] > 99) throw Error("Waiting for the MagicBlock reveal.");
  return data[49];
}

// server/raids.ts
import { randomUUID } from "node:crypto";
function createRaids(snapshot = []) {
  const rooms = new Map(
    snapshot.map(([zone, room2]) => [
      zone,
      { ...room2, entries: new Map(room2.entries) }
    ])
  );
  function room(zone) {
    let r = rooms.get(zone);
    if (!r || r.respawn && r.respawn < Date.now()) {
      r = {
        id: randomUUID(),
        hp: 100,
        max: 100,
        next: 0,
        respawn: 0,
        entries: /* @__PURE__ */ new Map()
      };
      rooms.set(zone, r);
    }
    return r;
  }
  function state(zone, token2) {
    const r = room(zone), e = r.entries.get(token2);
    return {
      hp: r.hp,
      max: r.max,
      health: e?.hp ?? 35,
      players: r.entries.size,
      damage: e?.damage || 0,
      phase: r.hp === 0 ? "Defeated" : r.hp <= 40 ? "Enraged" : "Awakened",
      respawn: r.respawn
    };
  }
  function attack(zone, token2, level) {
    const r = room(zone), now = Date.now(), e = r.entries.get(token2) ?? { hp: 35, damage: 0, last: 0 };
    if (!r.hp || e.hp <= 0 || now - e.last < 1200) return null;
    const dmg = Math.min(r.hp, 6 + Math.min(15, level));
    r.hp -= dmg;
    e.damage += dmg;
    e.last = now;
    r.entries.set(token2, e);
    if (!r.hp) {
      r.respawn = now + 6e4;
      return {
        id: r.id,
        winners: [...r.entries].filter(([, entry]) => entry.damage > 0).map(([t]) => t)
      };
    }
    if (now >= r.next) {
      r.next = now + 4200;
      for (const member of r.entries.values())
        member.hp = Math.max(0, member.hp - (r.hp <= 40 ? 8 : 4));
    }
    return null;
  }
  function snapshotRooms() {
    return [...rooms].map(([zone, room2]) => [
      zone,
      { ...room2, entries: [...room2.entries] }
    ]);
  }
  return { state, attack, snapshot: snapshotRooms };
}

// src/destinations.ts
var destinations = [
  { kind: "shop", name: "Wild Shop", district: "Trailhead", x: -4, z: 4 },
  { kind: "market", name: "Trading Post", district: "Trailhead", x: 7, z: -6 },
  { kind: "boss", name: "Sanctuary", district: "Dragon Gate", x: -6.4, z: -21 },
  { kind: "shop", name: "Wild Shop", district: "Bamboo Reach", x: -125, z: -54 },
  { kind: "market", name: "Trading Post", district: "Amethyst Key", x: 135, z: 25 }
];

// src/fixtures.ts
function prop(model, x, z, size, yaw = 0, width = 0, depth = width) {
  return { model, x, z, size, yaw, width, depth };
}
var fixtures = [
  prop("Gate", -6.4, -21, 5.6),
  prop("PillarRound", -9.6, -25, 3.6, 0, 1.05),
  prop("PillarRoundCut", -3.1, -25, 1.6, 0.3, 0.92),
  prop("WallBrokenMD", -10.4, -22, 3.7, Math.PI / 2, 0.9, 3.3),
  prop("Altar", -6.4, -26, 1.8, 0, 1.55, 1.05),
  prop("Vase", -8.5, -24, 0.76, 0.35, 0.42),
  prop("cart", 7, -12, 2.3, 0.25, 1.15, 1.6),
  ...destinations.filter((p) => p.kind !== "boss").map((p) => prop("market", p.x, p.z, p.kind === "shop" ? 3.6 : 3.2, 0, 2.7, 1.6)),
  prop("produce", 5.1, -5.9, 0.8, 0.12, 0.7),
  prop("bench", 3, 1, 1.8, -0.25, 1.6, 0.52),
  prop("bench", 12, -4, 1.8, -0.5, 1.6, 0.52),
  prop("farm", 17, 5, 4.4, 0.15, 3.7, 3.2),
  prop("rune", -3, -38, 2.6, -0.15, 1.45, 0.87),
  prop("rune", 14, -58, 2.4, 0.6, 1.35, 0.8),
  prop("berries", -1, -37, 1.2),
  prop("berries", 15, -57, 1.3),
  prop("coast-palm", 4, 41, 5.5, 0, 0.58),
  prop("coast-palm", -4, 49, 6.1, 0.8, 0.62),
  prop("coast-palm", 8, 59, 5.8, 2.1, 0.58),
  prop("coast-ferns", 3, 43, 1.5),
  prop("coast-ferns", -3, 50, 1.7, 0.7),
  // The farm and launch beach introduce the livestock and maritime props on the home island.
  prop("frontier-Fence_Center", 16, 9.8, 2.4, 0, 2.15, 0.3),
  prop("frontier-Fence_Center", 18.4, 9.8, 2.4, 0, 2.15, 0.3),
  prop("frontier-Prop_Bucket_Fishes", -2, 78, 0.72, 0.2),
  prop("frontier-Prop_Barrel", 0, 79, 1.1, 0, 0.8),
  prop("frontier-Bamboo_Small", -128, -51, 3.5, 0.8),
  prop("frontier-Mushroom", -129, -49, 0.95, 0.4),
  prop("frontier-Chest_Closed", -122, -49, 1.35, -0.3, 1.15, 0.75),
  prop("frontier-DeadTree_1", 47, -134, 4.1, 1, 0.52),
  prop("frontier-Rock2", 45, -133, 2, 0.4, 1.3),
  prop("frontier-Rock2", 49, -138, 2.9, -0.6, 1.8),
  prop("frontier-Rail_Straight", 129, 24, 2.7),
  prop("frontier-Rail_Straight", 129, 26.65, 2.7),
  prop("frontier-Cart", 129, 24, 1.8, 0, 1, 1.4),
  prop("frontier-Crystal_Big", 131.4, 22, 3.2, 0.6, 1.2),
  prop("frontier-Chest_Closed", 127, 25, 1.15, -0.4, 1, 0.65),
  prop("frontier-Environment_Dock_Broken", -35, 105, 5.2, 0.12),
  prop("frontier-Ship_Small", -39, 99, 8.5, 0.9, 3.5, 3.8),
  prop("frontier-Prop_Anchor", -33, 111, 1.8, 0.5),
  prop("frontier-Prop_Barrel", -32, 109.6, 1.3, -0.2, 0.85),
  prop("frontier-Prop_Bucket_Fishes", -31, 110, 0.78, 0.3)
];

// src/outerIslands.ts
var outerIslands = [
  {
    name: "Bamboo Reach",
    biome: "Emerald Forest",
    x: -126,
    z: -57,
    rx: 49,
    rz: 40,
    summit: 10
  },
  {
    name: "Rimehorn Isle",
    biome: "Frozen Peaks",
    x: 53,
    z: -139,
    rx: 47,
    rz: 48,
    summit: 22
  },
  {
    name: "Amethyst Key",
    biome: "Crystal Valley",
    x: 142,
    z: 21,
    rx: 47,
    rz: 39,
    summit: 14
  },
  {
    name: "Driftwood Cay",
    biome: "Ocean Frontier",
    x: -36,
    z: 141,
    rx: 57,
    rz: 37,
    summit: 7
  }
];
function outerIslandAt(x, z) {
  for (const island2 of outerIslands) {
    if (Math.abs(x - island2.x) < island2.rx + 4 && Math.abs(z - island2.z) < island2.rz + 4)
      return island2;
  }
}
function outerHeight(x, z, island2) {
  const u = (x - island2.x) / island2.rx, v = (z - island2.z) / island2.rz;
  const shore = 1 - Math.hypot(u, v) + 0.042 * Math.sin(x * 0.19) * Math.cos(z * 0.12);
  if (shore < -0.06) return -2.4;
  const ridge = Math.max(0, 1 - Math.hypot((u - 0.25) * 1.8, (v + 0.21) * 2.4));
  const relief = 2.1 + ridge * island2.summit + 0.9 * Math.sin(x * 0.14) + 0.58 * Math.sin(z * 0.18);
  return Math.floor(Math.min(shore * 22, relief) / 0.3) * 0.3;
}

// src/world.ts
import * as THREE2 from "three";

// src/world-materials.ts
import * as THREE from "three";
var SURFACE = {
  stone: 0,
  meadow: 1,
  needle: 2,
  bark: 3,
  plank: 4,
  soil: 5,
  sand: 6,
  snow: 7,
  gem: 8,
  copper: 9,
  cloud: 10
};
var surfaceByColor = /* @__PURE__ */ new Map();
var register = (surface, colors) => {
  for (const color of colors) surfaceByColor.set(color, surface);
};
register(
  SURFACE.meadow,
  [
    9219928,
    9285719,
    8759892,
    9548893,
    8759891,
    10271076,
    10007904,
    10403175,
    10205537,
    8297056,
    10791315
  ]
);
register(
  SURFACE.needle,
  [
    3696487,
    4356213,
    5540226,
    2909264,
    3765329,
    5277273,
    5342027,
    6725462,
    8366939,
    10337640,
    4422220,
    5605961,
    6855760,
    8563800,
    5411428,
    6325577,
    5733959,
    8431450
  ]
);
register(SURFACE.bark, [7361853, 7820860, 9071687]);
register(
  SURFACE.plank,
  [
    14138764,
    6901563,
    6379847,
    8807752,
    10848096,
    11638121,
    8480846,
    11506538
  ]
);
register(SURFACE.soil, [12954486, 13217146, 13744514, 9930595]);
register(
  SURFACE.sand,
  [15256199, 14795404, 15585176, 15124884, 12893316, 12298361]
);
register(SURFACE.snow, [15201002, 14149860, 15332590, 14084076, 14938342]);
register(
  SURFACE.gem,
  [3972003, 7528404, 11596518, 7559846, 12094422, 15121658, 4750208]
);
register(SURFACE.copper, [11101252, 12089168]);
register(SURFACE.cloud, [16381404, 9097675, 10806492, 7981516, 13037025]);

// src/world.ts
var dragonPerch = { x: 2, z: -47, elevation: 18 };
var TILE = 1;
var WATER = -0.16;
var sailingRadius = 216;
var sailingCenterZ = -3;
var sailingDistance = (x, z) => Math.hypot(x, z - sailingCenterZ);
var lavaChannel = (x, z) => Math.abs(x - 37 - 4 * Math.sin(z * 0.21)) < 1.1;
var basaltCrossing = (z) => Math.abs(z + 20) < 1.6 || Math.abs(z + 5) < 1.6 || Math.abs(z - 14) < 1.6;
var tileIndex = (value) => Math.floor(value / TILE);
var tileCenter = (value) => (value + 0.5) * TILE;
function noise(x, z, salt = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + salt * 1597334677;
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
var river = (z) => -15 + Math.sin(z * 0.064) * 5 + z * 0.05;
var trail = (z) => 2 + 3.2 * Math.sin(z * 0.109);
var coast = (x, z) => Math.hypot(x * 0.95, (z + 3) * 1.03) + 2.8 * Math.sin(x * 0.14) + 2 * Math.sin(z * 0.21);
function biome(x, z) {
  if (frontierAt(x, z))
    return frontierHeight(x, z) <= WATER ? "Ocean Frontier" : sector(sectorAt(x), sectorAt(z)).range.climate;
  const island2 = outerIslandAt(x, z);
  if (island2 && outerHeight(x, z, island2) > WATER) return island2.biome;
  if (z > 30 + 3 * Math.sin(x * 0.12) || coast(x, z) > 86)
    return "Ocean Frontier";
  if (z < -30 + 3 * Math.sin(x * 0.12)) return "Frozen Peaks";
  if (x < -25 + 3 * Math.cos(z * 0.13)) return "Crystal Valley";
  if (x > 27 + 3 * Math.cos(z * 0.13)) return "Lava Realm";
  return "Emerald Forest";
}
function height(x, z) {
  if (frontierAt(x, z)) return frontierHeight(x, z);
  const island2 = outerIslandAt(x, z);
  const edge = coast(x, z);
  if (edge > 92) return island2 ? outerHeight(x, z, island2) : -2.4;
  const rolls = Math.sin(x * 0.109 + z * 0.063) * 0.85 + Math.cos(z * 0.12 - x * 0.073) * 0.68;
  let h = 1.85 + rolls;
  for (const [px, pz, peak, steep, cap] of peaks) {
    const slope = peak - Math.hypot((x - px) * 0.92, z - pz) * steep + rolls;
    h = Math.max(h, Math.min(slope, cap ?? Infinity));
  }
  if (z > -30 && z < 38) {
    const distance = Math.abs(x - river(z));
    h = Math.min(h, -0.85 + Math.max(0, distance - 2.1) * 0.83);
  }
  h = Math.min(h, (91 - edge) * 0.47, 2.7 + Math.max(0, 36 - z) * 0.55);
  const mainHeight = Math.floor(h / 0.3) * 0.3;
  return island2 ? Math.max(mainHeight, outerHeight(x, z, island2)) : mainHeight;
}
var peaks = [
  [-32, -68, 26, 0.74],
  [20, -71, 31, 0.9],
  [62, -25, 19, 0.65],
  [-65, 16, 12, 0.55],
  [-16, -42, 17, 0.88],
  [dragonPerch.x, dragonPerch.z, 23, 1.05, dragonPerch.elevation],
  [17, -43, 16, 0.88],
  [-41, -18, 10, 0.65],
  [37, -15, 13, 0.83],
  [46, -25, 15, 0.97],
  [25, 12, 6, 0.62],
  [-36, 11, 7, 0.59]
];
function fluid(x, z) {
  if (frontierAt(x, z))
    return frontierHeight(tileCenter(tileIndex(x)), tileCenter(tileIndex(z))) <= WATER ? "water" : "land";
  if (Math.abs(z + 10) < 1.24 && Math.abs(x - river(-10)) < 4.61) return "land";
  if (height(tileCenter(tileIndex(x)), tileCenter(tileIndex(z))) <= WATER)
    return "water";
  const tx = tileCenter(tileIndex(x)), tz = tileCenter(tileIndex(z));
  if (biome(tx, tz) === "Lava Realm" && lavaChannel(tx, tz) && !basaltCrossing(tz))
    return "lava";
  return "land";
}
function ground(x, z) {
  const surface = Math.max(
    WATER,
    height(tileCenter(tileIndex(x)), tileCenter(tileIndex(z)))
  );
  if (Math.abs(z + 10) < 1.24 && Math.abs(x - river(-10)) < 4.61)
    return Math.max(surface, 1.45);
  return surface;
}
var grass = [9219928, 9285719, 8759892, 9548893, 8759891];
var meadow = [10271076, 10007904, 10403175, 10205537];
var palettes = {
  "Frozen Peaks": [15201002, 14149860, 15332590, 14084076],
  "Crystal Valley": [10326957, 9998498, 11248309, 11249068],
  "Lava Realm": [6314330, 6445147, 7102555, 6313558],
  "Ocean Frontier": [15256199, 14795404, 15585176, 15124884]
};
var pick = (colors, t) => colors[Math.floor(t * colors.length) % colors.length];
var island;
var layout = () => island ??= makeLayout();
var cellKey = (x, z) => Math.floor(x / 5) + "," + Math.floor(z / 5);
function walkable(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || fluid(x, z) === "lava")
    return false;
  if (frontierAt(x, z))
    return !sectorProps(sectorAt(x), sectorAt(z)).some(
      (p) => p.radius > 0 && Math.hypot(p.x - x, p.z - z) < p.radius + 0.24
    );
  const nearby = layout().obstacles.get(cellKey(x, z));
  return !nearby?.some(
    (b) => b.solid && x > b.left - 0.26 && x < b.right + 0.26 && z > b.back - 0.26 && z < b.front + 0.26
  );
}
function makeLayout() {
  const obstacles = /* @__PURE__ */ new Map();
  function obstacle(x, z, w, d, top, solid = true) {
    const b = {
      left: x - w / 2,
      right: x + w / 2,
      back: z - d / 2,
      front: z + d / 2,
      top,
      solid
    };
    for (let i = Math.floor((b.left - 0.26) / 5); i <= Math.floor((b.right + 0.26) / 5); i++)
      for (let j = Math.floor((b.back - 0.26) / 5); j <= Math.floor((b.front + 0.26) / 5); j++) {
        const key2 = i + "," + j;
        if (!obstacles.has(key2)) obstacles.set(key2, []);
        obstacles.get(key2).push(b);
      }
  }
  const chunks = /* @__PURE__ */ new Map();
  const waterChunks = /* @__PURE__ */ new Map();
  const glowChunks = /* @__PURE__ */ new Map();
  function add(x, y, z, w, h, d, color, rotation = 0, set = chunks) {
    const key2 = w > 800 ? "sea" : Math.floor(x / 20) + "," + Math.floor(z / 20);
    if (!set.has(key2)) set.set(key2, []);
    set.get(key2).push([x, y, z, w, h, d, color, rotation]);
  }
  function stack(x, y, z, w, h, d, color, rotation = 0) {
    add(x, y + h / 2, z, w, h, d, color, rotation);
  }
  const plants = [];
  function plant(model, x, y, z, size, yaw, solid = false) {
    plants.push({ model, x, y, z, size, yaw });
    if (solid) {
      obstacle(x, z, size * 0.11, size * 0.11, y + size * 0.6);
      obstacle(x, z, size * 0.48, size * 0.48, y + size, false);
    }
  }
  function crystal(x, z, y, s, n) {
    obstacle(x, z, 0.95 * s, 0.9 * s, y + 2.2 * s);
    const hue = n > 0.65 ? [3972003, 7528404, 11596518] : [7559846, 12094422, 15121658];
    stack(x, y, z, 0.95 * s, 0.34 * s, 0.9 * s, 7694976, 0.16);
    for (let k = 0; k < 3; k++) {
      const px = x + (k - 1) * s * 0.38, pz = z + Math.sin(k * 3) * s * 0.4, H = s * [1, 1.8, 0.77][k];
      stack(px, y + 0.17 * s, pz, 0.42 * s, H, 0.48 * s, hue[k % 2], 0.3 * k);
      stack(
        px,
        y + 0.17 * s + H,
        pz,
        0.25 * s,
        0.21 * s,
        0.29 * s,
        hue[2],
        0.3 * k
      );
    }
  }
  const townX = 10, townZ = -12;
  function isPath(x, z) {
    return z > -22 && z < 29 && Math.abs(x - trail(z)) < 1.9 || x > -32 && x < 14 && Math.abs(z + 10 + Math.sin(x * 0.18) * 0.45) < 2.1;
  }
  for (let i = -sailingRadius; i < sailingRadius; i++)
    for (let j = sailingCenterZ - sailingRadius; j < sailingCenterZ + sailingRadius; j++) {
      const x = tileCenter(i), z = tileCenter(j);
      const island2 = outerIslandAt(x, z);
      if (!island2 && (Math.abs(x) > 105 || Math.abs(z) > 103 || coast(x, z) > 96))
        continue;
      const h = height(x, z), n = noise(i, j), zone = biome(x, z);
      if (sailingDistance(x, z) > sailingRadius + 2) continue;
      if (h <= WATER) {
        if (island2 && h <= -1.5) continue;
        if (island2 || coast(x, z) < 92)
          add(x, h - 0.24, z, TILE, 0.48, TILE, 12298361);
        add(
          x,
          WATER - 0.12,
          z,
          TILE + 2e-3,
          0.24,
          TILE,
          coast(x, z) > 94 ? 4628399 : 6734013,
          0,
          waterChunks
        );
        if (n > 0.86)
          add(
            x,
            WATER + 0.016,
            z,
            0.46 + n * 0.65,
            0.018,
            0.08,
            11395024,
            0,
            waterChunks
          );
        continue;
      }
      const path = isPath(x, z), bank = h < 0.52 && Math.abs(x - river(z)) < 7, town = Math.hypot(x - townX, z - townZ) < 6;
      const cap = island2 && h < 0.9 ? pick(palettes["Ocean Frontier"], n) : path || town ? pick([12954486, 13217146, 13744514], n) : bank ? 12893316 : pick(
        palettes[zone] || (Math.sin(x * 0.14 + z * 0.15) > 0.45 ? meadow : grass),
        n
      );
      const neighbor = Math.min(
        height(x + TILE, z),
        height(x - TILE, z),
        height(x, z + TILE),
        height(x, z - TILE)
      );
      const bottom = Math.min(neighbor - 0.02, h - 0.25), side = zone === "Frozen Peaks" ? 8887195 : zone === "Crystal Valley" ? 7433088 : zone === "Lava Realm" ? 4801354 : 9930595;
      if (h - 0.19 > bottom)
        stack(x, bottom, z, TILE, h - 0.19 - bottom, TILE, side);
      add(x, h - 0.1, z, TILE + 1e-3, 0.2, TILE + 1e-3, cap);
      if (!path && !town && zone === "Emerald Forest" && h - neighbor > 0.5 && n > 0.56) {
        for (const [dx, dz] of [
          [1, 0],
          [0, 1]
        ]) {
          if (height(x + dx * TILE, z + dz * TILE) >= h - 0.45) continue;
          const shift = (noise(i, j, 73) - 0.5) * 0.92;
          add(
            x + dx * 0.8 + dz * shift,
            h - 0.21,
            z + dz * 0.8 + dx * shift,
            dx ? 0.055 : 0.41,
            0.15,
            dz ? 0.055 : 0.41,
            cap
          );
        }
      }
      if (zone === "Lava Realm" && lavaChannel(x, z)) {
        if (basaltCrossing(z))
          add(x, h + 0.015, z, TILE, 0.045, TILE, 6709866);
        else
          add(
            x,
            h + 0.012,
            z,
            TILE,
            0.04,
            TILE,
            pick([15238210, 16755796, 15299129], n),
            0,
            glowChunks
          );
        continue;
      }
      const prismClearing = Math.hypot(x + 38, z) < 2.8;
      if (path || town || habitats.some(
        ([, hx, hz]) => Math.hypot(hx - x, hz - z) < (island2 ? 6.5 : 2.5)
      ) || prismClearing || Math.abs(x + 6.4) < 3.5 && z >= -25 && z <= -14 || h === dragonPerch.elevation && Math.hypot(x - dragonPerch.x, z - dragonPerch.z) < 8 || fixtures.some(
        (f) => Math.abs(f.x - x) < (f.width || 1) / 2 + 1.2 && Math.abs(f.z - z) < (f.depth || 1) / 2 + 1.2
      ) || Math.hypot(x, z) < 4 || Math.abs(x) < 3 && z < 10 && z > -8)
        continue;
      const t = noise(i, j, 9), s = 0.68 + noise(i, j, 11) * 0.74;
      if (island2) {
        if (h < 0.6 || i % 3 || j % 3) continue;
        const yaw = t * Math.PI * 2;
        if (island2.name === "Bamboo Reach") {
          if (n > 0.7)
            plant(
              t > 0.4 ? "frontier-Bamboo" : "frontier-Bamboo_Small",
              x,
              h,
              z,
              (2.9 + t * 3) * s,
              yaw,
              true
            );
          else if (n < 0.2) plant("frontier-Mushroom", x, h, z, 0.7 * s, yaw);
        } else if (island2.name === "Rimehorn Isle") {
          if (n > 0.72 && h < 13) plant("Spruce", x, h, z, 5.2 * s, yaw, true);
          else if (n < 0.09) plant("frontier-Rock2", x, h, z, 1.5 * s, yaw);
        } else if (island2.name === "Amethyst Key") {
          if (n > 0.86) plant("frontier-Crystal_Big", x, h, z, 2.2 * s, yaw);
          else if (n < 0.08)
            plant("frontier-DeadTree_1", x, h, z, 3.1 * s, yaw, true);
        } else if (n > 0.84) plant("coast-palm", x, h, z, 5 * s, yaw, true);
        else if (n < 0.13) plant("coast-ferns", x, h, z, 1.4 * s, yaw);
        continue;
      }
      if (zone !== "Lava Realm" && (i % 2 !== 0 || j % 2 !== 0)) continue;
      if (zone === "Emerald Forest") {
        if (i % 3 === 0 && j % 3 === 0 && n > 0.38 && Math.hypot(x, z) > 7) {
          plant(
            t > 0.65 ? "Oak" : t > 0.28 ? "Birch" : "Hazel",
            x,
            h,
            z,
            (t > 0.28 ? 5.6 : 3.5) * s,
            t * 6.28,
            true
          );
        } else if (z > 12 && n > 0.79) {
          plant(
            t > 0.58 ? "Monstera" : "Bromeliad",
            x,
            h,
            z,
            s * (1 + t),
            t * 6.28
          );
        } else if (n > 0.82) {
          const species = t > 0.52 ? "flowers-1" : "flowers-2";
          plant(species, x, h, z, 0.55 + s * 0.32, t * 6.28);
          if (t > 0.8)
            plant(
              species,
              x + 0.54,
              ground(x + 0.54, z + 0.36),
              z + 0.36,
              0.52,
              -t * 3
            );
        } else if (n > 0.72) {
          for (let k = 0; k < 4; k++) {
            const a = k * Math.PI * 0.5 + t * 3, dx = Math.cos(a), dz = Math.sin(a);
            for (let tip = 0; tip < 3; tip++) {
              const reach = (0.11 + 0.14 * tip) * s;
              stack(
                x + dx * reach,
                h + (0.045 + Math.sin(tip * 0.9) * 0.16) * s,
                z + dz * reach,
                0.22 * s,
                0.076 * s,
                (0.17 - 0.038 * tip) * s,
                k % 2 ? 5733959 : 8431450,
                -a
              );
            }
          }
        } else if (n < 0.035) {
          obstacle(x, z, 0.72 * s, 0.65 * s, h + 0.39 * s);
          stack(x, h, z, 0.72 * s, 0.39 * s, 0.65 * s, 9147519);
          stack(
            x + 0.35 * s,
            h,
            z + 0.22 * s,
            0.49 * s,
            0.22 * s,
            0.46 * s,
            10791311
          );
        }
      } else if (zone === "Frozen Peaks") {
        if (i % 3 === 0 && j % 3 === 0 && n > 0.44 && h < 13)
          plant("Spruce", x, h, z, s * 6, t * 6.28, true);
        else if (n > 0.993) plant("berries", x, h, z, s, t * 6.28);
      } else if (zone === "Crystal Valley") {
        if (i % 6 === 0 && j % 6 === 0 && n > 0.66)
          crystal(x, z, h, s * (0.6 + t * 1.8), t);
        else if (i % 4 === 0 && j % 4 === 0 && n > 0.72)
          plant("Hazel", x, h, z, 2.8 * s, t * 6.28, true);
      } else if (zone === "Lava Realm") {
        if (n > 0.989) {
          plant("Agave", x, h, z, 1.25 * s, t * 6.28);
        } else if (n > 0.944) {
          obstacle(x, z, s * 0.65, s * 0.7, h + s * 0.98);
          stack(x, h, z, s * 0.65, s * 0.98, s * 0.7, 4736076);
          stack(x, h + s * 0.98, z, s * 0.54, 0.13, s * 0.55, 9659479);
        }
      } else if (n > 0.96 && z > 25) {
        plant("coast-palm", x, h, z, 5.7 * s, t * 6.28, true);
      } else if (z > 24 && n > 0.79) {
        plant(
          t > 0.62 ? "Monstera" : t > 0.3 ? "Bromeliad" : "coast-ferns",
          x,
          h,
          z,
          (1.1 + t) * s,
          t * 6.28
        );
      }
    }
  const fallsX = river(-30), fallsZ = -30.39, fallsHeight = ground(fallsX, -31);
  for (let k = 0; k < 6; k++) {
    const x = fallsX + (k - 2.5) * 0.54, top = ground(x, -31);
    stack(x, top - 0.015, -31.12, 0.55, 0.075, 1.49, 9097675);
    stack(
      x,
      WATER,
      fallsZ,
      0.57,
      top - WATER,
      0.2 + k % 2 * 0.09,
      k % 2 ? 10806492 : 7981516
    );
    add(x, 9e-3, fallsZ + 0.32, 0.63, 0.13, 0.72, 13037025);
  }
  const grottoX = -31, grottoZ = -5, grottoY = ground(grottoX, grottoZ);
  obstacle(grottoX, grottoZ, 5.9, 4.65, grottoY + 4.85, false);
  obstacle(grottoX, grottoZ - 2.25, 5.25, 0.85, grottoY + 3.9);
  for (const d of [-1, 1]) {
    obstacle(grottoX + d * 2.65, grottoZ, 1.55, 5.1, grottoY + 3.34);
    stack(grottoX + d * 2.65, grottoY - 1, grottoZ, 1.55, 4.34, 5.1, 7566458);
    stack(grottoX + d * 2.4, grottoY + 2.89, grottoZ, 2.1, 1.15, 4.9, 9341327);
  }
  stack(grottoX, grottoY + 3.69, grottoZ, 5.9, 0.95, 4.65, 9540236);
  stack(grottoX, grottoY + 4.64, grottoZ, 5.45, 0.21, 4.15, 10791315);
  stack(grottoX, grottoY - 0.55, grottoZ - 2.25, 5.25, 4.45, 0.85, 6711158);
  crystal(grottoX + 0.6, grottoZ - 0.7, grottoY, 1.22, 0.2);
  function lodge(x, z, s) {
    const y = ground(x, z);
    obstacle(x, z, 4.8 * s, 3.8 * s, y + 4.3 * s);
    stack(x, y - 0.7, z, 4.8 * s, 0.9 * s, 3.8 * s, 9342073);
    stack(x, y + 0.2 * s, z, 4.4 * s, 2.6 * s, 3.4 * s, 14138764);
    for (const dx of [-2, 2])
      for (const dz of [-1.6, 1.6])
        stack(
          x + dx * s,
          y + 0.2 * s,
          z + dz * s,
          0.25 * s,
          2.7 * s,
          0.28 * s,
          6901563
        );
    stack(x, y + 0.2 * s, z + 1.73 * s, 0.95 * s, 1.95 * s, 0.12 * s, 6379847);
    for (const dx of [-1.4, 1.4]) {
      stack(
        x + dx * s,
        y + 1.17 * s,
        z + 1.76 * s,
        0.61 * s,
        0.82 * s,
        0.1 * s,
        4750208
      );
      stack(
        x + dx * s,
        y + 1.09 * s,
        z + 1.8 * s,
        0.78 * s,
        0.12 * s,
        0.24 * s,
        8807752
      );
    }
    for (let k = 0; k < 5; k++)
      stack(
        x,
        y + (2.76 + k * 0.29) * s,
        z,
        5.2 * s,
        0.31 * s,
        (4.3 - k * 0.74) * s,
        k % 2 ? 11101252 : 12089168
      );
    stack(
      x + 1.42 * s,
      y + 3.2 * s,
      z - 0.55 * s,
      0.52 * s,
      1.7 * s,
      0.56 * s,
      8682861
    );
    stack(
      x + 0.77 * s,
      y + 1.73 * s,
      z + 1.9 * s,
      0.22 * s,
      0.3 * s,
      0.24 * s,
      16767364
    );
  }
  lodge(10, -14, 1.05);
  lodge(15, -9, 0.77);
  for (const f of fixtures) {
    if (f.width)
      obstacle(f.x, f.z, f.width, f.depth, ground(f.x, f.z) + f.size);
  }
  for (const x of [-8.6, -4.2])
    obstacle(x, -21, 0.85, 1.1, ground(x, -21) + 3.9);
  obstacle(-6.4, -21, 5.4, 1.1, ground(-6.4, -21) + 4.3, false);
  const bridgeZ = -10, bridgeX = river(bridgeZ), bridgeY = 1.25;
  for (let k = -6; k <= 6; k++) {
    stack(
      bridgeX + k * 0.71,
      bridgeY,
      bridgeZ,
      0.67,
      0.2,
      2.45,
      k % 2 ? 10848096 : 11638121
    );
    if (k % 3 === 0)
      for (const side of [-1, 1])
        stack(
          bridgeX + k * 0.71,
          bridgeY,
          bridgeZ + side * 1.18,
          0.17,
          1.06,
          0.17,
          8480846
        );
  }
  for (const side of [-1, 1])
    obstacle(bridgeX, bridgeZ + side * 1.18, 8.7, 0.13, bridgeY + 1.06);
  for (const side of [-1, 1])
    stack(
      bridgeX,
      bridgeY + 0.84,
      bridgeZ + side * 1.18,
      8.7,
      0.16,
      0.13,
      11506538
    );
  const buoyCount = 8;
  for (let i = 0; i < buoyCount; i++) {
    const angle = i * Math.PI * 2 / buoyCount, x = sailingRadius * Math.cos(angle), z = sailingCenterZ + sailingRadius * Math.sin(angle);
    stack(x, WATER - 0.12, z, 0.78, 0.35, 0.78, 15234354);
    stack(x, WATER + 0.23, z, 0.42, 0.42, 0.42, 16773088);
    stack(x, WATER + 0.65, z, 0.36, 0.27, 0.36, 15234354);
  }
  add(0, WATER - 0.105, 0, 880, 0.15, 880, 4628399, 0, waterChunks);
  for (let k = 0; k < 22; k++) {
    const angle = k * 2.39996, distance = 87 + noise(k, 42) * 62;
    const cx = Math.cos(angle) * distance, cz = Math.sin(angle) * distance;
    const cy = 21 + noise(k, 51) * 16, scale = 1 + noise(k, 60) * 1.8;
    for (let p = 0; p < 3; p++)
      add(
        cx + p * 2.7 * scale,
        cy + Math.sin(p * 2) * scale,
        cz + p * 0.7,
        5.2 * scale,
        1.1 * scale,
        2.4 * scale,
        16381404
      );
  }
  return {
    plants,
    chunks,
    waterChunks,
    glowChunks,
    obstacles,
    fallsX,
    fallsZ,
    fallsHeight
  };
}

// server/missions.ts
function survey(p, x, z) {
  const seen = p.regions ??= [];
  const zone = biome(x, z);
  if (seen.includes(zone)) return false;
  seen.push(zone);
  return true;
}
function missions(p, now = /* @__PURE__ */ new Date()) {
  const today = now.toISOString().slice(0, 10), week = Math.floor((now.valueOf() + 3 * 864e5) / (7 * 864e5));
  return [
    {
      id: "survey",
      name: "Island cartographer",
      description: "Visit all five regions",
      progress: p.regions?.length || 0,
      target: 5,
      reward: 6
    },
    {
      id: "species",
      name: "Field naturalist",
      description: "Own five different species",
      progress: new Set(p.collection.map((b) => b.name)).size,
      target: 5,
      reward: 5
    },
    {
      id: "day-" + today,
      name: "Daily expedition",
      description: "Capture two beasts today (UTC)",
      progress: p.captures?.[today] || 0,
      target: 2,
      reward: 2
    },
    {
      id: "week-" + week,
      name: "Weekly contender",
      description: "Win three arena duels this week (UTC)",
      progress: p.weeklyWins?.[week] || 0,
      target: 3,
      reward: 8
    }
  ].map((m) => ({
    ...m,
    progress: Math.min(m.progress, m.target),
    claimed: p.claimed?.includes(m.id) || false
  }));
}
function claim(p, id) {
  const m = missions(p).find((v) => v.id === id);
  if (!m || m.claimed || m.progress < m.target) return false;
  (p.claimed ??= []).push(id);
  p.shards += m.reward;
  return true;
}
function win(p) {
  const id = Math.floor((Date.now() + 3 * 864e5) / (7 * 864e5));
  p.weeklyWins = { [id]: (p.weeklyWins?.[id] || 0) + 1 };
}
function capture(p) {
  const id = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  p.captures = { [id]: (p.captures?.[id] || 0) + 1 };
}

// server/market.ts
import { randomUUID as randomUUID2 } from "node:crypto";
var MarketError = class extends Error {
};
function marketplace(query, read, save) {
  return {
    async browse(token2) {
      const { rows } = await query(
        `SELECT l.id, l.seller, l.beast, l.price, l.currency, p.data
         FROM listings l JOIN profiles p ON p.token = l.seller
         ORDER BY l.posted DESC LIMIT 80`
      );
      return {
        listings: rows.flatMap((offer) => {
          const seller = offer.data;
          const beast2 = seller.collection.find((b) => b.id === offer.beast);
          return beast2 ? [
            {
              id: offer.id,
              seller: seller.name,
              mine: offer.seller === token2,
              beast: beast2,
              price: offer.price,
              currency: offer.currency
            }
          ] : [];
        }),
        history: (await query(
          "SELECT species, price, sold_at::float8, currency FROM sales ORDER BY sold_at DESC LIMIT 10"
        )).rows
      };
    },
    async change(token2, type, data) {
      const me = await read(token2);
      if (type === "list") {
        const currency = data?.currency ?? "shards";
        if (!data || !["shards", "WILD"].includes(currency) || !Number.isSafeInteger(data.price) || data.price < 1 || data.price > 999 || !me.collection.some((b) => b.id === data.beast) || me.active === data.beast)
          throw new MarketError(
            "Select an owned reserve beast and a price from 1 to 999."
          );
        const { rows } = await query(
          `INSERT INTO listings(id, seller, beast, price, currency)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (beast) DO NOTHING RETURNING id`,
          [randomUUID2(), token2, data.beast, data.price, currency]
        );
        if (!rows.length) throw new MarketError("Beast already listed.");
        return;
      }
      if (typeof data !== "string") throw new MarketError("Listing closed.");
      const {
        rows: [offer]
      } = await query("SELECT * FROM listings WHERE id=$1", [data]);
      if (!offer) throw new MarketError("Listing closed.");
      if (type === "unlist") {
        if (offer.seller !== token2)
          throw new MarketError("Only the seller can withdraw this listing.");
      } else {
        const seller = await read(offer.seller);
        const index = seller.collection.findIndex((b) => b.id === offer.beast);
        const balance = offer.currency === "WILD" ? "wild" : "shards";
        if (offer.seller === token2 || index < 0 || seller.active === offer.beast || (me[balance] ?? 0) < offer.price)
          throw new MarketError("This purchase could not be completed.");
        const [beast2] = seller.collection.splice(index, 1);
        me[balance] = (me[balance] ?? 0) - offer.price;
        seller[balance] = (seller[balance] ?? 0) + offer.price;
        beast2.history.push("Traded to " + me.name);
        me.collection.push(beast2);
        await save(token2, me);
        await save(offer.seller, seller);
        await query("INSERT INTO sales VALUES ($1, $2, $3, $4, $5)", [
          offer.id,
          beast2.name,
          offer.price,
          Date.now(),
          offer.currency
        ]);
      }
      await query("DELETE FROM listings WHERE id=$1", [data]);
    },
    async listed(id) {
      return !!(await query("SELECT 1 FROM listings WHERE beast=$1", [id])).rows.length;
    }
  };
}

// server/world.ts
import { randomBytes as randomBytes3, randomInt as randomInt2, randomUUID as randomUUID3 } from "node:crypto";

// server/spawn.ts
var clearance = 3;
var spacing = 4;
function openSpawn(anchor, occupied, resume = false) {
  const [ax, az] = anchor;
  const vacant = (x, z) => occupied.every((p) => (p.x - x) ** 2 + (p.z - z) ** 2 >= clearance ** 2);
  if (resume && vacant(ax, az)) return anchor;
  for (let ring = 0; ring <= 32; ring++) {
    const count = Math.max(1, 8 * ring);
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2;
      const x = ax + Math.round(Math.cos(angle) * ring * spacing);
      const z = az - Math.round(Math.sin(angle) * ring * spacing);
      if (vacant(x, z) && walkable(x, z) && fluid(x, z) === "land")
        return [x, z];
    }
  }
}

// server/world.ts
function beast(name) {
  const roll = randomInt2(1e3);
  return {
    id: randomUUID3(),
    name,
    variant: randomInt2(65536),
    rarity: rarities[[580, 830, 950, 990, 998, 1e3].findIndex((n) => roll < n)],
    level: 1,
    xp: 0,
    stage: 1,
    personality: ["Curious", "Bold", "Patient", "Playful"][randomInt2(4)],
    history: ["Discovered on the island"]
  };
}
var WorldError = class extends Error {
  status;
  constructor(message, status) {
    super(message);
    this.status = status;
  }
};
var guestActions = /* @__PURE__ */ new Set([
  "move",
  "ferry",
  "encounter",
  "study",
  "capture"
]);
var guestReconnectWindow = 30 * 60 * 1e3;
var liveWindow = 30 * 1e3;
async function openWorld(query, scope) {
  const peerRows = await (scope ? query("SELECT state FROM world_peers WHERE token=$1", [scope.token]) : query("SELECT state FROM world_peers"));
  let state = {};
  if (!scope || !scope.readOnly && scope.guest) {
    const {
      rows: [row]
    } = await query("SELECT state FROM world WHERE id=1");
    if (!row) throw Error("The WildHatch world migration is missing.");
    state = row.state;
  }
  const savedPeers = peerRows.rows.map((row) => row.state);
  const peers = new Map(
    savedPeers.map((p) => [p.t, { ...p, spent: new Set(p.spent) }])
  );
  const duels = new Map(
    (scope ? [] : state.duels ?? []).map((d) => [
      d.id,
      { ...d, peers: d.peers.map((t) => peers.get(t)) }
    ])
  );
  const guestSessions = new Map(state.guests ?? []);
  const raids = createRaids(state.raids);
  function snapshot() {
    return {
      duels: [...duels.values()].map((d) => ({
        ...d,
        peers: d.peers.map((p) => p.t)
      })),
      guests: [...guestSessions],
      raids: raids.snapshot()
    };
  }
  const previousPeers = new Map(
    savedPeers.map((p) => [p.t, JSON.stringify(p)])
  );
  const previousState = JSON.stringify(scope ? state : snapshot());
  const { read, save, signedIn } = profiles(query);
  const market = marketplace(query, read, save);
  let changed = false;
  function send(p, type, data) {
    if (type === "profile") {
      const previous = p.events.find((event) => event.type === "profile");
      if (previous) p.events.splice(p.events.indexOf(previous), 1);
    }
    p.events.push({ seq: ++p.seq, type, data: structuredClone(data) ?? null });
    if (type === "position" || type === "ferry") p.repositionSeq = p.seq;
    if (p.events.length > 48) p.events.shift();
    changed = true;
  }
  async function active(p) {
    const a = await read(p.t);
    return a.collection.find((b) => b.id === a.active);
  }
  async function startDuel(first, second) {
    const pair = [first, second];
    const beasts = await Promise.all(pair.map(active));
    const stats = beasts.map(beastStats);
    const max = stats.map((b) => b.health);
    const d = {
      id: randomUUID3(),
      peers: pair,
      hp: [...max],
      max,
      turn: stats[1].speed + beasts[1].level > stats[0].speed + beasts[0].level ? 1 : 0,
      guard: [false, false],
      burn: [0, 0],
      log: ["The duel begins."],
      expires: Date.now() + 45e3
    };
    for (const p of pair) {
      p.queue = false;
      p.invitation = void 0;
      p.encounter = null;
      p.battle = d.id;
    }
    duels.set(d.id, d);
    await battleView(d);
  }
  async function battleView(d) {
    const names = await Promise.all(d.peers.map(active));
    d.peers.forEach(
      (p, i) => send(p, "battle", {
        names,
        players: d.peers.map((q) => q.name),
        hp: d.hp,
        max: d.max,
        turn: d.turn,
        you: i,
        log: d.log,
        guard: d.guard,
        lastMove: d.lastMove,
        burn: d.burn,
        expires: d.expires
      })
    );
  }
  async function finish(d, winner, knockout = false) {
    const p = await read(d.peers[winner].t);
    p.wins++;
    p.rangerXp = (p.rangerXp ?? 0) + 15;
    win(p);
    p.shards += 3;
    const wildReward2 = knockout ? 12 : 0;
    p.wild = (p.wild ?? 0) + wildReward2;
    const b = p.collection.find((b2) => b2.id === p.active);
    b.xp += 4;
    b.history.push("Won an arena duel");
    await save(d.peers[winner].t, p);
    await query("INSERT INTO battles VALUES ($1, $2)", [
      d.id,
      JSON.stringify({ winner: d.peers[winner].id, log: d.log })
    ]);
    for (const [i, p2] of d.peers.entries()) {
      p2.battle = null;
      send(
        p2,
        "end",
        i === winner ? "Victory \xB7 +3 shards" + (knockout ? " \xB7 +12 WILD" : "") : "Defeat"
      );
      send(p2, "profile", await read(p2.t));
    }
    duels.delete(d.id);
  }
  async function checkpointPlayer(p, profile) {
    profile.frontierPosition = frontierAt(p.x, p.z) ? [p.x, p.z] : void 0;
    if (p.mode !== "guest") await save(p.t, profile);
    p.lastCheckpoint = Date.now();
  }
  async function leave(p) {
    if (p.battle) {
      const d = duels.get(p.battle);
      await finish(d, 1 - d.peers.indexOf(p));
    }
    if (p.zone) {
      const current = p.mode === "guest" ? guestSessions.get(p.t)?.profile : await read(p.t);
      if (current && (frontierAt(p.x, p.z) || current.frontierPosition))
        await checkpointPlayer(p, current);
    }
    const guest = guestSessions.get(p.t);
    if (guest) guest.expires = Date.now() + guestReconnectWindow;
    peers.delete(p.t);
    changed = true;
  }
  async function tick() {
    const now = Date.now();
    for (const d of duels.values()) {
      if (d.expires <= now) await finish(d, 1 - d.turn);
    }
    for (const p of peers.values()) {
      if (now - p.touched > liveWindow || p.mode === "guest" && !guestSessions.has(p.t))
        await leave(p);
    }
    for (const [id, guest] of guestSessions) {
      if (guest.expires <= now && !peers.has(id)) {
        guestSessions.delete(id);
        changed = true;
      }
    }
  }
  function peer(t, client) {
    const p = peers.get(t);
    if (!p || p.client !== client || Date.now() - p.touched > liveWindow) {
      throw new WorldError("Your expedition connection expired.", 410);
    }
    return p;
  }
  async function join(t, mode, client, choice) {
    const profile = mode === "guest" ? void 0 : await signedIn(t);
    if (mode !== "guest" && !profile)
      throw new WorldError("Sign in with your Solana wallet.", 401);
    const current = peers.get(t);
    if (current) {
      if (current.client !== client)
        throw new WorldError("You are already playing in another tab.", 409);
      if (current.mode !== mode) await leave(current);
      else {
        const after = current.seq;
        current.touched = Date.now();
        if (mode === "guest") current.ranger = guestRanger(t);
        else {
          const id = choice ?? current.ranger ?? starterRangers[0];
          current.ranger = ownsRanger(id, profile?.unlockedRangers) ? id : starterRangers[0];
        }
        send(current, "joined", current.id);
        send(current, "profile", guestSessions.get(t)?.profile ?? profile);
        if (current.zone) send(current, "position", [current.x, current.z]);
        send(
          current,
          "habitats",
          current.wild.map((b) => b.variant)
        );
        if (current.battle) await battleView(duels.get(current.battle));
        return { peer: current, after };
      }
    }
    let guestProfile;
    if (mode === "guest") {
      guestProfile = guestSessions.get(t)?.profile;
      if (!guestProfile) {
        let name;
        do {
          name = "Guest " + randomInt2(1e4, 1e5);
        } while ([...guestSessions.values()].some((s) => s.profile.name === name));
        guestProfile = {
          name,
          orbs: 3,
          shards: 0,
          wins: 0,
          collection: [],
          active: ""
        };
      }
      guestSessions.set(t, {
        profile: guestProfile,
        expires: Date.now() + guestReconnectWindow
      });
    }
    const initial = guestProfile ?? profile;
    const zone = mode === "pvp" ? 0 : 1;
    const checkpoint = initial.frontierPosition;
    const resume = !!(checkpoint && frontierAt(...checkpoint) && walkable(...checkpoint));
    const spawn = zone ? openSpawn(
      resume ? checkpoint : [0, 0],
      [...peers.values()].filter((q) => q.zone === zone),
      resume
    ) : [0, 0];
    if (!spawn) {
      if (guestProfile)
        guestSessions.set(t, {
          profile: guestProfile,
          expires: Date.now() + guestReconnectWindow
        });
      throw new WorldError("The arrival area is full. Try again.", 503);
    }
    const p = {
      name: initial.name,
      ranger: mode === "guest" ? guestRanger(t) : choice !== void 0 && ownsRanger(choice, profile?.unlockedRangers) ? choice : starterRangers[0],
      mode,
      client,
      touched: Date.now(),
      seq: 0,
      events: [],
      wild: habitats.map((h) => beast(h[0])),
      studied: false,
      lastCheckpoint: 0,
      count: 0,
      windowStart: Date.now(),
      t,
      id: randomUUID3(),
      x: spawn[0],
      z: spawn[1],
      yaw: 0,
      last: Date.now(),
      zone,
      cool: 0,
      queue: false,
      encounter: null,
      spent: /* @__PURE__ */ new Set(),
      battle: null
    };
    peers.set(t, p);
    send(p, "joined", p.id);
    send(p, "profile", initial);
    if (zone) send(p, "position", spawn);
    send(
      p,
      "habitats",
      p.wild.map((b) => b.variant)
    );
    return { peer: p, after: 0 };
  }
  function encounterOffer(p, i, profile) {
    const b = p.discovery;
    const base = i < habitats.length ? Math.max(32, 74 - i * 3) : 48 + Math.floor(sample(i, 1, 9) * 16);
    const rarityPenalty = 2 * Math.max(0, rarities.indexOf(b.rarity));
    const chance = Math.min(
      90,
      base - rarityPenalty + (p.studied ? 8 : 0) + ((profile.charms ?? 0) > 0 ? 10 : 0)
    );
    return {
      index: i,
      variant: b.variant,
      personality: b.personality,
      rarity: b.rarity,
      studied: p.studied,
      base,
      rarityPenalty,
      chance,
      focusChance: Math.min(90, chance + 10)
    };
  }
  async function action(p, type, data, after) {
    const t = p.t;
    const guestProfile = guestSessions.get(t)?.profile;
    if (p.mode === "guest" && !guestProfile)
      throw new WorldError("Your expedition connection expired.", 410);
    const time = Date.now();
    if (time - p.windowStart > 1e3) {
      p.windowStart = time;
      p.count = 0;
    }
    if (++p.count > 40)
      throw new WorldError("Too many actions. Try again shortly.", 429);
    p.touched = time;
    changed = true;
    if (guestProfile && !guestActions.has(type)) return;
    if (!p.zone && [
      "move",
      "encounter",
      "study",
      "capture",
      "ferry",
      "boss",
      "bossStrike",
      "supply"
    ].includes(type))
      return;
    const now = Date.now(), a = guestProfile ?? await read(t);
    if (type === "move") {
      if (p.mode !== "guest" && Number.isInteger(data.ranger))
        p.ranger = ownsRanger(data.ranger, a.unlockedRangers) ? data.ranger : starterRangers[0];
      if (p.battle || after < (p.repositionSeq ?? 0)) return;
      const { x, z, yaw } = data;
      const elapsed = Math.max(0, Math.min(9, (now - p.last) / 1e3));
      let remaining = (p.moveCredit ?? 2) + 12 * elapsed;
      let fromX = p.x, fromZ = p.z;
      for (const [toX, toZ] of [...data.path ?? [], [x, z]]) {
        const dx = toX - fromX, dz = toZ - fromZ;
        const distance = Math.hypot(dx, dz);
        if (distance > remaining) {
          send(p, "position", [p.x, p.z]);
          return;
        }
        const steps = Math.ceil(distance / 0.4);
        for (let step = 1; step <= steps; step++) {
          if (!walkable(fromX + dx * step / steps, fromZ + dz * step / steps)) {
            send(p, "position", [p.x, p.z]);
            return;
          }
        }
        remaining -= distance;
        fromX = toX;
        fromZ = toZ;
      }
      Object.assign(p, {
        x,
        z,
        yaw,
        last: now,
        moveCredit: Math.min(remaining, 3)
      });
      if (!guestProfile && survey(a, x, z) || (frontierAt(x, z) || a.frontierPosition) && now - p.lastCheckpoint > 6e3)
        await checkpointPlayer(p, a);
      return;
    }
    if (type === "missions") {
      send(p, "missions", missions(a));
      return;
    }
    if (type === "market") {
      send(p, "market", await market.browse(t));
      return;
    }
    if (type === "encounter" && !p.battle) {
      if (!Number.isInteger(data)) return;
      const h = habitatAt(data);
      if (!h || p.spent.has(data) || Math.hypot(p.x - h[1], p.z - h[2]) > 7)
        return;
      p.studied = false;
      p.discovery = p.wild[data] ?? beast(h[0]);
      if (!p.wild[data]) {
        p.discovery.variant = Math.floor(sample(data, 0, 31) * 65536);
        const roll = sample(data, 0, 32) * 1e3;
        p.discovery.rarity = rarities[[580, 830, 950, 990, 998, 1e3].findIndex((n) => roll < n)];
        p.discovery.personality = ["Curious", "Bold", "Patient", "Playful"][Math.floor(sample(data, 0, 33) * 4)];
      }
      p.encounter = data;
      send(p, "encounter", encounterOffer(p, data, a));
      return;
    }
    if (type === "study" && !p.battle && p.encounter !== null) {
      const i = p.encounter;
      const h = habitatAt(i);
      if (Math.hypot(p.x - h[1], p.z - h[2]) <= 7) {
        p.studied = true;
        send(p, "encounter", encounterOffer(p, i, a));
      }
      return;
    }
    const shop = type === "buyOrbs" || type === "openCache";
    if (!shop && now < p.cool) {
      if (type === "capture")
        send(p, "captureUnavailable", "Your orb is recharging. Try again.");
      else send(p, "notice", "Action is recharging. Try again in a moment.");
      return;
    }
    if (!shop) p.cool = now + 250;
    if (type === "ferry" && !p.battle && !p.queue) {
      const camp = ferryCamp(p.x, p.z);
      if (!camp.ready) {
        send(p, "notice", "Use the ferry at the trailhead or a frontier camp.");
        return;
      }
      if (!camp.frontier) {
        const h = habitatAt(siteId(2, 0, 0));
        p.x = h[1] - 3;
        p.z = h[2] + 2;
      } else {
        p.x = 0;
        p.z = 0;
      }
      p.encounter = null;
      p.last = now;
      p.moveCredit = 2;
      await checkpointPlayer(p, a);
      send(p, "ferry", [p.x, p.z]);
      return;
    }
    if (type === "queue" && !p.battle) {
      p.queue = !p.queue;
      p.invitation = void 0;
      const other = [...peers.values()].find(
        (q) => q !== p && q.queue && q.zone === p.zone
      );
      if (other && p.queue) await startDuel(other, p);
      else send(p, "queue", p.queue);
      return;
    }
    if (!p.battle && type === "inviteCreate") {
      p.queue = false;
      p.invitation = {
        code: randomBytes3(5).toString("hex").toUpperCase(),
        expires: now + 3e5
      };
      send(p, "invite", p.invitation);
      return;
    }
    if (!p.battle && type === "inviteCancel") {
      p.invitation = void 0;
      send(p, "invite", null);
      return;
    }
    if (!p.battle && type === "inviteJoin") {
      const code = typeof data === "string" && data.trim().toUpperCase();
      const host = [...peers.values()].find(
        (q) => q !== p && q.mode === p.mode && !q.battle && q.invitation && q.invitation.expires > now && q.invitation.code === code
      );
      if (host) await startDuel(host, p);
      else send(p, "notice", "Invite code is invalid or expired.");
      return;
    }
    if (p.battle) {
      if (type !== "attack" || !["Strike", "Pulse", "Guard", "Scorch"].includes(data))
        return;
      const d = duels.get(p.battle), i = d.peers.indexOf(p), j = 1 - i;
      if (i !== d.turn) return;
      const b = await active(p), foe = await active(d.peers[j]);
      const strong = {
        Fire: "Nature",
        Nature: "Water",
        Water: "Fire",
        Ice: "Crystal",
        Crystal: "Ice"
      };
      let damage = 0;
      if (data === "Guard") d.guard[i] = true;
      else {
        damage = beastStats(b).attack - beastStats(foe).defense + (data === "Pulse" ? strong[elements[b.name]] === elements[foe.name] ? 6 : 1 : data === "Strike" ? 3 : 0);
        if (d.guard[j]) damage = Math.ceil(damage / 2);
        d.guard[j] = false;
        if (data === "Scorch") d.burn[j] = 2;
      }
      if (d.burn[j] > 0) {
        damage += 2;
        d.burn[j]--;
      }
      d.hp[j] = Math.max(0, d.hp[j] - damage);
      d.lastMove = { actor: i, name: data, damage };
      d.log.push(b.name + " used " + data + " \xB7 " + damage + " damage");
      d.turn = j;
      d.expires = now + 45e3;
      await battleView(d);
      if (!d.hp[j]) await finish(d, i, true);
      return;
    }
    if (type === "boss" || type === "bossStrike") {
      if (Math.hypot(p.x + 6.4, p.z + 21) > 8) {
        send(p, "notice", "Find the ruined arch at X -6, Z -21.");
        return;
      }
      if (type === "bossStrike") {
        const result = raids.attack(p.zone, t, (await active(p)).level);
        if (result) {
          for (const token2 of result.winners) {
            const profile = await read(token2);
            profile.shards += 5;
            await save(token2, profile);
          }
          await query("INSERT INTO battles VALUES ($1, $2)", [
            result.id,
            JSON.stringify({
              kind: "Green Dragon",
              participants: result.winners.length
            })
          ]);
        }
        for (const q of peers.values())
          if (q.zone === p.zone && q !== p) {
            send(q, "bossUpdate", raids.state(q.zone, q.t));
            if (result && q.mode !== "guest")
              send(q, "profile", await read(q.t));
          }
        if (result) send(p, "profile", await read(t));
      }
      send(p, "boss", raids.state(p.zone, t));
      return;
    }
    if (["list", "buy", "unlist"].includes(type)) {
      try {
        await market.change(t, type, data);
        for (const q of peers.values()) {
          if (q.mode === "guest") continue;
          send(q, "profile", await read(q.t));
          send(q, "marketChanged", null);
        }
        send(p, "market", await market.browse(t));
      } catch (error) {
        if (!(error instanceof MarketError)) throw error;
        send(p, "notice", error.message);
      }
      return;
    }
    if (type === "capture") {
      const i = p.encounter;
      if (guestProfile && data === "focus") {
        send(
          p,
          "captureUnavailable",
          "Guest practice uses one Jade orb per throw."
        );
        return;
      }
      const cost = data === "focus" ? 2 : 1;
      if (i === null || a.orbs < cost || Math.hypot(p.x - habitatAt(i)[1], p.z - habitatAt(i)[2]) > 7) {
        send(
          p,
          "captureUnavailable",
          "Move closer to the habitat with a capture orb."
        );
        return;
      }
      p.encounter = null;
      a.orbs -= cost;
      const odds = encounterOffer(p, i, a);
      if (a.charms) a.charms--;
      if (randomInt2(100) < (cost === 2 ? odds.focusChance : odds.chance)) {
        const b = p.discovery;
        if (!guestProfile) {
          a.collection.push(b);
          p.spent.add(i);
          capture(a);
          a.rangerXp = (a.rangerXp ?? 0) + 10;
        }
        send(p, "caught", { index: i, beast: b, practice: !!guestProfile });
      } else send(p, "escaped", { index: i, cost });
    } else if (type === "claim") {
      if (!claim(a, data)) return;
      send(p, "missions", missions(a));
    } else if (type === "supply") {
      if (!ferryCamp(p.x, p.z).ready) {
        send(
          p,
          "notice",
          "Visit the trailhead or a frontier camp for supplies."
        );
        return;
      }
      a.orbs = Math.max(a.orbs, 8);
      send(p, "notice", "Capture orbs replenished");
    } else if (type === "buyOrbs" || type === "openCache") {
      const item = type === "buyOrbs" ? "orbs" : data;
      if (!isWildItem(item)) return;
      const { cost } = wildItems[item];
      if ((a.wild ?? 0) < cost || item !== "charm" && a.orbs > 95) {
        send(
          p,
          "notice",
          "Check your WILD and available space for up to four orbs."
        );
        return;
      }
      const reward = wildReward(item, randomInt2(100));
      a.wild = (a.wild ?? 0) - cost;
      grantWildReward(
        a,
        reward,
        item === "trail" || item === "prism" ? randomInt2(2 ** 32) : void 0
      );
      await save(t, a);
      send(p, "profile", a);
      if (item === "charm")
        send(p, "notice", "Focus Charm ready for your next wild throw.");
      else if (item === "orbs")
        send(p, "notice", "Four orbs added to your pack.");
      else send(p, "cacheOpened", { ...reward, kind: item });
      return;
    } else if (type === "breed") {
      if (!Array.isArray(data) || data.length !== 2 || data[0] === data[1])
        return;
      const parents = data.map((id) => a.collection.find((b) => b.id === id));
      if ((await Promise.all(
        parents.map(
          async (b) => !b || (b.breedAfter || 0) > now || (b.offspring || 0) >= 3 || await market.listed(b.id)
        )
      )).some(Boolean) || a.shards < 2) {
        send(
          p,
          "notice",
          "Breeding requires two eligible parents and two shards."
        );
        return;
      }
      const [first, second] = parents;
      const child = {
        ...first,
        id: randomUUID3(),
        stage: 1,
        level: 1,
        xp: 0,
        rarity: "Normal",
        variant: first.variant & 65280 | second.variant & 255,
        parents: [first.id, second.id],
        marking: void 0,
        mutation: inheritedMutation(first.name, second.name),
        personality: second.personality,
        history: ["Bred from " + first.name + " and " + second.name],
        offspring: 0,
        breedAfter: now + 864e5
      };
      for (const parent of [first, second]) {
        parent.offspring = (parent.offspring || 0) + 1;
        parent.breedAfter = now + 864e5;
      }
      a.shards -= 2;
      a.collection.push(child);
      a.rangerXp = (a.rangerXp ?? 0) + 10;
      send(p, "notice", child.name + " hatched with inherited traits.");
    } else if (type === "train" || type === "evolve" || type === "active" || type === "marking") {
      const b = a.collection.find(
        (c) => c.id === (type === "marking" ? data?.id : data)
      );
      if (!b) return;
      if (await market.listed(b.id)) {
        send(p, "notice", "Withdraw the listing first.");
        return;
      }
      if (type === "marking") {
        if (!["None", "Amber", "Jade", "Violet"].includes(data.marking)) return;
        b.marking = data.marking;
      } else if (type === "active") a.active = b.id;
      else if (type === "train") {
        if (a.shards < 1) {
          send(p, "notice", "Win an arena duel for more shards.");
          return;
        }
        a.shards--;
        b.level++;
        a.rangerXp = (a.rangerXp ?? 0) + 3;
        b.history.push("Trained to level " + b.level);
      } else {
        if (b.level < 3 || b.stage >= 2) {
          send(
            p,
            "notice",
            "Evolution requires level 3 and a first-stage beast."
          );
          return;
        }
        b.stage = 2;
        a.rangerXp = (a.rangerXp ?? 0) + 10;
        b.history.push("Evolved on the island");
        send(p, "notice", b.name + " evolved!");
      }
    } else return;
    if (!guestProfile) await save(t, a);
    send(p, "profile", a);
  }
  async function view(p, after, includePresence) {
    let presence;
    if (p.zone && includePresence) {
      const { rows } = await query(
        `SELECT q.state->>'id' AS id, q.state->>'name' AS name, q.x, q.z,
                (q.state->>'yaw')::float8 AS yaw, q.state->>'mode'='guest' AS guest,
                coalesce((q.state->>'ranger')::int, 0) AS ranger,
                (SELECT beast FROM jsonb_array_elements(a.data->'collection') beast
                 WHERE beast->>'id'=a.data->>'active' LIMIT 1) AS beast
         FROM world_peers q LEFT JOIN profiles a ON a.token=q.token
         WHERE q.token<>$1 AND q.zone=$2 AND q.touched>=$3 AND
               q.x BETWEEN $4::float8 - 64 AND $4::float8 + 64 AND
               q.z BETWEEN $5::float8 - 64 AND $5::float8 + 64 AND
               (q.x-$4)^2 + (q.z-$5)^2 <= 4096`,
        [p.t, p.zone, Date.now() - liveWindow, p.x, p.z]
      );
      presence = rows;
    }
    return {
      cursor: p.seq,
      events: p.events.filter((event) => event.seq > after),
      ...presence ? { presence } : {}
    };
  }
  function heartbeat(p, after) {
    if (Date.now() - p.touched > 4e3) {
      p.touched = Date.now();
      p.events = p.events.filter((event) => event.seq > after);
      changed = true;
    }
  }
  function updateProfile(token2, profile) {
    const p = peers.get(token2);
    if (p) {
      p.name = profile.name;
      send(p, "profile", profile);
    }
  }
  async function commit(wake) {
    if (!changed) return;
    for (const [token2, p] of peers) {
      const current = JSON.stringify({ ...p, spent: [...p.spent] });
      if (current !== previousPeers.get(token2))
        await query(
          "INSERT INTO world_peers(token, state) VALUES ($1, $2) ON CONFLICT (token) DO UPDATE SET state=excluded.state",
          [token2, current]
        );
    }
    for (const token2 of previousPeers.keys()) {
      if (!peers.has(token2))
        await query("DELETE FROM world_peers WHERE token=$1", [token2]);
    }
    const meta = JSON.stringify(scope ? state : snapshot());
    if (meta !== previousState)
      await query("UPDATE world SET state=$1 WHERE id=1", [meta]);
    if (wake) {
      await query(
        `WITH signal AS (
           UPDATE world SET last_wake=clock_timestamp()
           WHERE id=1 AND last_wake < clock_timestamp() - interval '200 milliseconds'
           RETURNING id
         ) SELECT notify_world() FROM signal`
      );
    }
  }
  return {
    action,
    commit,
    heartbeat,
    join,
    leave,
    peer,
    tick,
    updateProfile,
    view
  };
}

// server/api.ts
var posts = /* @__PURE__ */ new Set([
  "/api/wallet/challenge",
  "/api/wallet/login",
  "/api/collectible",
  "/api/wild-receipt",
  "/api/profile/username",
  "/api/world"
]);
function tokenFor(req) {
  return req.headers.cookie?.match(/(?:^|;\s*)bb=([a-f0-9]{64})(?:;|$)/)?.[1] ?? "";
}
function sendJson(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(data));
}
function realtimeConfig() {
  const url = URL.parse(process.env.WILDHATCH_SUPABASE_URL ?? "");
  const key2 = process.env.WILDHATCH_SUPABASE_PUBLISHABLE_KEY;
  if (!url || url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || !key2 || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key2))
    return void 0;
  return { url: url.origin, key: key2 };
}
async function postBody(req) {
  const max = 4096;
  if (Number(req.headers["content-length"]) > max)
    throw new WorldError("Request is too large.", 413);
  try {
    if (req.body !== void 0) {
      const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      if (Buffer.byteLength(raw) > max)
        throw new WorldError("Request is too large.", 413);
      return JSON.parse(raw);
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += Buffer.byteLength(chunk);
      if (size > max) throw new WorldError("Request is too large.", 413);
      chunks.push(Buffer.from(chunk));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof WorldError) throw error;
    throw new WorldError("Invalid request body.", 400);
  }
}
function createApi(transact, readBoxRoll = verifiedBoxRoll) {
  return async function api(req, res, route) {
    res.setHeader("Cache-Control", "no-store");
    const path = route ?? req.url?.split("?")[0] ?? "";
    const token2 = tokenFor(req);
    try {
      if (req.method === "GET" && (path === "/api/session" || path === "/api/profile")) {
        const profile = await transact(
          false,
          (query) => profiles(query).signedIn(token2)
        );
        if (path === "/api/session")
          return sendJson(
            res,
            profile ? {
              wallet: profile.wallet,
              unlockedRangers: profile.unlockedRangers ?? []
            } : { wallet: null }
          );
        if (!profile)
          throw new WorldError("Sign in with your Solana wallet.", 401);
        return sendJson(res, profile);
      }
      if (req.method !== "POST" || !posts.has(path))
        return void res.writeHead(404).end();
      const origin = URL.parse(req.headers.origin ?? "");
      if (!origin || origin.host !== req.headers.host || !["http:", "https:"].includes(origin.protocol))
        throw new WorldError("Invalid request origin.", 403);
      const data = await postBody(req);
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new WorldError("Invalid request body.", 400);
      if (path === "/api/world") {
        const { op, mode, client, guest, type, after = 0 } = data;
        if (!["join", "action", "poll", "heartbeat", "leave"].includes(op) || !["normal", "pvp", "guest"].includes(mode) || typeof client !== "string" || !/^[a-f0-9]{36}$/.test(client) || !Number.isSafeInteger(after) || after < 0 || op === "action" && (typeof type !== "string" || type.length > 30))
          throw new WorldError("Invalid world request.", 400);
        if (mode === "guest" && (typeof guest !== "string" || !/^[a-f0-9]{36}$/.test(guest)))
          throw new WorldError("A valid visitor session is required.", 400);
        if (mode !== "guest" && !token2)
          throw new WorldError("Sign in with your Solana wallet.", 401);
        const key2 = mode === "guest" ? guest : token2;
        const moving = op === "action" && type === "move";
        if (moving && ![data.data?.x, data.data?.z, data.data?.yaw].every(Number.isFinite))
          throw new WorldError("Invalid movement coordinates.", 400);
        if (moving && data.data.path !== void 0) {
          const path2 = data.data.path;
          if (!Array.isArray(path2) || path2.length > 48 || !path2.every(
            (point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
          ))
            throw new WorldError("Invalid movement path.", 400);
        }
        const scoped = moving || op === "poll";
        const result = await transact(op !== "poll", async (query) => {
          const world = await openWorld(
            query,
            scoped ? {
              token: key2,
              guest: mode === "guest",
              readOnly: op === "poll"
            } : void 0
          );
          if (!scoped) await world.tick();
          const session2 = op === "join" ? await world.join(key2, mode, client, data.ranger) : { peer: world.peer(key2, client), after };
          const { peer } = session2;
          if (peer.mode !== mode)
            throw new WorldError("Your expedition connection expired.", 410);
          if (op === "leave") {
            await world.leave(peer);
            await world.commit(true);
            return {};
          }
          if (op === "heartbeat") world.heartbeat(peer, after);
          if (op === "action") await world.action(peer, type, data.data, after);
          if (op !== "poll") await world.commit(op !== "heartbeat");
          const state = await world.view(peer, session2.after, !moving);
          if (op !== "join") return state;
          return { ...state, realtime: realtimeConfig() };
        });
        return sendJson(res, result);
      }
      if (path === "/api/profile/username") {
        const result = validateUsername(data.name);
        if ("error" in result) throw new WorldError(result.error, 400);
        await transact(true, async (query) => {
          const profile = await profiles(query).signedIn(token2);
          if (!profile)
            throw new WorldError(
              "Connect your wallet to edit your username.",
              401
            );
          const { rows } = await query(
            `UPDATE profiles SET data = jsonb_set(data, '{name}', to_jsonb($1::text))
             WHERE token=$2 AND NOT EXISTS (
               SELECT 1 FROM profiles WHERE token<>$2 AND lower(data->>'name')=lower($1)
             ) RETURNING data`,
            [result.name, token2]
          );
          if (!rows.length)
            throw new WorldError("That username is already taken.", 409);
          const world = await openWorld(query);
          world.updateProfile(token2, rows[0].data);
          await world.commit(true);
        });
        return sendJson(res, { name: result.name });
      }
      if (path === "/api/collectible") {
        const profile = await transact(
          false,
          (query) => profiles(query).signedIn(token2)
        );
        if (!profile)
          throw new WorldError("Sign in with your Solana wallet.", 401);
        try {
          return sendJson(res, await prepareCollectible(profile, data.beast));
        } catch (error) {
          throw new WorldError(
            error instanceof Error ? error.message : "Could not prepare collectible.",
            400
          );
        }
      }
      if (path === "/api/wild-receipt") {
        const { item, box } = data;
        const signature = box === void 0 ? data.signature : box;
        const receiptPattern = box === void 0 ? /^[1-9A-HJ-NP-Za-km-z]{64,88}$/ : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        if (!isWildItem(item) || typeof signature !== "string" || !receiptPattern.test(signature))
          throw new WorldError(
            "A signed-in wallet and a valid Devnet payment receipt are required.",
            400
          );
        const readReceipt = async (query) => (await query(
          "SELECT owner, item, reward FROM wild_receipts WHERE signature=$1",
          [signature]
        )).rows[0];
        const { profile, prior } = await transact(false, async (query) => ({
          profile: await profiles(query).signedIn(token2),
          prior: await readReceipt(query)
        }));
        if (!profile?.wallet)
          throw new WorldError("A signed-in wallet is required.", 400);
        const wallet = profile.wallet;
        let roll = 0;
        if (!prior) {
          try {
            if (box !== void 0) roll = await readBoxRoll(box, wallet, item);
            else await verifyWildBurn(signature, wallet, item);
          } catch (error) {
            throw new WorldError(
              error instanceof Error ? error.message : "Devnet receipt could not be redeemed.",
              400
            );
          }
        }
        const reward = await transact(true, async (query) => {
          const { read, save } = profiles(query);
          const used = await readReceipt(query);
          const current = await read(token2);
          if (current.wallet !== wallet || used && (used.owner !== wallet || used.item !== item))
            throw new WorldError(
              "Receipt already belongs to another purchase.",
              400
            );
          if (used) return used.reward;
          const reward2 = wildReward(item, roll);
          if (box === void 0 && mysteryBox(item)) {
            const legacy = randomInt3(100);
            const bonus = legacy < (item === "trail" ? 30 : 25);
            reward2.orbs = bonus ? 0 : item === "trail" ? 3 : 4;
            reward2.shards = item === "trail" ? bonus ? 4 : 1 : bonus ? 8 : 3;
            reward2.aurora = false;
            reward2.charms = 0;
          }
          const explorerSeed = box === void 0 ? void 0 : createHash3("sha256").update("wildhatch/explorer/v1/" + box + "/" + roll).digest().readUInt32LE(0);
          grantWildReward(current, reward2, explorerSeed);
          await save(token2, current);
          await query("INSERT INTO wild_receipts VALUES ($1, $2, $3, $4)", [
            signature,
            wallet,
            item,
            JSON.stringify(reward2)
          ]);
          const world = await openWorld(query);
          world.updateProfile(token2, current);
          await world.commit(true);
          return reward2;
        });
        return sendJson(res, reward);
      }
      if (path === "/api/wallet/challenge") {
        let pending;
        try {
          pending = challenge(data.address, origin.origin);
        } catch {
          throw new WorldError("Wallet sign-in request was invalid.", 400);
        }
        const id = randomUUID4();
        await transact(true, async (query) => {
          await query("DELETE FROM login_challenges WHERE expires<=$1", [
            Date.now()
          ]);
          const {
            rows: [row]
          } = await query(
            "SELECT count(*)::int AS total FROM login_challenges"
          );
          if (row.total >= 1024)
            throw new WorldError("Try again shortly.", 429);
          await query("INSERT INTO login_challenges VALUES ($1, $2, $3)", [
            id,
            JSON.stringify({ ...pending, guest: token2, origin: origin.origin }),
            pending.expires
          ]);
        });
        return sendJson(res, { id, message: pending.message });
      }
      if (typeof data.id !== "string" || !/^[a-f0-9-]{36}$/.test(data.id))
        throw new WorldError("Wallet signature could not be verified.", 401);
      const session = await transact(true, async (query) => {
        const {
          rows: [row]
        } = await query("SELECT pending FROM login_challenges WHERE id=$1", [
          data.id
        ]);
        const pending = row?.pending;
        if (!pending || pending.guest !== token2 || pending.origin !== origin.origin || !check(pending, data.signature))
          throw new WorldError("Wallet signature could not be verified.", 401);
        await query("DELETE FROM login_challenges WHERE id=$1", [data.id]);
        const {
          rows: [linked]
        } = await query("SELECT token FROM wallets WHERE address=$1", [
          pending.address
        ]);
        const account = profiles(query);
        if (linked) {
          const profile2 = await account.read(linked.token);
          return {
            token: linked.token,
            address: pending.address,
            unlockedRangers: profile2.unlockedRangers ?? []
          };
        }
        const { token: created, profile } = await account.create(
          beast("Mosskin")
        );
        profile.wallet = pending.address;
        await account.save(created, profile);
        await query("INSERT INTO wallets VALUES ($1, $2)", [
          pending.address,
          created
        ]);
        return {
          token: created,
          address: pending.address,
          unlockedRangers: []
        };
      });
      res.setHeader(
        "Set-Cookie",
        "bb=" + session.token + "; HttpOnly; SameSite=Strict; Max-Age=31536000; Path=/" + (origin.protocol === "https:" ? "; Secure" : "")
      );
      return sendJson(res, {
        wallet: session.address,
        unlockedRangers: session.unlockedRangers
      });
    } catch (error) {
      if (error instanceof WorldError)
        return sendJson(res, { error: error.message }, error.status);
      console.error("WildHatch API request failed", {
        route: path,
        code: error?.code ?? "unavailable"
      });
      return sendJson(
        res,
        { error: "The WildHatch server is temporarily unavailable." },
        503
      );
    }
  };
}
var api_default = createApi(database);

// server/handler.ts
function handler(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const route = url.pathname === "/api/handler" && url.searchParams.get("wildhatchRoute");
  return api_default(req, res, route ? "/api/" + route : void 0);
}
export {
  handler as default
};
