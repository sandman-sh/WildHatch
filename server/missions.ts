import { biome } from "../src/worldTerrain.ts";
import type { Profile } from "../src/shared.ts";

export function survey(p: Profile, x: number, z: number) {
  const seen = (p.regions ??= []);
  const zone = biome(x, z);
  if (seen.includes(zone)) return false;
  seen.push(zone);
  return true;
}
export function missions(p: Profile, now = new Date()) {
  const today = now.toISOString().slice(0, 10),
    week = Math.floor((now.valueOf() + 3 * 86400000) / (7 * 86400000));
  return [
    {
      id: "survey",
      name: "Island cartographer",
      description: "Visit all five regions",
      progress: p.regions?.length || 0,
      target: 5,
      reward: 6,
    },
    {
      id: "species",
      name: "Field naturalist",
      description: "Own five different species",
      progress: new Set(p.collection.map((b) => b.name)).size,
      target: 5,
      reward: 5,
    },
    {
      id: "day-" + today,
      name: "Daily expedition",
      description: "Capture two beasts today (UTC)",
      progress: p.captures?.[today] || 0,
      target: 2,
      reward: 2,
    },
    {
      id: "week-" + week,
      name: "Weekly contender",
      description: "Win three arena duels this week (UTC)",
      progress: p.weeklyWins?.[week] || 0,
      target: 3,
      reward: 8,
    },
  ].map((m) => ({
    ...m,
    progress: Math.min(m.progress, m.target),
    claimed: p.claimed?.includes(m.id) || false,
  }));
}
export function claim(p: Profile, id: string) {
  const m = missions(p).find((v) => v.id === id);
  if (!m || m.claimed || m.progress < m.target) return false;
  (p.claimed ??= []).push(id);
  p.shards += m.reward;
  return true;
}
export function win(p: Profile) {
  const id = Math.floor((Date.now() + 3 * 86400000) / (7 * 86400000));
  p.weeklyWins = { [id]: (p.weeklyWins?.[id] || 0) + 1 };
}
export function capture(p: Profile) {
  const id = new Date().toISOString().slice(0, 10);
  p.captures = { [id]: (p.captures?.[id] || 0) + 1 };
}
