export type BeastFlight = {
  altitude: number;
  radius: number;
  turnRate: number;
};

type ImportedBeast = {
  name: string;
  source: "Cubicle Studio" | "Catching Animals" | "monogon";
  file: string;
  element: "Nature" | "Fire" | "Water" | "Ice" | "Crystal";
  color: string;
  size: number;
  fallback: number;
  habitat: readonly [x: number, z: number];
  flight?: BeastFlight;
};

export const importedBeasts: readonly ImportedBeast[] = [
  {
    name: "Bramblebear",
    source: "Cubicle Studio",
    file: "Bramblebear",
    element: "Nature",
    color: "#6f9565",
    size: 2.5,
    fallback: 1,
    habitat: [-10, -12],
  },
  {
    name: "Ashbison",
    source: "Cubicle Studio",
    file: "Ashbison",
    element: "Fire",
    color: "#ae7157",
    size: 2.65,
    fallback: 3,
    habitat: [72, 9],
  },
  {
    name: "Frostmoose",
    source: "Cubicle Studio",
    file: "Frostmoose",
    element: "Ice",
    color: "#8ca3bd",
    size: 2.7,
    fallback: 7,
    habitat: [30, -62],
  },
  {
    name: "Reedgnaw",
    source: "Cubicle Studio",
    file: "Reedgnaw",
    element: "Water",
    color: "#80a7a1",
    size: 1.6,
    fallback: 4,
    habitat: [6, 51],
  },
  {
    name: "Tidefang",
    source: "Cubicle Studio",
    file: "Tidefang",
    element: "Water",
    color: "#5a9277",
    size: 2.8,
    fallback: 4,
    habitat: [17, 80],
  },
  {
    name: "Lanternfrog",
    source: "Catching Animals",
    file: "Lanternfrog",
    element: "Nature",
    color: "#91c96f",
    size: 1.35,
    fallback: 0,
    habitat: [-6, 20],
  },
  {
    name: "Duskpanther",
    source: "Catching Animals",
    file: "Duskpanther",
    element: "Crystal",
    color: "#9b71ce",
    size: 2.15,
    fallback: 1,
    habitat: [-55, -5],
  },
  {
    name: "Snowwaddle",
    source: "Catching Animals",
    file: "Snowwaddle",
    element: "Ice",
    color: "#aad8fa",
    size: 1.55,
    fallback: 7,
    habitat: [14, -73],
  },
  {
    name: "Glideray",
    source: "Catching Animals",
    file: "Glideray",
    element: "Water",
    color: "#7dc5d6",
    size: 2.25,
    fallback: 5,
    habitat: [-21, 88],
  },
  {
    name: "Runehorn",
    source: "Catching Animals",
    file: "Runehorn",
    element: "Crystal",
    color: "#b193d7",
    size: 2.65,
    fallback: 3,
    habitat: [-30, 10],
  },
  {
    name: "Cinderplate",
    source: "Catching Animals",
    file: "Cinderplate",
    element: "Fire",
    color: "#c57b49",
    size: 2.45,
    fallback: 3,
    habitat: [59, -13],
  },
  {
    name: "Emberjaw",
    source: "monogon",
    file: "Emberjaw",
    element: "Fire",
    color: "#bc804c",
    size: 3.25,
    fallback: 2,
    habitat: [69, -25],
  },
  {
    name: "Sunwing",
    source: "Cubicle Studio",
    file: "Sunwing",
    element: "Nature",
    color: "#bfaa73",
    size: 2.5,
    fallback: 2,
    habitat: [-14, -6],
    flight: { altitude: 4.4, radius: 5.5, turnRate: 0.65 },
  },
  {
    name: "Skyrake",
    source: "Catching Animals",
    file: "Skyrake",
    element: "Crystal",
    color: "#a899df",
    size: 3.1,
    fallback: 2,
    habitat: [25, -12],
    flight: { altitude: 5.4, radius: 6.4, turnRate: 0.56 },
  },
];

const byName = new Map(importedBeasts.map((animal) => [animal.name, animal]));
export const importedBeast = (name: string) => byName.get(name);

// The pack licenses cover creatures in the game. Keep their game collectibles off-chain.
export const gameOnlyBeast = (name: string) => byName.has(name);
