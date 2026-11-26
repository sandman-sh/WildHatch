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

export const starterRangers = rangers.slice(0, 6).map((ranger) => ranger.id);

export function ownsRanger(id: number, earned: readonly number[] = []) {
  return (
    rangerById.has(id) && (starterRangers.includes(id) || earned.includes(id))
  );
}

let walletKey = "beasts.ranger";
let walletUnlocks: readonly number[] = [];
export function setWalletRoster(
  wallet: string | null,
  earned: readonly number[] = [],
) {
  walletKey = wallet ? "beasts.ranger." + wallet : "beasts.ranger";
  walletUnlocks = earned;
}
export function canEquip(id: number) {
  return ownsRanger(id, walletUnlocks);
}
export function equipRanger(id: number) {
  if (canEquip(id)) localStorage.setItem(walletKey, String(id));
}
export function selectedRanger() {
  const id = Number(
    localStorage.getItem(walletKey) ?? localStorage.getItem("beasts.ranger"),
  );
  return canEquip(id) ? id : starterRangers[0];
}

export function guestRanger(guestId: string) {
  // Guest IDs start with uniformly random bytes and survive a reconnect.
  const slot = Number.parseInt(guestId.slice(0, 8), 16) % rangers.length;
  return rangers[slot].id;
}

export let fieldRanger = rangers[0].id;
export function chooseFieldRanger(guestId?: string) {
  fieldRanger = guestId ? guestRanger(guestId) : selectedRanger();
  return fieldRanger;
}
