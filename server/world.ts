import { rangerFor } from "../src/rangers.ts";
import { createRaids } from "./raids.ts";
import { missions, claim, survey, capture, win } from "./missions.ts";
import { walkable } from "../src/world.ts";
import { frontierAt, ferryCamp, siteId, sample } from "../src/frontier.ts";
import { marketplace, MarketError } from "./market.ts";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import type { Query } from "./database.ts";
import { profiles } from "./profiles.ts";
import { isWildItem, wildItems, wildReward } from "../src/wildStore.ts";
import {
  habitats,
  habitatAt,
  elements,
  rarities,
  beastStats,
  inheritedMutation,
} from "../src/shared.ts";
import type { Beast, Profile } from "../src/shared.ts";
import type { PlayMode, WorldPlayer } from "../src/playMode.ts";
import { validateUsername } from "../src/username.ts";
import { openSpawn } from "./spawn.ts";

export function beast(name: string): Beast {
  const roll = randomInt(1000);
  return {
    id: randomUUID(),
    name,
    variant: randomInt(65536),
    rarity:
      rarities[[580, 830, 950, 990, 998, 1000].findIndex((n) => roll < n)],
    level: 1,
    xp: 0,
    stage: 1,
    personality: ["Curious", "Bold", "Patient", "Playful"][randomInt(4)],
    history: ["Discovered on the island"],
  };
}

type WorldEvent = { seq: number; type: string; data: any };
type Peer = {
  name: string;
  mode: PlayMode;
  client: string;
  touched: number;
  seq: number;
  events: WorldEvent[];
  wild: Beast[];
  discovery?: Beast;
  studied: boolean;
  lastCheckpoint: number;
  count: number;
  windowStart: number;
  t: string;
  id: string;
  x: number;
  z: number;
  yaw: number;
  last: number;
  ranger?: number;
  zone: number;
  cool: number;
  queue: boolean;
  invitation?: { code: string; expires: number };
  encounter: number | null;
  spent: Set<number>;
  battle: string | null;
};
type Duel = {
  lastMove?: { actor: number; name: string; damage: number };
  id: string;
  peers: Peer[];
  hp: number[];
  max: number[];
  turn: number;
  guard: boolean[];
  burn: number[];
  log: string[];
  expires: number;
};

type Snapshot = {
  duels?: (Omit<Duel, "peers"> & { peers: string[] })[];
  guests?: [string, { profile: Profile; expires: number }][];
  raids?: ReturnType<ReturnType<typeof createRaids>["snapshot"]>;
};
type StoredPeer = Omit<Peer, "spent"> & { spent: number[] };

export class WorldError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const guestActions = new Set([
  "move",
  "ferry",
  "encounter",
  "study",
  "capture",
]);
const guestReconnectWindow = 30 * 60 * 1000;
const liveWindow = 30 * 1000;

