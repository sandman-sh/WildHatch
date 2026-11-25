// World seed and sector coordinates are the entire input. Both the game server
// and the renderer use these functions, including for negative coordinates.
export const sectorSize = 128;
export const sectorAt = (n: number) => Math.floor(n / sectorSize + 0.5);
export const isFrontier = (cx: number, cz: number) =>
  Math.max(Math.abs(cx), Math.abs(cz)) >= 2;
export const frontierAt = (x: number, z: number) =>
  isFrontier(sectorAt(x), sectorAt(z));
export function sample(x: number, z: number, salt: number) {
  let h =
    Math.imul(x, 0x1f123bb5) ^
    Math.imul(z, 0x5f356495) ^
    Math.imul(salt, 0x27d4eb2d) ^
    0x57484c44;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const ranges = [
  {
    name: "Amberwood",
    climate: "Emerald Forest",
    animal: "Amberhart",
    native: "Mosskin",
    top: 0xb9a658,
    rock: 0x927757,
    peak: 10,
    props: [
      "range-BirchTree_Autumn_1",
      "range-CommonTree_Autumn_2",
      "range-BushBerries_1",
    ],
    camp: "range-Tent",
  },
  {
    name: "Saffron Badlands",
    climate: "Lava Realm",
    animal: "Dunebull",
    native: "Cinderclaw",
    top: 0xd39559,
    rock: 0xa95839,
    peak: 17,
    props: ["range-Cactus_2", "range-CactusFlower_1", "range-Rock_1"],
    camp: "range-Well",
  },
  {
    name: "Cloudpine Tundra",
    climate: "Frozen Peaks",
    animal: "Cloudwool",
    native: "Snowpup",
    top: 0xd4e3de,
    rock: 0x7893a0,
    peak: 21,
    props: ["range-PineTree_Snow_1", "range-Bush_Snow_1", "range-Rock_1"],
    camp: "range-Tent",
  },
  {
    name: "Lotus Marsh",
    climate: "Ocean Frontier",
    animal: "Fenstride",
    native: "Aquabit",
    top: 0x86a66a,
    rock: 0x66765b,
    peak: 5,
    props: ["range-PalmTree_2", "range-Flowers", "range-Lilypad"],
    camp: "Altar",
  },
  {
    name: "Obsidian Heath",
    climate: "Crystal Valley",
    animal: "Cinderfox",
    native: "Crystalimp",
    top: 0x817783,
    rock: 0x555068,
    peak: 14,
    props: ["range-BirchTree_Dead_1", "frontier-Crystal_Big", "range-Rock_1"],
    camp: "PillarRoundCut",
  },
  {
    name: "Windgrass Steppe",
    climate: "Emerald Forest",
    animal: "Galemane",
    native: "Sunplume",
    top: 0xadb96a,
    rock: 0x998663,
    peak: 7,
    props: [
      "range-Flowers",
      "range-BushBerries_1",
      "range-CommonTree_Autumn_2",
    ],
    camp: "range-Well",
  },
] as const;
export const nativeBeasts = [
  ["Amberhart", "Nature", "#deaa64", "Stag", 6],
  ["Dunebull", "Fire", "#ba7859", "Bull", 3],
  ["Cloudwool", "Ice", "#9dcbd9", "Alpaca", 7],
  ["Fenstride", "Water", "#83b6a0", "Deer", 1],
  ["Cinderfox", "Fire", "#df8b5c", "Fox", 1],
  ["Galemane", "Nature", "#9db679", "Horse", 7],
] as const;
export type Site = readonly [string, number, number];
function makeSector(cx: number, cz: number) {
  const kind = Math.floor(sample(cx, cz, 2) * ranges.length);
  const x = cx * sectorSize + Math.round(sample(cx, cz, 3) * 14 - 7),
    z = cz * sectorSize + Math.round(sample(cx, cz, 4) * 14 - 7);
  return {
    cx,
    cz,
    x,
    z,
    kind,
    range: ranges[kind],
    rx: 44 + sample(cx, cz, 5) * 10,
    rz: 43 + sample(cx, cz, 6) * 11,
    phase: sample(cx, cz, 7) * 6.28,
  };
}
const sectors = new Map<string, ReturnType<typeof makeSector>>();
export function sector(cx: number, cz: number) {
  const key = cx + "," + cz;
  let s = sectors.get(key);
  if (s) return s;
  s = makeSector(cx, cz);
  if (sectors.size >= 160) sectors.delete(sectors.keys().next().value!);
  sectors.set(key, s);
  return s;
}
export function frontierHeight(x: number, z: number) {
  const s = sector(sectorAt(x), sectorAt(z)),
    u = (x - s.x) / s.rx,
    v = (z - s.z) / s.rz;
  const r = Math.hypot(u, v),
    angle = Math.atan2(v, u);
  const rim =
    0.1 * Math.sin(3 * angle + s.phase) +
    0.065 * Math.cos(5 * angle - s.phase) +
    0.035 * Math.sin(9 * angle + s.phase);
  const edge =
    64 - Math.max(Math.abs(x - s.cx * 128), Math.abs(z - s.cz * 128));
  const shore = Math.min(
    (edge - 4) / 30,
    1 -
      r +
      rim * Math.min(1, r) +
      0.048 * Math.sin(7 * u + s.phase) * Math.cos(6 * v - s.phase),
  );
  if (shore < -0.07) return -2.4;
  const ridge = Math.max(
    0,
    1 - Math.hypot((u - 0.29) * 1.45, (v + 0.31) * 1.8),
  );
  const rolls =
    Math.sin(x * 0.081 + s.phase) * Math.cos(z * 0.073) * 1.25 +
    Math.sin(z * 0.14 + s.phase) * 0.55;
  let h = Math.min(shore * 24, 3.1 + rolls + ridge * s.range.peak);
  if (s.kind === 3) {
    const stream = Math.abs(u + 0.38 + 0.13 * Math.sin(6 * v + s.phase));
    h = Math.min(h, -0.65 + Math.max(0, stream - 0.06) * 17 + rolls * 0.32);
  }
  if (s.kind === 1)
    h = Math.min(
      h,
      4 + Math.floor(Math.max(0, ridge - 0.08) * 5) * 1.7 + rolls * 0.5,
    );
  if (s.kind === 4)
    h +=
      Math.max(0, 1 - r * 1.5) *
      Math.abs(Math.sin(8 * u - 2 * v + s.phase)) *
      1.8;
  return Math.floor(h / 0.3) * 0.3;
}
const signed = (v: number) => (v >= 0 ? 2 * v : -2 * v - 1);
const unpack = (v: number) => (v % 2 ? -(v + 1) / 2 : v / 2);
const frontierWildlife = [
  ["Bramblebear", "Lanternfrog", "Sunwing"],
  ["Ashbison", "Cinderplate", "Emberjaw"],
  ["Frostmoose", "Snowwaddle"],
  ["Reedgnaw", "Tidefang"],
  ["Duskpanther", "Runehorn", "Skyrake"],
  ["Bramblebear", "Runehorn"],
] as const;
export function siteId(cx: number, cz: number, slot: number) {
  const a = signed(cx),
    b = signed(cz),
    n = a + b;
  return 32 + 2 * ((n * (n + 1)) / 2 + b) + slot;
}
export function frontierSite(id: number): Site | undefined {
  if (!Number.isSafeInteger(id) || id < 32) return;
  const k = Math.floor((id - 32) / 2),
    n = Math.floor((Math.sqrt(8 * k + 1) - 1) / 2),
    b = k - (n * (n + 1)) / 2,
    cx = unpack(n - b),
    cz = unpack(b);
  if (!isFrontier(cx, cz)) return;
  const s = sector(cx, cz);
  if (!(id % 2)) return [s.range.animal, s.x + 5, s.z + 3];
  const pool = [s.range.native, ...frontierWildlife[s.kind]];
  return [
    pool[Math.floor(sample(cx, cz, 39) * pool.length)],
    s.x - 15,
    s.z + 8,
  ];
}
export function nearbySites(x: number, z: number) {
  const cx = sectorAt(x),
    cz = sectorAt(z),
    ids: number[] = [];
  for (let a = cx - 1; a <= cx + 1; a++)
    for (let b = cz - 1; b <= cz + 1; b++) {
      if (isFrontier(a, b)) ids.push(siteId(a, b, 0), siteId(a, b, 1));
    }
  return ids;
}
export type Prop = {
  model: string;
  x: number;
  z: number;
  height: number;
  yaw: number;
  radius: number;
};
export function ferryCamp(x: number, z: number) {
  if (!frontierAt(x, z))
    return { x: 0, z: 0, frontier: false, ready: Math.hypot(x, z) <= 9 };
  const s = sector(sectorAt(x), sectorAt(z));
  return {
    x: s.x,
    z: s.z,
    frontier: true,
    ready: Math.hypot(x - s.x, z - s.z) < 15,
  };
}
const propCache = new Map<string, Prop[]>();
export function sectorProps(cx: number, cz: number) {
  const key = cx + "," + cz;
  const known = propCache.get(key);
  if (known) return known;
  const s = sector(cx, cz),
    props: Prop[] = [];
  const first = frontierSite(siteId(cx, cz, 0))!,
    second = frontierSite(siteId(cx, cz, 1))!;
  for (let i = 0; i < 205; i++) {
    const x = s.x + (sample(cx, cz, 11 + i * 4) - 0.5) * s.rx * 2,
      z = s.z + (sample(cx, cz, 12 + i * 4) - 0.5) * s.rz * 2;
    if (
      Math.hypot(x - s.x, z - s.z) < 9 ||
      Math.hypot(x - s.x + 6, z - s.z + 8) < 6 ||
      [first, second].some((h) => Math.hypot(x - h[1], z - h[2]) < 4)
    )
      continue;
    const t = sample(cx, cz, 13 + i * 4),
      model = s.range.props[Math.floor(t * 3)],
      y = frontierHeight(x, z);
    if (model === "range-Lilypad" ? y > -0.2 || y < -1.6 : y < 0.35) continue;
    const tree = /Tree|Palm/.test(model),
      scale =
        (tree ? 4 : /Cactus|Crystal/.test(model) ? 2 : 0.75) *
        (1 + sample(cx, cz, 14 + i * 4));
    props.push({
      model,
      x,
      z,
      height: scale,
      yaw: t * 6.28,
      radius: tree
        ? 0.35
        : /Rock|Cactus|Crystal/.test(model)
          ? scale * 0.18
          : 0,
    });
  }
  const understory = [
    "range-Flowers",
    "Agave",
    "range-Bush_Snow_1",
    "coast-ferns",
    "frontier-Mushroom",
    "range-BushBerries_1",
  ][s.kind];
  for (let i = 0; i < 36; i++) {
    const x = s.x + sample(cx, cz, 1200 + i) * 84 - 42,
      z = s.z + sample(cx, cz, 1300 + i) * 80 - 40;
    for (let k = 0; k < 4; k++) {
      const px = x + sample(cx + i, cz + k, 1500) * 4,
        pz = z + sample(cx + i, cz + k, 1600) * 4;
      if (frontierHeight(px, pz) < 0.2 || Math.hypot(px - s.x, pz - s.z) < 6)
        continue;
      props.push({
        model: understory,
        x: px,
        z: pz,
        height: 0.5 + 0.65 * sample(cx + i, cz + k, 1700),
        yaw: k * 1.8,
        radius: 0,
      });
    }
  }
  const equipment = [
    ["frontier-Fence_Center", "frontier-Chest_Closed"],
    ["frontier-Cart", "frontier-Prop_Barrel"],
    ["frontier-Chest_Closed", "frontier-Fence_Center"],
    ["frontier-Environment_Dock_Broken", "frontier-Prop_Bucket_Fishes"],
    ["frontier-Cart", "frontier-Crystal_Big"],
    ["frontier-Fence_Center", "frontier-Prop_Barrel"],
  ][s.kind];
  equipment.forEach((model, i) =>
    props.push({
      model,
      x: s.x - 8 + i * 5,
      z: s.z - 11,
      height: i ? 1.2 : 3,
      yaw: s.phase,
      radius: 0.4,
    }),
  );
  props.push({
    model: s.range.camp,
    x: s.x - 6,
    z: s.z - 8,
    height: 3.3,
    yaw: s.phase,
    radius: 1,
  });
  if (propCache.size >= 100) propCache.delete(propCache.keys().next().value!);
  propCache.set(key, props);
  return props;
}
