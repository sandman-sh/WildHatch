// Coordinates are shared by the terrain, atlas and encounter sites.
export const outerIslands = [
  {
    name: "Bamboo Reach",
    biome: "Emerald Forest",
    x: -126,
    z: -57,
    rx: 49,
    rz: 40,
    summit: 10,
  },
  {
    name: "Rimehorn Isle",
    biome: "Frozen Peaks",
    x: 53,
    z: -139,
    rx: 47,
    rz: 48,
    summit: 22,
  },
  {
    name: "Amethyst Key",
    biome: "Crystal Valley",
    x: 142,
    z: 21,
    rx: 47,
    rz: 39,
    summit: 14,
  },
  {
    name: "Driftwood Cay",
    biome: "Ocean Frontier",
    x: -36,
    z: 141,
    rx: 57,
    rz: 37,
    summit: 7,
  },
] as const;

export function outerIslandAt(x: number, z: number) {
  for (const island of outerIslands) {
    if (
      Math.abs(x - island.x) < island.rx + 4 &&
      Math.abs(z - island.z) < island.rz + 4
    )
      return island;
  }
}

export function outerHeight(
  x: number,
  z: number,
  island: (typeof outerIslands)[number],
) {
  const u = (x - island.x) / island.rx,
    v = (z - island.z) / island.rz;
  const shore =
    1 - Math.hypot(u, v) + 0.042 * Math.sin(x * 0.19) * Math.cos(z * 0.12);
  if (shore < -0.06) return -2.4;
  const ridge = Math.max(0, 1 - Math.hypot((u - 0.25) * 1.8, (v + 0.21) * 2.4));
  const relief =
    2.1 +
    ridge * island.summit +
    0.9 * Math.sin(x * 0.14) +
    0.58 * Math.sin(z * 0.18);
  return Math.floor(Math.min(shore * 22, relief) / 0.3) * 0.3;
}