export async function openWorld(
  query: Query,
  scope?: { token: string; guest: boolean; readOnly: boolean },
) {
  const peerRows = await (scope
    ? query("SELECT state FROM world_peers WHERE token=$1", [scope.token])
    : query("SELECT state FROM world_peers"));
  let state: Snapshot = {};
  if (!scope || (!scope.readOnly && scope.guest)) {
    const {
      rows: [row],
    } = await query("SELECT state FROM world WHERE id=1");
    if (!row) throw Error("The WildHatch world migration is missing.");
    state = row.state;
  }
  const savedPeers: StoredPeer[] = peerRows.rows.map((row) => row.state);
  const peers = new Map<string, Peer>(
    savedPeers.map((p) => [p.t, { ...p, spent: new Set(p.spent) }]),
  );
  const duels = new Map<string, Duel>(
    (scope ? [] : (state.duels ?? [])).map((d) => [
      d.id,
      { ...d, peers: d.peers.map((t) => peers.get(t)!) },
    ]),
  );
  const guestSessions = new Map(state.guests ?? []);
  const raids = createRaids(state.raids);
  function snapshot(): Snapshot {
    return {
      duels: [...duels.values()].map((d) => ({
        ...d,
        peers: d.peers.map((p) => p.t),
      })),
      guests: [...guestSessions],
      raids: raids.snapshot(),
    };
  }
  const previousPeers = new Map(
    savedPeers.map((p) => [p.t, JSON.stringify(p)]),
  );
  const previousState = JSON.stringify(scope ? state : snapshot());
  const { read, save, signedIn } = profiles(query);
  const market = marketplace(query, read, save);
  let changed = false;
  function send(p: Peer, type: string, data: any) {
    if (type === "profile") {
      const previous = p.events.find((event) => event.type === "profile");
      if (previous) p.events.splice(p.events.indexOf(previous), 1);
    }
    p.events.push({ seq: ++p.seq, type, data: structuredClone(data) ?? null });
    if (p.events.length > 48) p.events.shift();
    changed = true;
  }

  async function active(p: Peer) {
    const a = await read(p.t);
    return a.collection.find((b) => b.id === a.active)!;
  }
  async function startDuel(first: Peer, second: Peer) {
    const pair = [first, second];
    const beasts = await Promise.all(pair.map(active));
    const stats = beasts.map(beastStats);
    const max = stats.map((b) => b.health);
    const d: Duel = {
      id: randomUUID(),
      peers: pair,
      hp: [...max],
      max,
      turn:
        stats[1].speed + beasts[1].level > stats[0].speed + beasts[0].level
          ? 1
          : 0,
      guard: [false, false],
      burn: [0, 0],
      log: ["The duel begins."],
      expires: Date.now() + 45000,
    };
    for (const p of pair) {
      p.queue = false;
      p.invitation = undefined;
      p.encounter = null;
      p.battle = d.id;
    }
    duels.set(d.id, d);
    await battleView(d);
  }
  async function battleView(d: Duel) {
    const names = await Promise.all(d.peers.map(active));
    d.peers.forEach((p, i) =>
      send(p, "battle", {
        names,
        players: d.peers.map((q) => q.name),
        hp: d.hp,
        max: d.max,
        turn: d.turn,
        you: i,
        log: d.log,
        guard: d.guard,
        lastMove: d.lastMove,
        burn: d.burn,
        expires: d.expires,
      }),
    );
  }
  async function finish(d: Duel, winner: number, knockout = false) {
    const p = await read(d.peers[winner].t);
    p.wins++;
    p.rangerXp = (p.rangerXp ?? 0) + 15;
    win(p);
    p.shards += 3;
    const wildReward = knockout ? 12 : 0;
    p.wild = (p.wild ?? 0) + wildReward;
    const b = p.collection.find((b) => b.id === p.active)!;
    b.xp += 4;
    b.history.push("Won an arena duel");
    await save(d.peers[winner].t, p);
    await query("INSERT INTO battles VALUES ($1, $2)", [
      d.id,
      JSON.stringify({ winner: d.peers[winner].id, log: d.log }),
    ]);
    for (const [i, p] of d.peers.entries()) {
      p.battle = null;
      send(
        p,
        "end",
        i === winner
          ? "Victory · +3 shards" + (knockout ? " · +12 WILD" : "")
          : "Defeat",
      );
      send(p, "profile", await read(p.t));
    }
    duels.delete(d.id);
  }

  async function checkpointPlayer(p: Peer, profile: Profile) {
    profile.frontierPosition = frontierAt(p.x, p.z) ? [p.x, p.z] : undefined;
    if (p.mode !== "guest") await save(p.t, profile);
    p.lastCheckpoint = Date.now();
  }

  async function leave(p: Peer) {
    if (p.battle) {
      const d = duels.get(p.battle)!;
      await finish(d, 1 - d.peers.indexOf(p));
    }
    if (p.zone) {
      const current =
        p.mode === "guest" ? guestSessions.get(p.t)?.profile : await read(p.t);
      if (current && (frontierAt(p.x, p.z) || current.frontierPosition))
        await checkpointPlayer(p, current);
    }
    const guest = guestSessions.get(p.t);
    if (guest) guest.expires = Date.now() + guestReconnectWindow;
    peers.delete(p.t);
    changed = true;
  }

  async function tick() {
    const now = Date.now();
    for (const d of duels.values()) {
      if (d.expires <= now) await finish(d, 1 - d.turn);
    }
    for (const p of peers.values()) {
      if (
        now - p.touched > liveWindow ||
        (p.mode === "guest" && !guestSessions.has(p.t))
      )
        await leave(p);
    }
    for (const [id, guest] of guestSessions) {
      if (guest.expires <= now && !peers.has(id)) {
        guestSessions.delete(id);
        changed = true;
      }
    }
  }

  function peer(t: string, client: string) {
    const p = peers.get(t);
    if (!p || p.client !== client || Date.now() - p.touched > liveWindow) {
      throw new WorldError("Your expedition connection expired.", 410);
    }
    return p;
  }

  async function join(t: string, mode: PlayMode, client: string) {
    const profile = mode === "guest" ? undefined : await signedIn(t);
    if (mode !== "guest" && !profile)
      throw new WorldError("Sign in with your Solana wallet.", 401);
    const current = peers.get(t);
    if (current) {
      if (current.client !== client)
        throw new WorldError("You are already playing in another tab.", 409);
      if (current.mode !== mode) await leave(current);
      else {
        const after = current.seq;
        current.touched = Date.now();
        send(current, "joined", current.id);
        send(current, "profile", guestSessions.get(t)?.profile ?? profile!);
        if (current.zone) send(current, "position", [current.x, current.z]);
        send(
          current,
          "habitats",
          current.wild.map((b) => b.variant),
        );
        if (current.battle) await battleView(duels.get(current.battle)!);
        return { peer: current, after };
      }
    }
    let guestProfile: Profile | undefined;
    if (mode === "guest") {
      guestProfile = guestSessions.get(t)?.profile;
      if (!guestProfile) {
        let name: string;
        do {
          name = "Guest " + randomInt(10000, 100000);
        } while (
          [...guestSessions.values()].some((s) => s.profile.name === name)
        );
        guestProfile = {
          name,
          orbs: 3,
          shards: 0,
          wins: 0,
          collection: [],
          active: "",
        };
      }
      guestSessions.set(t, {
        profile: guestProfile,
        expires: Date.now() + guestReconnectWindow,
      });
    }
    const initial = guestProfile ?? profile!;
    const zone = mode === "pvp" ? 0 : 1;
    const checkpoint = initial.frontierPosition;
    const resume = !!(
      checkpoint &&
      frontierAt(...checkpoint) &&
      walkable(...checkpoint)
    );
    const spawn = zone
      ? openSpawn(
          resume ? checkpoint! : [0, 0],
          [...peers.values()].filter((q) => q.zone === zone),
          resume,
        )
      : [0, 0];
    if (!spawn) {
      if (guestProfile)
        guestSessions.set(t, {
          profile: guestProfile,
          expires: Date.now() + guestReconnectWindow,
        });
      throw new WorldError("The arrival area is full. Try again.", 503);
    }
    const p: Peer = {
      name: initial.name,
      mode,
      client,
      touched: Date.now(),
      seq: 0,
      events: [],
      wild: habitats.map((h) => beast(h[0])),
      studied: false,
      lastCheckpoint: 0,
      count: 0,
      windowStart: Date.now(),
      t,
      id: randomUUID(),
      x: spawn[0],
      z: spawn[1],
      yaw: 0,
      last: Date.now(),
      zone,
      cool: 0,
      queue: false,
      encounter: null,
      spent: new Set(),
      battle: null,
    };
    peers.set(t, p);
    send(p, "joined", p.id);
    send(p, "profile", initial);
    if (zone) send(p, "position", spawn);

    send(
      p,
      "habitats",
      p.wild.map((b) => b.variant),
    );
    return { peer: p, after: 0 };
  }

  function encounterOffer(p: Peer, i: number) {
    const b = p.discovery!;
    const base =
      i < habitats.length
        ? Math.max(32, 74 - i * 3)
        : 48 + Math.floor(sample(i, 1, 9) * 16);
    const rarityPenalty = 2 * Math.max(0, rarities.indexOf(b.rarity));
    const chance = base - rarityPenalty + (p.studied ? 8 : 0);
    return {
      index: i,
      variant: b.variant,
      personality: b.personality,
      rarity: b.rarity,
      studied: p.studied,
      base,
      rarityPenalty,
      chance,
      focusChance: Math.min(90, chance + 10),
    };
  }

  async function action(p: Peer, type: string, data: any) {
    const t = p.t;
    const guestProfile = guestSessions.get(t)?.profile;
    if (p.mode === "guest" && !guestProfile)
      throw new WorldError("Your expedition connection expired.", 410);
    const time = Date.now();
    if (time - p.windowStart > 1000) {
      p.windowStart = time;
      p.count = 0;
    }
    if (++p.count > 40)
      throw new WorldError("Too many actions. Try again shortly.", 429);
    p.touched = time;
    changed = true;
    if (guestProfile && !guestActions.has(type)) return;
    if (
      !p.zone &&
      [
        "move",
        "encounter",
        "study",
        "capture",
        "ferry",
        "boss",
        "bossStrike",
        "supply",
      ].includes(type)
    )
      return;
    const now = Date.now(),
      a = guestProfile ?? (await read(t));
    if (type === "move") {
      if (Number.isInteger(data.ranger)) p.ranger = rangerFor(data.ranger).id;
      if (p.battle) return;
      const { x, z, yaw } = data,
        dist = Math.hypot(x - p.x, z - p.z),
        allowed = 12 * Math.min(1, (now - p.last) / 1000) + 0.1;
      const obstacles = () => {
        const steps = Math.max(1, Math.ceil(dist / 0.4));
        for (let step = 1; step <= steps; step++)
          if (
            !walkable(
              p.x + ((x - p.x) * step) / steps,
              p.z + ((z - p.z) * step) / steps,
            )
          )
            return true;
        return false;
      };
      if (
        ![x, z, yaw].every(Number.isFinite) ||
        dist > allowed ||
        obstacles()
      ) {
        send(p, "position", [p.x, p.z]);
        return;
      }
      Object.assign(p, { x, z, yaw, last: now });
      if (
        (!guestProfile && survey(a, x, z)) ||
        ((frontierAt(x, z) || a.frontierPosition) &&
          now - p.lastCheckpoint > 6000)
      )
        await checkpointPlayer(p, a);
      return;
    }
    if (type === "missions") {
      send(p, "missions", missions(a));
      return;
    }
    if (type === "market") {
      send(p, "market", await market.browse(t));
      return;
    }
    if (type === "encounter" && !p.battle) {
      if (!Number.isInteger(data)) return;
      const h = habitatAt(data);
      if (!h || p.spent.has(data) || Math.hypot(p.x - h[1], p.z - h[2]) > 7)
        return;
      p.studied = false;
      p.discovery = p.wild[data] ?? beast(h[0]);
      if (!p.wild[data]) {
        p.discovery.variant = Math.floor(sample(data, 0, 31) * 65536);
        const roll = sample(data, 0, 32) * 1000;
        p.discovery.rarity =
          rarities[[580, 830, 950, 990, 998, 1000].findIndex((n) => roll < n)];
        p.discovery.personality = ["Curious", "Bold", "Patient", "Playful"][
          Math.floor(sample(data, 0, 33) * 4)
        ];
      }
      p.encounter = data;
      send(p, "encounter", encounterOffer(p, data));
      return;
    }
    if (type === "study" && !p.battle && p.encounter !== null) {
      const i = p.encounter;
      const h = habitatAt(i)!;
      if (Math.hypot(p.x - h[1], p.z - h[2]) <= 7) {
        p.studied = true;
        send(p, "encounter", encounterOffer(p, i));
      }
      return;
    }
    // Shop purchases check the committed balance on every request.
    const shop = type === "buyOrbs" || type === "openCache";
    if (!shop && now < p.cool) {
      if (type === "capture")
        send(p, "captureUnavailable", "Your orb is recharging. Try again.");
      else send(p, "notice", "Action is recharging. Try again in a moment.");
      return;
    }
    if (!shop) p.cool = now + 250;
    if (type === "ferry" && !p.battle && !p.queue) {
      const camp = ferryCamp(p.x, p.z);
      if (!camp.ready) {
        send(p, "notice", "Use the ferry at the trailhead or a frontier camp.");
        return;
      }
      if (!camp.frontier) {
        const h = habitatAt(siteId(2, 0, 0))!;
        p.x = h[1] - 3;
        p.z = h[2] + 2;
      } else {
        p.x = 0;
        p.z = 0;
      }
      p.encounter = null;
      p.last = now;
      await checkpointPlayer(p, a);
      send(p, "ferry", [p.x, p.z]);
      return;
    }
    if (type === "queue" && !p.battle) {
      p.queue = !p.queue;
      p.invitation = undefined;
      const other = [...peers.values()].find(
        (q) => q !== p && q.queue && q.zone === p.zone,
      );
      if (other && p.queue) await startDuel(other, p);
      else send(p, "queue", p.queue);
      return;
    }
    if (!p.battle && type === "inviteCreate") {
      p.queue = false;
      p.invitation = {
        code: randomBytes(5).toString("hex").toUpperCase(),
        expires: now + 300000,
      };
      send(p, "invite", p.invitation);
      return;
    }
    if (!p.battle && type === "inviteCancel") {
      p.invitation = undefined;
      send(p, "invite", null);
      return;
    }
    if (!p.battle && type === "inviteJoin") {
      const code = typeof data === "string" && data.trim().toUpperCase();
      const host = [...peers.values()].find(
        (q) =>
          q !== p &&
          q.mode === p.mode &&
          !q.battle &&
          q.invitation &&
          q.invitation.expires > now &&
          q.invitation.code === code,
      );
      if (host) await startDuel(host, p);
      else send(p, "notice", "Invite code is invalid or expired.");
      return;
    }
    if (p.battle) {
      if (
        type !== "attack" ||
        !["Strike", "Pulse", "Guard", "Scorch"].includes(data)
      )
        return;
      const d = duels.get(p.battle)!,
        i = d.peers.indexOf(p),
        j = 1 - i;
      if (i !== d.turn) return;
      const b = await active(p),
        foe = await active(d.peers[j]);
      const strong: Record<string, string> = {
        Fire: "Nature",
        Nature: "Water",
        Water: "Fire",
        Ice: "Crystal",
        Crystal: "Ice",
      };
      let damage = 0;
      if (data === "Guard") d.guard[i] = true;
      else {
        damage =
          beastStats(b).attack -
          beastStats(foe).defense +
          (data === "Pulse"
            ? strong[elements[b.name]] === elements[foe.name]
              ? 6
              : 1
            : data === "Strike"
              ? 3
              : 0);
        if (d.guard[j]) damage = Math.ceil(damage / 2);
        d.guard[j] = false;
        if (data === "Scorch") d.burn[j] = 2;
      }
      if (d.burn[j] > 0) {
        damage += 2;
        d.burn[j]--;
      }
      d.hp[j] = Math.max(0, d.hp[j] - damage);
      d.lastMove = { actor: i, name: data, damage };
      d.log.push(b.name + " used " + data + " · " + damage + " damage");
      d.turn = j;
      d.expires = now + 45000;
      await battleView(d);
      if (!d.hp[j]) await finish(d, i, true);
      return;
    }
    if (type === "boss" || type === "bossStrike") {
      if (Math.hypot(p.x + 6.4, p.z + 21) > 8) {
        send(p, "notice", "Find the ruined arch at X -6, Z -21.");
        return;
      }
      if (type === "bossStrike") {
        const result = raids.attack(p.zone, t, (await active(p)).level);
        if (result) {
          for (const token of result.winners) {
            const profile = await read(token);
            profile.shards += 5;
            await save(token, profile);
          }
          await query("INSERT INTO battles VALUES ($1, $2)", [
            result.id,
            JSON.stringify({
              kind: "Green Dragon",
              participants: result.winners.length,
            }),
          ]);
        }
        for (const q of peers.values())
          if (q.zone === p.zone && q !== p) {
            send(q, "bossUpdate", raids.state(q.zone, q.t));
            if (result && q.mode !== "guest")
              send(q, "profile", await read(q.t));
          }
        if (result) send(p, "profile", await read(t));
      }
      send(p, "boss", raids.state(p.zone, t));
      return;
    }
    if (["list", "buy", "unlist"].includes(type)) {
      try {
        await market.change(t, type, data);
        for (const q of peers.values()) {
          if (q.mode === "guest") continue;
          send(q, "profile", await read(q.t));
          send(q, "marketChanged", null);
        }
        send(p, "market", await market.browse(t));
      } catch (error) {
        if (!(error instanceof MarketError)) throw error;
        send(p, "notice", error.message);
      }
      return;
    }
    if (type === "capture") {
      const i = p.encounter;
      if (guestProfile && data === "focus") {
        send(
          p,
          "captureUnavailable",
          "Guest practice uses one Jade orb per throw.",
        );
        return;
      }
      const cost = data === "focus" ? 2 : 1;
      if (
        i === null ||
        a.orbs < cost ||
        Math.hypot(p.x - habitatAt(i)![1], p.z - habitatAt(i)![2]) > 7
      ) {
        send(
          p,
          "captureUnavailable",
          "Move closer to the habitat with a capture orb.",
        );
        return;
      }
      p.encounter = null;
      a.orbs -= cost;
      const odds = encounterOffer(p, i);
      if (randomInt(100) < (cost === 2 ? odds.focusChance : odds.chance)) {
        const b = p.discovery!;
        if (!guestProfile) {
          a.collection.push(b);
          p.spent.add(i);
          capture(a);
          a.rangerXp = (a.rangerXp ?? 0) + 10;
        }
        send(p, "caught", { index: i, beast: b, practice: !!guestProfile });
      } else send(p, "escaped", { index: i, cost });
    } else if (type === "claim") {
      if (!claim(a, data)) return;
      send(p, "missions", missions(a));
    } else if (type === "supply") {
      if (!ferryCamp(p.x, p.z).ready) {
        send(
          p,
          "notice",
          "Visit the trailhead or a frontier camp for supplies.",
        );
        return;
      }
      a.orbs = Math.max(a.orbs, 8);
      send(p, "notice", "Capture orbs replenished");
    } else if (type === "buyOrbs" || type === "openCache") {
      const item = type === "buyOrbs" ? "orbs" : data;
      if (!isWildItem(item)) return;
      const { cost } = wildItems[item];
      if ((a.wild ?? 0) < cost || a.orbs > 95) {
        send(
          p,
          "notice",
          "Check your WILD and available space for up to four orbs.",
        );
        return;
      }
      const reward = wildReward(item, randomInt(100));
      a.wild = (a.wild ?? 0) - cost;
      a.orbs += reward.orbs;
      a.shards += reward.shards;
      await save(t, a);
      send(p, "profile", a);
      if (item === "orbs") send(p, "notice", "Four orbs added to your pack.");
      else send(p, "cacheOpened", { ...reward, kind: item });
      return;
    } else if (type === "breed") {
      if (!Array.isArray(data) || data.length !== 2 || data[0] === data[1])
        return;
      const parents = data.map((id) => a.collection.find((b) => b.id === id));
      if (
        (
          await Promise.all(
            parents.map(
              async (b) =>
                !b ||
                (b.breedAfter || 0) > now ||
                (b.offspring || 0) >= 3 ||
                (await market.listed(b.id)),
            ),
          )
        ).some(Boolean) ||
        a.shards < 2
      ) {
        send(
          p,
          "notice",
          "Breeding requires two eligible parents and two shards.",
        );
        return;
      }
      const [first, second] = parents as Beast[];
      const child: Beast = {
        ...first,
        id: randomUUID(),
        stage: 1,
        level: 1,
        xp: 0,
        rarity: "Normal",
        variant: (first.variant & 0xff00) | (second.variant & 0xff),
        parents: [first.id, second.id],
        marking: undefined,
        mutation: inheritedMutation(first.name, second.name),
        personality: second.personality,
        history: ["Bred from " + first.name + " and " + second.name],
        offspring: 0,
        breedAfter: now + 86400000,
      };
      for (const parent of [first, second]) {
        parent.offspring = (parent.offspring || 0) + 1;
        parent.breedAfter = now + 86400000;
      }
      a.shards -= 2;
      a.collection.push(child);
      a.rangerXp = (a.rangerXp ?? 0) + 10;
      send(p, "notice", child.name + " hatched with inherited traits.");
    } else if (
      type === "train" ||
      type === "evolve" ||
      type === "active" ||
      type === "marking"
    ) {
      const b = a.collection.find(
        (c) => c.id === (type === "marking" ? data?.id : data),
      );
      if (!b) return;
      if (await market.listed(b.id)) {
        send(p, "notice", "Withdraw the listing first.");
        return;
      }
      if (type === "marking") {
        if (!["None", "Amber", "Jade", "Violet"].includes(data.marking)) return;
        b.marking = data.marking;
      } else if (type === "active") a.active = b.id;
      else if (type === "train") {
        if (a.shards < 1) {
          send(p, "notice", "Win an arena duel for more shards.");
          return;
        }
        a.shards--;
        b.level++;
        a.rangerXp = (a.rangerXp ?? 0) + 3;
        b.history.push("Trained to level " + b.level);
      } else {
        if (b.level < 3 || b.stage >= 2) {
          send(
            p,
            "notice",
            "Evolution requires level 3 and a first-stage beast.",
          );
          return;
        }
        b.stage = 2;
        a.rangerXp = (a.rangerXp ?? 0) + 10;
        b.history.push("Evolved on the island");
        send(p, "notice", b.name + " evolved!");
      }
    } else return;
    if (!guestProfile) await save(t, a);
    send(p, "profile", a);
  }

  async function view(p: Peer, after: number, includePresence: boolean) {
    let presence: WorldPlayer[] | undefined;
    if (p.zone && includePresence) {
      const { rows } = await query(
        `SELECT q.state->>'id' AS id, q.state->>'name' AS name, q.x, q.z,
                (q.state->>'yaw')::float8 AS yaw, q.state->>'mode'='guest' AS guest,
                coalesce((q.state->>'ranger')::int, 0) AS ranger,
                (SELECT beast FROM jsonb_array_elements(a.data->'collection') beast
                 WHERE beast->>'id'=a.data->>'active' LIMIT 1) AS beast
         FROM world_peers q LEFT JOIN profiles a ON a.token=q.token
         WHERE q.token<>$1 AND q.zone=$2 AND q.touched>=$3 AND
               q.x BETWEEN $4::float8 - 64 AND $4::float8 + 64 AND
               q.z BETWEEN $5::float8 - 64 AND $5::float8 + 64 AND
               (q.x-$4)^2 + (q.z-$5)^2 <= 4096`,
        [p.t, p.zone, Date.now() - liveWindow, p.x, p.z],
      );
      presence = rows as WorldPlayer[];
    }
    return {
      cursor: p.seq,
      events: p.events.filter((event) => event.seq > after),
      ...(presence ? { presence } : {}),
    };
  }

  function heartbeat(p: Peer, after: number) {
    if (Date.now() - p.touched > 4000) {
      p.touched = Date.now();
      p.events = p.events.filter((event) => event.seq > after);
      changed = true;
    }
  }

  function updateProfile(token: string, profile: Profile) {
    const p = peers.get(token);
    if (p) {
      p.name = profile.name;
      send(p, "profile", profile);
    }
  }

  async function commit(wake: boolean) {
    if (!changed) return;
    for (const [token, p] of peers) {
      const current = JSON.stringify({ ...p, spent: [...p.spent] });
      if (current !== previousPeers.get(token))
        await query(
          "INSERT INTO world_peers(token, state) VALUES ($1, $2) ON CONFLICT (token) DO UPDATE SET state=excluded.state",
          [token, current],
        );
    }
    for (const token of previousPeers.keys()) {
      if (!peers.has(token))
        await query("DELETE FROM world_peers WHERE token=$1", [token]);
    }
    const meta = JSON.stringify(scope ? state : snapshot());
    if (meta !== previousState)
      await query("UPDATE world SET state=$1 WHERE id=1", [meta]);
    if (wake) {
      await query(
        `WITH signal AS (
           UPDATE world SET last_wake=clock_timestamp()
           WHERE id=1 AND last_wake < clock_timestamp() - interval '200 milliseconds'
           RETURNING id
         ) SELECT notify_world() FROM signal`,
      );
    }
  }

  return {
    action,
    commit,
    heartbeat,
    join,
    leave,
    peer,
    tick,
    updateProfile,
    view,
  };
}
