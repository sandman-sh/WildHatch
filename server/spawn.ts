import { fluid, walkable } from "../src/worldTerrain.ts";

export type SpawnPoint = readonly [number, number];
const clearance = 3;
const spacing = 4;

export function openSpawn(
  anchor: SpawnPoint,
  occupied: readonly { x: number; z: number }[],
  resume = false,
): SpawnPoint | undefined {
  const [ax, az] = anchor;
  const vacant = (x: number, z: number) =>
    occupied.every((p) => (p.x - x) ** 2 + (p.z - z) ** 2 >= clearance ** 2);
  if (resume && vacant(ax, az)) return anchor;
  // Check complete rings so arrivals keep spreading as the trailhead fills up.
  for (let ring = 0; ring <= 32; ring++) {
    const count = Math.max(1, 8 * ring);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = ax + Math.round(Math.cos(angle) * ring * spacing);
      const z = az - Math.round(Math.sin(angle) * ring * spacing);
      if (vacant(x, z) && walkable(x, z) && fluid(x, z) === "land")
        return [x, z];
    }
  }
}
