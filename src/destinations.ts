export type Destination = {
  kind: "shop" | "market" | "boss";
  name: string;
  district: string;
  x: number;
  z: number;
};
export const destinations: Destination[] = [
  { kind: "shop", name: "Wild Shop", district: "Trailhead", x: -4, z: 4 },
  { kind: "market", name: "Trading Post", district: "Trailhead", x: 7, z: -6 },
  { kind: "boss", name: "Sanctuary", district: "Dragon Gate", x: -6.4, z: -21 },
  { kind: "shop", name: "Wild Shop", district: "Bamboo Reach", x: -125, z: -54 },
  { kind: "market", name: "Trading Post", district: "Amethyst Key", x: 135, z: 25 },
];
export function closestDestination(x: number, z: number, kind?: Destination["kind"]) {
  let closest: Destination | undefined;
  let distance = Infinity;
  for (const place of destinations) {
    if (kind && place.kind !== kind) continue;
    const d = Math.hypot(x - place.x, z - place.z);
    if (d < distance) { closest = place; distance = d; }
  }
  return { place: closest!, distance };
}
export const destinationInk = {
  shop: { color: "#f4c879", mark: "S" },
  market: { color: "#82dcce", mark: "T" },
  boss: { color: "#d9a8f1", mark: "R" },
};
