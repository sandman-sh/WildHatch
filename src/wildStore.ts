import { ownsRanger, rangerFor, rangers } from "./rangers.ts";

export const wildItems = {
  orbs: {
    name: "Orb pouch",
    cost: 4,
    description: "Four capture orbs for your next hunt.",
  },
  trail: {
    name: "Trail box",
    cost: 6,
    description:
      "Three orbs and one unowned explorer while any remain. 70% chance of one shard, 30% chance of a Focus Charm.",
  },
  prism: {
    name: "Prism box",
    cost: 12,
    description:
      "Four orbs, three shards and one unowned explorer while any remain. 90% chance of two extra shards, 10% chance of the Aurora orb finish.",
  },
  charm: {
    name: "Focus Charm",
    cost: 5,
    description:
      "+10 percentage points on your next wild throw, up to 90%. Used automatically.",
  },
} as const;
export type WildItem = keyof typeof wildItems;
export function isWildItem(value: unknown): value is WildItem {
  return typeof value === "string" && Object.hasOwn(wildItems, value);
}
export function mysteryBox(item: WildItem) {
  return item === "trail" || item === "prism";
}
export function wildReward(item: WildItem, roll: number): WildReward {
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
export type WildReward = {
  orbs: number;
  shards: number;
  charms: number;
  aurora: boolean;
  ranger?: number;
};
export function grantWildReward(
  profile: {
    orbs: number;
    shards: number;
    charms?: number;
    aurora?: boolean;
    unlockedRangers?: number[];
  },
  reward: WildReward,
  explorerSeed?: number,
) {
  if (explorerSeed !== undefined) {
    const remaining = rangers.filter(
      (r) => !ownsRanger(r.id, profile.unlockedRangers),
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
export function rewardLabel(reward: Partial<WildReward>) {
  return [
    reward.orbs && reward.orbs + " orbs",
    reward.shards &&
      reward.shards + (reward.shards === 1 ? " shard" : " shards"),
    reward.charms && "Focus Charm",
    reward.aurora && "Aurora orb finish",
    reward.ranger !== undefined && rangerFor(reward.ranger).name + " unlocked",
  ]
    .filter(Boolean)
    .join(" · ");
}
