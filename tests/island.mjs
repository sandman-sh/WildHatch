import assert from "node:assert/strict";
import {
  ground,
  walkable,
  fluid,
  sailingRadius,
  sailingCenterZ,
} from "../src/world.ts";
import { elements, habitats } from "../src/shared.ts";
import { importedBeasts, importedBeast } from "../src/importedBeasts.ts";
import { outerIslands } from "../src/outerIslands.ts";
import {
  sector,
  siteId,
  isFrontier,
  frontierSite,
  sectorProps,
  frontierHeight,
  ranges,
} from "../src/frontier.ts";

const reachable = new Set(["0,0"]);
const queue = [[0, 0]];
for (let i = 0; i < queue.length; i++) {
  const [x, z] = queue[i];
  if (Math.hypot(x, z - sailingCenterZ) > sailingRadius + 1) continue;
  for (const [a, b] of [
    [x - 1, z],
    [x + 1, z],
    [x, z - 1],
    [x, z + 1],
  ]) {
    const key = a + "," + b;
    if (
      reachable.has(key) ||
      !walkable(a, b) ||
      ground(a, b) - ground(x, z) > 0.64
    )
      continue;
    reachable.add(key);
    queue.push([a, b]);
  }
}
for (const [name, x, z] of habitats) {
  assert.ok(walkable(x, z), name + " spawn is obstructed");
  assert.ok(
    queue.some(([a, b]) => Math.hypot(x - a, z - b) < 4),
    name + " encounter is unreachable",
  );
}
for (const [name, x, z] of habitats.filter((h) =>
  ["Aquabit", "Bubblefin", "Glideray"].includes(h[0]),
))
  assert.equal(fluid(x, z), "water", name);
for (const island of outerIslands) {
  assert.ok(
    reachable.has(island.x + "," + island.z),
    island.name + " cannot be reached from the trailhead",
  );
  assert.equal(
    fluid(island.x, island.z),
    "land",
    island.name + " must have dry land",
  );
  const resident = habitats.find(
    ([, x, z]) => Math.hypot(x - island.x, z - island.z) < 18,
  );
  assert.ok(resident, island.name + " is missing its encounter");
  assert.equal(
    fluid(resident[1], resident[2]),
    "land",
    resident[0] + " needs a dry habitat",
  );
}
console.log(
  "PASS: " +
    habitats.length +
    " reachable habitats across the main island and four outer islands",
);

for (const z of [-20, -5, 14]) {
  const x = Math.floor(37 + 4 * Math.sin((Math.floor(z) + 0.5) * 0.21)) + 0.5;
  assert.equal(fluid(x, z), "land", "basalt crossing must be dry");
  assert.ok(walkable(x, z), "basalt crossing must allow passage");
}
for (let i = 0; i < 24; i++) {
  const a = (i * Math.PI) / 12;
  const point = (r) => [r * Math.cos(a), sailingCenterZ + r * Math.sin(a)];
  assert.equal(walkable(...point(sailingRadius - 0.3)), true);
  const outside = point(sailingRadius + 0.3);
  if (fluid(...outside) === "water") assert.equal(walkable(...outside), true);
}
console.log(
  "PASS: three lava crossings and passage beyond the former buoy perimeter",
);
const biomes = new Set(),
  ids = new Set(),
  frontierImports = new Set();
for (let cx = -9; cx <= 9; cx++)
  for (let cz = -9; cz <= 9; cz++) {
    if (!isFrontier(cx, cz)) continue;
    const r = sector(cx, cz);
    biomes.add(r.range.name);
    for (const slot of [0, 1]) {
      const id = siteId(cx, cz, slot),
        h = frontierSite(id);
      assert.ok(!ids.has(id));
      ids.add(id);
      if (!slot) assert.equal(h[0], r.range.animal);
      else if (h[0] !== r.range.native) {
        assert.ok(
          importedBeast(h[0]),
          h[0] + " has no imported beast definition",
        );
        frontierImports.add(h[0]);
      }
      assert.ok(walkable(h[1], h[2]));
      if (!slot) assert.equal(fluid(h[1], h[2]), "land");
    }
    assert.ok(sectorProps(cx, cz).some((p) => p.model === r.range.camp));
    assert.equal(
      frontierHeight(cx * 128 + 63.5, cz * 128),
      frontierHeight(cx * 128 + 64.5, cz * 128),
    );
  }
assert.equal(biomes.size, ranges.length);
for (const beast of importedBeasts) {
  assert.equal(elements[beast.name], beast.element);
  assert.ok(habitats.some(([name]) => name === beast.name));
  if (beast.name !== "Glideray") assert.ok(frontierImports.has(beast.name));
}
console.log(
  "PASS: six frontier biomes, traversable wildlife habitats, camps, unique site IDs and sector seams",
);
