import { nativeBeasts, frontierSite, type Site } from "./frontier.ts";
import { importedBeasts } from "./importedBeasts.ts";
export const habitats = [
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
  ...importedBeasts.map(({ name, habitat }) => [name, ...habitat] as const),
] as const;
export function habitatAt(id: number): Site | undefined {
  return habitats[id] ?? frontierSite(id);
}
export const elements: Record<string, string> = {
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
    importedBeasts.map(({ name, element }) => [name, element]),
  ),
};
export const rarities = [
  "Normal",
  "Unusual",
  "Rare",
  "Epic",
  "Legendary",
  "Mythic",
];
export type Beast = {
  id: string;
  name: string;
  variant: number;
  rarity: string;
  level: number;
  stage: number;
  xp: number;
  personality: string;
  breedAfter?: number;
  offspring?: number;
  parents?: string[];
  history: string[];
  marking?: string;
  mutation?: string;
};
export function beastStats(b: Pick<Beast, "level" | "variant" | "stage">) {
  return {
    health: 30 + b.level * 4 + (b.stage - 1) * 4,
    attack: 5 + b.level + ((b.variant >>> 8) % 3) + b.stage - 1,
    defense: (b.variant >>> 4) % 3,
    speed: 4 + (b.variant % 3),
  };
}
export function inheritedMutation(first: string, second: string) {
  const pair = [elements[first], elements[second]].sort().join("/");
  return (
    {
      "Fire/Water": "Steam",
      "Crystal/Nature": "Ancient Grove",
      "Crystal/Fire": "Magma Crystal",
      "Ice/Water": "Glacier",
    } as Record<string, string>
  )[pair];
}
export type Profile = {
  wild?: number;
  frontierPosition?: [number, number];
  rangerXp?: number;
  regions?: string[];
  captures?: Record<string, number>;
  weeklyWins?: Record<string, number>;
  claimed?: string[];
  wallet?: string;
  name: string;
  orbs: number;
  shards: number;
  collection: Beast[];
  active: string;
  wins: number;
};
