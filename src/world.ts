import { fixtures } from "./fixtures.ts";
import { outerHeight, outerIslandAt } from "./outerIslands.ts";
import { habitats } from "./shared.ts";
import {
  frontierAt,
  frontierHeight,
  sectorAt,
  sectorProps,
  sector,
} from "./frontier.ts";
import * as THREE from "three";
import { createIslandMaterials, surfaceFor } from "./world-materials.ts";

export const dragonPerch = { x: 2, z: -47, elevation: 18 } as const;
const TILE = 1.0;
const WATER = -0.16;
export const sailingRadius = 216;
export const sailingCenterZ = -3;
export const sailingDistance = (x: number, z: number) =>
  Math.hypot(x, z - sailingCenterZ);
const lavaChannel = (x: number, z: number) =>
  Math.abs(x - 37 - 4 * Math.sin(z * 0.21)) < 1.1;
const basaltCrossing = (z: number) =>
  Math.abs(z + 20) < 1.6 || Math.abs(z + 5) < 1.6 || Math.abs(z - 14) < 1.6;
const tileIndex = (value: number) => Math.floor(value / TILE);
const tileCenter = (value: number) => (value + 0.5) * TILE;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

// A stateless landscape seed keeps collision and every rendered chunk in agreement.
function noise(x: number, z: number, salt = 0) {
  let h =
    Math.imul(x | 0, 374761393) +
    Math.imul(z | 0, 668265263) +
    salt * 1597334677;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const river = (z: number) => -15 + Math.sin(z * 0.064) * 5 + z * 0.05;
const trail = (z: number) => 2 + 3.2 * Math.sin(z * 0.109);
const coast = (x: number, z: number) =>
  Math.hypot(x * 0.95, (z + 3) * 1.03) +
  2.8 * Math.sin(x * 0.14) +
  2 * Math.sin(z * 0.21);
export function biome(x: number, z: number) {
  if (frontierAt(x, z))
    return frontierHeight(x, z) <= WATER
      ? "Ocean Frontier"
      : sector(sectorAt(x), sectorAt(z)).range.climate;
  const island = outerIslandAt(x, z);
  if (island && outerHeight(x, z, island) > WATER) return island.biome;
  if (z > 30 + 3 * Math.sin(x * 0.12) || coast(x, z) > 86)
    return "Ocean Frontier";
  if (z < -30 + 3 * Math.sin(x * 0.12)) return "Frozen Peaks";
  if (x < -25 + 3 * Math.cos(z * 0.13)) return "Crystal Valley";
  if (x > 27 + 3 * Math.cos(z * 0.13)) return "Lava Realm";
  return "Emerald Forest";
}
function height(x: number, z: number) {
  if (frontierAt(x, z)) return frontierHeight(x, z);
  const island = outerIslandAt(x, z);
  const edge = coast(x, z);
  if (edge > 92) return island ? outerHeight(x, z, island) : -2.4;
  const rolls =
    Math.sin(x * 0.109 + z * 0.063) * 0.85 +
    Math.cos(z * 0.12 - x * 0.073) * 0.68;
  let h = 1.85 + rolls;
  // Distinct stepped summits overlooking the central meadow.
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
  return island ? Math.max(mainHeight, outerHeight(x, z, island)) : mainHeight;
}
const peaks = [
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
  [-36, 11, 7, 0.59],
];
export function fluid(x: number, z: number) {
  if (frontierAt(x, z))
    return frontierHeight(tileCenter(tileIndex(x)), tileCenter(tileIndex(z))) <=
      WATER
      ? "water"
      : "land";
  if (Math.abs(z + 10) < 1.24 && Math.abs(x - river(-10)) < 4.61) return "land";
  if (height(tileCenter(tileIndex(x)), tileCenter(tileIndex(z))) <= WATER)
    return "water";
  const tx = tileCenter(tileIndex(x)),
    tz = tileCenter(tileIndex(z));
  if (
    biome(tx, tz) === "Lava Realm" &&
    lavaChannel(tx, tz) &&
    !basaltCrossing(tz)
  )
    return "lava";
  return "land";
}
export function ground(x: number, z: number) {
  const surface = Math.max(
    WATER,
    height(tileCenter(tileIndex(x)), tileCenter(tileIndex(z))),
  );
  if (Math.abs(z + 10) < 1.24 && Math.abs(x - river(-10)) < 4.61)
    return Math.max(surface, 1.45);
  return surface;
}
type Part = [number, number, number, number, number, number, number, number];
const grass = [0x8caf58, 0x8db057, 0x85aa54, 0x91b45d, 0x85aa53];
const meadow = [0x9cb964, 0x98b560, 0x9ebd67, 0x9bb961];
const palettes: Record<string, number[]> = {
  "Frozen Peaks": [0xe7f2ea, 0xd7e8e4, 0xe9f4ee, 0xd6e7ec],
  "Crystal Valley": [0x9d93ad, 0x9890a2, 0xaba2b5, 0xaba5ac],
  "Lava Realm": [0x60595a, 0x62585b, 0x6c605b, 0x605656],
  "Ocean Frontier": [0xe8ca87, 0xe1c28c, 0xedcf98, 0xe6c994],
};
const pick = (colors: number[], t: number) =>
  colors[Math.floor(t * colors.length) % colors.length];
type Obstacle = {
  left: number;
  right: number;
  back: number;
  front: number;
  top: number;
  solid: boolean;
};
type IslandLayout = ReturnType<typeof makeLayout>;
let island: IslandLayout | undefined;
const layout = () => (island ??= makeLayout());
const cellKey = (x: number, z: number) =>
  Math.floor(x / 5) + "," + Math.floor(z / 5);
export function walkable(x: number, z: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || fluid(x, z) === "lava")
    return false;
  if (frontierAt(x, z))
    return !sectorProps(sectorAt(x), sectorAt(z)).some(
      (p) => p.radius > 0 && Math.hypot(p.x - x, p.z - z) < p.radius + 0.24,
    );
  const nearby = layout().obstacles.get(cellKey(x, z));
  return !nearby?.some(
    (b) =>
      b.solid &&
      x > b.left - 0.26 &&
      x < b.right + 0.26 &&
      z > b.back - 0.26 &&
      z < b.front + 0.26,
  );
}
export function cameraFloor(x: number, z: number) {
  let y = ground(x, z);
  if (frontierAt(x, z)) {
    for (const p of sectorProps(sectorAt(x), sectorAt(z)))
      if (p.radius > 0 && Math.hypot(p.x - x, p.z - z) < p.radius + 0.2)
        y = Math.max(y, ground(p.x, p.z) + p.height);
    return y;
  }
  for (const b of layout().obstacles.get(cellKey(x, z)) ?? []) {
    if (
      x > b.left - 0.14 &&
      x < b.right + 0.14 &&
      z > b.back - 0.14 &&
      z < b.front + 0.14
    )
      y = Math.max(y, b.top);
  }
  return y;
}
function makeLayout() {
  const obstacles = new Map<string, Obstacle[]>();
  function obstacle(
    x: number,
    z: number,
    w: number,
    d: number,
    top: number,
    solid = true,
  ) {
    const b = {
      left: x - w / 2,
      right: x + w / 2,
      back: z - d / 2,
      front: z + d / 2,
      top,
      solid,
    };
    for (
      let i = Math.floor((b.left - 0.26) / 5);
      i <= Math.floor((b.right + 0.26) / 5);
      i++
    )
      for (
        let j = Math.floor((b.back - 0.26) / 5);
        j <= Math.floor((b.front + 0.26) / 5);
        j++
      ) {
        const key = i + "," + j;
        if (!obstacles.has(key)) obstacles.set(key, []);
        obstacles.get(key)!.push(b);
      }
  }
  const chunks = new Map<string, Part[]>();
  const waterChunks = new Map<string, Part[]>();
  const glowChunks = new Map<string, Part[]>();
  function add(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
    rotation = 0,
    set = chunks,
  ) {
    const key = w > 800 ? "sea" : Math.floor(x / 20) + "," + Math.floor(z / 20);
    if (!set.has(key)) set.set(key, []);
    set.get(key)!.push([x, y, z, w, h, d, color, rotation]);
  }
  function stack(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
    rotation = 0,
  ) {
    add(x, y + h / 2, z, w, h, d, color, rotation);
  }
  const plants: {
    model: string;
    x: number;
    y: number;
    z: number;
    size: number;
    yaw: number;
  }[] = [];
  function plant(
    model: string,
    x: number,
    y: number,
    z: number,
    size: number,
    yaw: number,
    solid = false,
  ) {
    plants.push({ model, x, y, z, size, yaw });
    if (solid) {
      obstacle(x, z, size * 0.11, size * 0.11, y + size * 0.6);
      obstacle(x, z, size * 0.48, size * 0.48, y + size, false);
    }
  }
  function crystal(x: number, z: number, y: number, s: number, n: number) {
    obstacle(x, z, 0.95 * s, 0.9 * s, y + 2.2 * s);
    const hue =
      n > 0.65
        ? [0x3c9ba3, 0x72dfd4, 0xb0f2e6]
        : [0x735aa6, 0xb88bd6, 0xe6bcfa];
    stack(x, y, z, 0.95 * s, 0.34 * s, 0.9 * s, 0x756a80, 0.16);
    for (let k = 0; k < 3; k++) {
      const px = x + (k - 1) * s * 0.38,
        pz = z + Math.sin(k * 3) * s * 0.4,
        H = s * [1, 1.8, 0.77][k];
      stack(px, y + 0.17 * s, pz, 0.42 * s, H, 0.48 * s, hue[k % 2], 0.3 * k);
      stack(
        px,
        y + 0.17 * s + H,
        pz,
        0.25 * s,
        0.21 * s,
        0.29 * s,
        hue[2],
        0.3 * k,
      );
    }
  }
  const townX = 10,
    townZ = -12;
  function isPath(x: number, z: number) {
    return (
      (z > -22 && z < 29 && Math.abs(x - trail(z)) < 1.9) ||
      (x > -32 && x < 14 && Math.abs(z + 10 + Math.sin(x * 0.18) * 0.45) < 2.1)
    );
  }
  for (let i = -sailingRadius; i < sailingRadius; i++)
    for (
      let j = sailingCenterZ - sailingRadius;
      j < sailingCenterZ + sailingRadius;
      j++
    ) {
      const x = tileCenter(i),
        z = tileCenter(j);
      const island = outerIslandAt(x, z);
      // Open sea uses one continuous surface. Only coasts need individual water tiles.
      if (
        !island &&
        (Math.abs(x) > 105 || Math.abs(z) > 103 || coast(x, z) > 96)
      )
        continue;
      const h = height(x, z),
        n = noise(i, j),
        zone = biome(x, z);
      if (sailingDistance(x, z) > sailingRadius + 2) continue;
      if (h <= WATER) {
        if (island && h <= -1.5) continue;
        // Seafloor below shallow clear water gives the coast a visible shelf.
        if (island || coast(x, z) < 92)
          add(x, h - 0.24, z, TILE, 0.48, TILE, 0xbba879);
        add(
          x,
          WATER - 0.12,
          z,
          TILE + 0.002,
          0.24,
          TILE,
          coast(x, z) > 94 ? 0x469faf : 0x66c0bd,
          0,
          waterChunks,
        );
        if (n > 0.86)
          add(
            x,
            WATER + 0.016,
            z,
            0.46 + n * 0.65,
            0.018,
            0.08,
            0xaddfd0,
            0,
            waterChunks,
          );
        continue;
      }
      const path = isPath(x, z),
        bank = h < 0.52 && Math.abs(x - river(z)) < 7,
        town = Math.hypot(x - townX, z - townZ) < 6;
      const cap =
        island && h < 0.9
          ? pick(palettes["Ocean Frontier"], n)
          : path || town
            ? pick([0xc5ab76, 0xc9ad7a, 0xd1b982], n)
            : bank
              ? 0xc4bc84
              : pick(
                  palettes[zone] ||
                    (Math.sin(x * 0.14 + z * 0.15) > 0.45 ? meadow : grass),
                  n,
                );
      const neighbor = Math.min(
        height(x + TILE, z),
        height(x - TILE, z),
        height(x, z + TILE),
        height(x, z - TILE),
      );
      const bottom = Math.min(neighbor - 0.02, h - 0.25),
        side =
          zone === "Frozen Peaks"
            ? 0x879b9b
            : zone === "Crystal Valley"
              ? 0x716b80
              : zone === "Lava Realm"
                ? 0x49434a
                : 0x978763;
      if (h - 0.19 > bottom)
        stack(x, bottom, z, TILE, h - 0.19 - bottom, TILE, side);
      add(x, h - 0.1, z, TILE + 0.001, 0.2, TILE + 0.001, cap);
      if (
        !path &&
        !town &&
        zone === "Emerald Forest" &&
        h - neighbor > 0.5 &&
        n > 0.56
      ) {
        // Small overhangs expose an irregular turf lip along terraced soil.
        for (const [dx, dz] of [
          [1, 0],
          [0, 1],
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
            cap,
          );
        }
      }
      // Classify and draw the channel before decoration exclusions, including on paths.
      if (zone === "Lava Realm" && lavaChannel(x, z)) {
        if (basaltCrossing(z))
          add(x, h + 0.015, z, TILE, 0.045, TILE, 0x66626a);
        else
          add(
            x,
            h + 0.012,
            z,
            TILE,
            0.04,
            TILE,
            pick([0xe88442, 0xffac54, 0xe97239], n),
            0,
            glowChunks,
          );
        continue;
      }
      const prismClearing = Math.hypot(x + 38, z) < 2.8;
      if (
        path ||
        town ||
        habitats.some(
          ([, hx, hz]) => Math.hypot(hx - x, hz - z) < (island ? 6.5 : 2.5),
        ) ||
        prismClearing ||
        (Math.abs(x + 6.4) < 3.5 && z >= -25 && z <= -14) ||
        (h === dragonPerch.elevation &&
          Math.hypot(x - dragonPerch.x, z - dragonPerch.z) < 8) ||
        fixtures.some(
          (f) =>
            Math.abs(f.x - x) < (f.width || 1) / 2 + 1.2 &&
            Math.abs(f.z - z) < (f.depth || 1) / 2 + 1.2,
        ) ||
        Math.hypot(x, z) < 4 ||
        (Math.abs(x) < 3 && z < 10 && z > -8)
      )
        continue;
      const t = noise(i, j, 9),
        s = 0.68 + noise(i, j, 11) * 0.74;
      if (island) {
        if (h < 0.6 || i % 3 || j % 3) continue;
        const yaw = t * Math.PI * 2;
        if (island.name === "Bamboo Reach") {
          if (n > 0.7)
            plant(
              t > 0.4 ? "frontier-Bamboo" : "frontier-Bamboo_Small",
              x,
              h,
              z,
              (2.9 + t * 3) * s,
              yaw,
              true,
            );
          else if (n < 0.2) plant("frontier-Mushroom", x, h, z, 0.7 * s, yaw);
        } else if (island.name === "Rimehorn Isle") {
          if (n > 0.72 && h < 13) plant("Spruce", x, h, z, 5.2 * s, yaw, true);
          else if (n < 0.09) plant("frontier-Rock2", x, h, z, 1.5 * s, yaw);
        } else if (island.name === "Amethyst Key") {
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
            true,
          );
        } else if (z > 12 && n > 0.79) {
          plant(
            t > 0.58 ? "Monstera" : "Bromeliad",
            x,
            h,
            z,
            s * (1 + t),
            t * 6.28,
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
              -t * 3,
            );
        } else if (n > 0.72) {
          // Fern fronds taper in three voxel steps along the forest floor.
          for (let k = 0; k < 4; k++) {
            const a = k * Math.PI * 0.5 + t * 3,
              dx = Math.cos(a),
              dz = Math.sin(a);
            for (let tip = 0; tip < 3; tip++) {
              const reach = (0.11 + 0.14 * tip) * s;
              stack(
                x + dx * reach,
                h + (0.045 + Math.sin(tip * 0.9) * 0.16) * s,
                z + dz * reach,
                0.22 * s,
                0.076 * s,
                (0.17 - 0.038 * tip) * s,
                k % 2 ? 0x577e47 : 0x80a75a,
                -a,
              );
            }
          }
        } else if (n < 0.035) {
          obstacle(x, z, 0.72 * s, 0.65 * s, h + 0.39 * s);
          stack(x, h, z, 0.72 * s, 0.39 * s, 0.65 * s, 0x8b947f);
          stack(
            x + 0.35 * s,
            h,
            z + 0.22 * s,
            0.49 * s,
            0.22 * s,
            0.46 * s,
            0xa4a98f,
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
          stack(x, h, z, s * 0.65, s * 0.98, s * 0.7, 0x48444c);
          stack(x, h + s * 0.98, z, s * 0.54, 0.13, s * 0.55, 0x936457);
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
          t * 6.28,
        );
      }
    }
  // A glacial waterfall spills from the stepped escarpment into the forest river.
  const fallsX = river(-30),
    fallsZ = -30.39,
    fallsHeight = ground(fallsX, -31);
  for (let k = 0; k < 6; k++) {
    const x = fallsX + (k - 2.5) * 0.54,
      top = ground(x, -31);
    stack(x, top - 0.015, -31.12, 0.55, 0.075, 1.49, 0x8ad1cb);
    stack(
      x,
      WATER,
      fallsZ,
      0.57,
      top - WATER,
      0.2 + (k % 2) * 0.09,
      k % 2 ? 0xa4e4dc : 0x79c9cc,
    );
    add(x, 0.009, fallsZ + 0.32, 0.63, 0.13, 0.72, 0xc6ede1);
  }
  // The low basalt grotto shelters a cluster of lavender crystal growths.
  const grottoX = -31,
    grottoZ = -5,
    grottoY = ground(grottoX, grottoZ);
  obstacle(grottoX, grottoZ, 5.9, 4.65, grottoY + 4.85, false);
  obstacle(grottoX, grottoZ - 2.25, 5.25, 0.85, grottoY + 3.9);
  for (const d of [-1, 1]) {
    obstacle(grottoX + d * 2.65, grottoZ, 1.55, 5.1, grottoY + 3.34);
    stack(grottoX + d * 2.65, grottoY - 1, grottoZ, 1.55, 4.34, 5.1, 0x73747a);
    stack(grottoX + d * 2.4, grottoY + 2.89, grottoZ, 2.1, 1.15, 4.9, 0x8e898f);
  }
  stack(grottoX, grottoY + 3.69, grottoZ, 5.9, 0.95, 4.65, 0x91928c);
  stack(grottoX, grottoY + 4.64, grottoZ, 5.45, 0.21, 4.15, 0xa4a993);
  stack(grottoX, grottoY - 0.55, grottoZ - 2.25, 5.25, 4.45, 0.85, 0x666776);
  crystal(grottoX + 0.6, grottoZ - 0.7, grottoY, 1.22, 0.2);
  // Timber field station with a stepped copper roof and a glowing door lantern.
  function lodge(x: number, z: number, s: number) {
    const y = ground(x, z);
    obstacle(x, z, 4.8 * s, 3.8 * s, y + 4.3 * s);
    stack(x, y - 0.7, z, 4.8 * s, 0.9 * s, 3.8 * s, 0x8e8c79);
    stack(x, y + 0.2 * s, z, 4.4 * s, 2.6 * s, 3.4 * s, 0xd7bd8c);
    for (const dx of [-2, 2])
      for (const dz of [-1.6, 1.6])
        stack(
          x + dx * s,
          y + 0.2 * s,
          z + dz * s,
          0.25 * s,
          2.7 * s,
          0.28 * s,
          0x694f3b,
        );
    stack(x, y + 0.2 * s, z + 1.73 * s, 0.95 * s, 1.95 * s, 0.12 * s, 0x615947);
    for (const dx of [-1.4, 1.4]) {
      stack(
        x + dx * s,
        y + 1.17 * s,
        z + 1.76 * s,
        0.61 * s,
        0.82 * s,
        0.1 * s,
        0x487b80,
      );
      stack(
        x + dx * s,
        y + 1.09 * s,
        z + 1.8 * s,
        0.78 * s,
        0.12 * s,
        0.24 * s,
        0x866548,
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
        k % 2 ? 0xa96444 : 0xb87750,
      );
    stack(
      x + 1.42 * s,
      y + 3.2 * s,
      z - 0.55 * s,
      0.52 * s,
      1.7 * s,
      0.56 * s,
      0x847d6d,
    );
    stack(
      x + 0.77 * s,
      y + 1.73 * s,
      z + 1.9 * s,
      0.22 * s,
      0.3 * s,
      0.24 * s,
      0xffd984,
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
  // Footbridge over the western stream.
  const bridgeZ = -10,
    bridgeX = river(bridgeZ),
    bridgeY = 1.25;
  for (let k = -6; k <= 6; k++) {
    stack(
      bridgeX + k * 0.71,
      bridgeY,
      bridgeZ,
      0.67,
      0.2,
      2.45,
      k % 2 ? 0xa58760 : 0xb19569,
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
          0x81684e,
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
      0xaf936a,
    );
  // Eight navigation buoys mark the passage out of the home waters.
  const buoyCount = 8;
  for (let i = 0; i < buoyCount; i++) {
    const angle = (i * Math.PI * 2) / buoyCount,
      x = sailingRadius * Math.cos(angle),
      z = sailingCenterZ + sailingRadius * Math.sin(angle);
    stack(x, WATER - 0.12, z, 0.78, 0.35, 0.78, 0xe87532);
    stack(x, WATER + 0.23, z, 0.42, 0.42, 0.42, 0xffefe0);
    stack(x, WATER + 0.65, z, 0.36, 0.27, 0.36, 0xe87532);
  }
  // The open sea surface follows the active expedition.
  add(0, WATER - 0.105, 0, 880, 0.15, 880, 0x469faf, 0, waterChunks);
  for (let k = 0; k < 22; k++) {
    const angle = k * 2.39996,
      distance = 87 + noise(k, 42) * 62;
    const cx = Math.cos(angle) * distance,
      cz = Math.sin(angle) * distance;
    const cy = 21 + noise(k, 51) * 16,
      scale = 1 + noise(k, 60) * 1.8;
    for (let p = 0; p < 3; p++)
      add(
        cx + p * 2.7 * scale,
        cy + Math.sin(p * 2) * scale,
        cz + p * 0.7,
        5.2 * scale,
        1.1 * scale,
        2.4 * scale,
        0xf9f5dc,
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
    fallsHeight,
  };
}
export const islandPlants = () => layout().plants;
export function buildWorld(scene: THREE.Scene) {
  const { chunks, waterChunks, glowChunks, fallsX, fallsZ, fallsHeight } =
    layout();
  const lod: { mesh: THREE.InstancedMesh; x: number; z: number }[] = [];
  let ocean: THREE.InstancedMesh | undefined;
  const root = new THREE.Group();
  root.name = "Wildreach Island";
  scene.add(root);
  const geometry = new THREE.BoxGeometry();
  const surfaces = createIslandMaterials();
  const chunkGeometries: THREE.BufferGeometry[] = [];
  const glowMaterial = new THREE.MeshBasicMaterial();
  const matrix = new THREE.Object3D(),
    color = new THREE.Color();
  function bake(
    set: Map<string, Part[]>,
    mat: THREE.Material,
    shadows: boolean,
  ) {
    for (const [id, parts] of set) {
      // Per-instance material IDs preserve one draw per chunk across every land surface.
      let chunkGeometry: THREE.BufferGeometry = geometry;
      if (mat === surfaces.land) {
        chunkGeometry = new THREE.BufferGeometry();
        chunkGeometry.setIndex(geometry.index);
        for (const [name, attribute] of Object.entries(geometry.attributes))
          chunkGeometry.setAttribute(name, attribute);
        const kinds = Float32Array.from(parts, (part) => surfaceFor(part[6]));
        chunkGeometry.setAttribute(
          "surfaceKind",
          new THREE.InstancedBufferAttribute(kinds, 1),
        );
        chunkGeometries.push(chunkGeometry);
      }
      const mesh = new THREE.InstancedMesh(chunkGeometry, mat, parts.length);
      mesh.name = "Landscape " + id;
      parts.forEach(([x, y, z, w, h, d, c, r], index) => {
        matrix.position.set(x, y, z);
        matrix.scale.set(w, h, d);
        matrix.rotation.y = r;
        matrix.updateMatrix();
        mesh.setMatrixAt(index, matrix.matrix);
        mesh.setColorAt(index, color.setHex(c));
      });
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      root.add(mesh);
      if (parts.some((p) => p[3] > 800)) ocean = mesh;
      const [cx, cz] = id.split(",").map(Number);
      if (
        !parts.some((p) => p[3] > 200) &&
        Math.hypot(cx * 20 + 10 - dragonPerch.x, cz * 20 + 10 - dragonPerch.z) >
          25
      )
        lod.push({ mesh, x: cx * 20 + 10, z: cz * 20 + 10 });
    }
  }
  bake(chunks, surfaces.land, true);
  bake(waterChunks, surfaces.water, false);
  bake(glowChunks, surfaces.lava, false);
  const spray = new THREE.InstancedMesh(geometry, glowMaterial, 18);
  spray.name = "Waterfall spray";
  spray.frustumCulled = false;
  root.add(spray);
  for (let k = 0; k < spray.count; k++)
    spray.setColorAt(k, color.setHex(k % 2 ? 0xdbf6ef : 0xa7e4e1));
  let lastCull = -1;
  function update(time: number, player?: THREE.Vector3, quality = "High") {
    if (player && time - lastCull > 0.28) {
      lastCull = time;
      if (ocean)
        ocean.position.set(
          Math.round(player.x / 128) * 128,
          0,
          Math.round(player.z / 128) * 128,
        );
      const radius =
        quality === "Low"
          ? 43
          : quality === "Medium"
            ? 62
            : quality === "Ultra"
              ? 120
              : 86;
      for (const batch of lod)
        batch.mesh.visible =
          (batch.x - player.x) ** 2 + (batch.z - player.z) ** 2 <
          (radius + 14) ** 2;
    }
    surfaces.update(time);
    for (let k = 0; k < spray.count; k++) {
      const phase = (k * 0.618 + time * 0.76) % 1;
      matrix.rotation.set(0, 0, 0);
      matrix.position.set(
        fallsX + (noise(k, 3) - 0.5) * 3.1,
        WATER + (1 - phase * phase) * fallsHeight,
        fallsZ + 0.13 + phase * 0.47,
      );
      matrix.scale.set(0.06, 0.17 + phase * 0.2, 0.09);
      matrix.updateMatrix();
      spray.setMatrixAt(k, matrix.matrix);
    }
    spray.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return {
    update,
    dispose() {
      root.traverse((object) => {
        if (object instanceof THREE.InstancedMesh) object.dispose();
      });
      scene.remove(root);
      geometry.dispose();
      for (const chunkGeometry of chunkGeometries) chunkGeometry.dispose();
      surfaces.dispose();
      glowMaterial.dispose();
    },
  };
}
