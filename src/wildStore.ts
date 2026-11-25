export const wildItems = {
  orbs: { name: "Orb pouch", cost: 4, description: "Four capture orbs" },
  trail: {
    name: "Trail box",
    cost: 6,
    description: "70% for 3 orbs and 1 shard, 30% for 4 shards",
  },
  prism: {
    name: "Prism box",
    cost: 12,
    description: "75% for 4 orbs and 3 shards, 25% for 8 shards",
  },
} as const;
export type WildItem = keyof typeof wildItems;
export function isWildItem(value: unknown): value is WildItem {
  return typeof value === "string" && Object.hasOwn(wildItems, value);
}
export function wildReward(item: WildItem, roll: number) {
  if (item === "orbs") return { orbs: 4, shards: 0 };
  if (item === "trail")
    return roll < 30 ? { orbs: 0, shards: 4 } : { orbs: 3, shards: 1 };
  return roll < 25 ? { orbs: 0, shards: 8 } : { orbs: 4, shards: 3 };
}
