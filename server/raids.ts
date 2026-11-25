import { randomUUID } from "node:crypto";

type Raids = ReturnType<typeof createRaids>;
export type Raid = ReturnType<Raids["state"]>;
type Entry = { hp: number; damage: number; last: number };
type Room = {
  id: string;
  hp: number;
  max: number;
  next: number;
  respawn: number;
  entries: Map<string, Entry>;
};
type RaidSnapshot = [
  number,
  Omit<Room, "entries"> & { entries: [string, Entry][] },
][];

export function createRaids(snapshot: RaidSnapshot = []) {
  const rooms = new Map<number, Room>(
    snapshot.map(([zone, room]) => [
      zone,
      { ...room, entries: new Map(room.entries) },
    ]),
  );
  function room(zone: number) {
    let r = rooms.get(zone);
    if (!r || (r.respawn && r.respawn < Date.now())) {
      r = {
        id: randomUUID(),
        hp: 100,
        max: 100,
        next: 0,
        respawn: 0,
        entries: new Map(),
      };
      rooms.set(zone, r);
    }
    return r;
  }
  function state(zone: number, token: string) {
    const r = room(zone),
      e = r.entries.get(token);
    return {
      hp: r.hp,
      max: r.max,
      health: e?.hp ?? 35,
      players: r.entries.size,
      damage: e?.damage || 0,
      phase: r.hp === 0 ? "Defeated" : r.hp <= 40 ? "Enraged" : "Awakened",
      respawn: r.respawn,
    };
  }
  function attack(zone: number, token: string, level: number) {
    const r = room(zone),
      now = Date.now(),
      e = r.entries.get(token) ?? { hp: 35, damage: 0, last: 0 };
    if (!r.hp || e.hp <= 0 || now - e.last < 1200) return null;
    const dmg = Math.min(r.hp, 6 + Math.min(15, level));
    r.hp -= dmg;
    e.damage += dmg;
    e.last = now;
    r.entries.set(token, e);
    if (!r.hp) {
      r.respawn = now + 60000;
      return {
        id: r.id,
        winners: [...r.entries]
          .filter(([, entry]) => entry.damage > 0)
          .map(([t]) => t),
      };
    }
    if (now >= r.next) {
      r.next = now + 4200;
      for (const member of r.entries.values())
        member.hp = Math.max(0, member.hp - (r.hp <= 40 ? 8 : 4));
    }
    return null;
  }
  function snapshotRooms(): RaidSnapshot {
    return [...rooms].map(([zone, room]) => [
      zone,
      { ...room, entries: [...room.entries] },
    ]);
  }
  return { state, attack, snapshot: snapshotRooms };
}
