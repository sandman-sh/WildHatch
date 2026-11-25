export type Fixture = {
  model: string;
  x: number;
  z: number;
  size: number;
  yaw: number;
  width: number;
  depth: number;
};
function prop(
  model: string,
  x: number,
  z: number,
  size: number,
  yaw = 0,
  width = 0,
  depth = width,
): Fixture {
  return { model, x, z, size, yaw, width, depth };
}
// Sizes fit the ranger and the terrain; footprints leave paths and archways open.
export const fixtures = [
  prop("Gate", -6.4, -21, 5.6),
  prop("PillarRound", -9.6, -25, 3.6, 0, 1.05),
  prop("PillarRoundCut", -3.1, -25, 1.6, 0.3, 0.92),
  prop("WallBrokenMD", -10.4, -22, 3.7, Math.PI / 2, 0.9, 3.3),
  prop("Altar", -6.4, -26, 1.8, 0, 1.55, 1.05),
  prop("Vase", -8.5, -24, 0.76, 0.35, 0.42),
  prop("cart", 7, -12, 2.3, 0.25, 1.15, 1.6),
  prop("market", 7, -6, 3.2, 0, 2.7, 1.6),
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
  prop("frontier-Rock2", 45, -133, 2.0, 0.4, 1.3),
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
  prop("frontier-Prop_Bucket_Fishes", -31, 110, 0.78, 0.3),
];
