import { avatarNames } from "./avatarNames.ts";

// Keep the existing imported avatar IDs in saved selections and presence data.
export const rangers: {
  id: number;
  name: string;
  file: string;
  facesForward?: boolean;
}[] = [
  { id: 0, name: "Sukuna", file: "sukuna", facesForward: true },
  { id: 6, name: "Seb", file: "seb" },
  ...avatarNames.map((name, index) => ({
    id: index + 7,
    name,
    file: String(index + 1).padStart(3, "0"),
  })),
];
const rangerById = new Map(rangers.map((ranger) => [ranger.id, ranger]));

export function rangerFor(id: number) {
  return rangerById.get(id) ?? rangers[0];
}

export function selectedRanger() {
  return rangerFor(Number(localStorage.getItem("beasts.ranger"))).id;
}
