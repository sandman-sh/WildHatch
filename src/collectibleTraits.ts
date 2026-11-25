import { elements, type Beast } from "./shared.ts";

export const beastMemoProgram = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
export const beastMemoPrefix = "WildHatch Beast v1 ";

export function beastMemo(beast: Beast): string {
  return (
    beastMemoPrefix +
    JSON.stringify({
      id: beast.id,
      species: beast.name,
      element: elements[beast.name],
      variant: beast.variant,
      rarity: beast.rarity,
      personality: beast.personality,
      stage: beast.stage,
      level: beast.level,
      marking: beast.marking ?? "None",
      mutation: beast.mutation ?? "None",
    })
  );
}

export function readBeastMemo(memo: string) {
  if (!memo.startsWith(beastMemoPrefix)) return;
  try {
    const traits = JSON.parse(memo.slice(beastMemoPrefix.length));
    if (
      typeof traits?.id !== "string" ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(traits.id) ||
      ![
        "species",
        "element",
        "rarity",
        "personality",
        "marking",
        "mutation",
      ].every((key) => typeof traits[key] === "string") ||
      !["variant", "level", "stage"].every(
        (key) => Number.isSafeInteger(traits[key]) && traits[key] >= 0,
      )
    )
      return;
    return traits as {
      id: string;
      species: string;
      element: string;
      variant: number;
      rarity: string;
      personality: string;
      stage: number;
      level: number;
      marking: string;
      mutation: string;
    };
  } catch {
    return;
  }
}
