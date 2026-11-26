import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createApi } from "../server/api.ts";
import { EventEmitter, once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { starterRangers, rangers, ownsRanger } from "../src/rangers.ts";
import { wildReward, grantWildReward } from "../src/wildStore.ts";
import { walkable } from "../src/world.ts";
import { siteId, frontierSite } from "../src/frontier.ts";
import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import bs58 from "bs58";
import { beastStats, inheritedMutation } from "../src/shared.ts";
import { capture, claim, missions } from "../server/missions.ts";
import {
  buildCollectibleTransaction,
  prepareCollectible,
} from "../server/collectibles.ts";
import {
  beastMemo,
  beastMemoProgram,
  readBeastMemo,
} from "../src/collectibleTraits.ts";
import { Keypair, Transaction } from "@solana/web3.js";
const invalidIssuer = '["test-issuer-path-marker"]';
process.env.WILDHATCH_ISSUER_KEYPAIR = invalidIssuer;
delete process.env.WILDHATCH_ISSUER_KEYPAIR_JSON;
const pg = new PGlite();
await pg.exec(
  await readFile(
    new URL(
      "../supabase/migrations/20261125160000_wildhatch_multiplayer.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await pg.exec(`
  CREATE SCHEMA realtime;
  CREATE TABLE realtime.test_signals (payload jsonb, event text, topic text, private boolean);
  CREATE FUNCTION realtime.send(jsonb, text, text, boolean) RETURNS void
  LANGUAGE SQL AS 'INSERT INTO realtime.test_signals VALUES ($1, $2, $3, $4)';
`);
const transact = (_write, run) =>
  pg.transaction(async (tx) => {
    await tx.exec("SET LOCAL search_path = wildhatch");
    return run((sql, params) => tx.query(sql, params));
  });
const receiptAddress = Keypair.generate().publicKey.toBase58();
const testRoll = async (address, _wallet, item) => {
  assert.equal(address, receiptAddress);
  assert.equal(item, "prism");
  return 9;
};
const instances = [
  createApi(transact, testRoll),
  createApi(transact, testRoll),
];
let instance = 0;
const server = createServer(
  (req, res) => void instances[instance++ % 2](req, res),
);
server.listen(Number(process.env.TEST_PORT || 0), "127.0.0.1");
await once(server, "listening");
const base = "http://127.0.0.1:" + server.address().port;
const sockets = [];
const walletPost = (route, data) =>
  fetch(base + "/api/wallet/" + route, {
    method: "POST",
    headers: { origin: base, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
async function walletLogin(key) {
  const raw = key.publicKey
    .export({ format: "der", type: "spki" })
    .subarray(-32);
  const address = bs58.encode(raw);
  const response = await walletPost("challenge", { address });
  assert.equal(response.status, 200);
  const login = await response.json();
  const proof = {
    id: login.id,
    signature: sign(null, Buffer.from(login.message), key.privateKey).toString(
      "base64",
    ),
  };
  const auth = await walletPost("login", proof);
  assert.equal(auth.status, 200);
  assert.equal((await auth.json()).wallet, address);
  return { cookie: auth.headers.get("set-cookie").split(";")[0], proof };
}
const worldPost = (cookie, data) =>
  fetch(base + "/api/world", {
    method: "POST",
    headers: {
      origin: base,
      "Content-Type": "application/json",
      ...(cookie && { cookie }),
    },
    body: JSON.stringify(data),
  });
async function connect(mode, cookie, guestId, ranger) {
  const ws = new EventEmitter();
  const inbox = [];
  const client = randomBytes(18).toString("hex");
  let cursor = 0,
    closed = false,
    pending = Promise.resolve(),
    lastPoll = 0;
  async function request(op, message = {}) {
    const response = await worldPost(cookie, {
      op,
      mode,
      client,
      guest: guestId,
      after: cursor,
      ...message,
    });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    for (const event of result.events ?? []) {
      if (event.seq > cursor) inbox.push(event);
    }
    cursor = Math.max(cursor, result.cursor ?? 0);
    if (result.presence) {
      const old = inbox.findIndex((event) => event.type === "presence");
      if (old >= 0) inbox.splice(old, 1);
      inbox.push({ type: "presence", data: result.presence });
    }
  }
  let heartbeat = Date.now();
  function poll() {
    const now = Date.now();
    if (now - lastPoll < 70) return;
    lastPoll = now;
    pending = pending.then(() => {
      const op = now - heartbeat > 4000 ? "heartbeat" : "poll";
      if (op === "heartbeat") heartbeat = now;
      return request(op);
    });
  }
  const timer = setInterval(() => {
    if (Date.now() - heartbeat > 4000) poll();
  }, 2000);
  ws.close = () => {
    clearInterval(timer);
    if (closed) return;
    closed = true;
    pending = pending.then(() => request("leave")).then(() => ws.emit("close"));
  };
  ws.terminate = () => {
    clearInterval(timer);
    closed = true;
  };
  sockets.push(ws);
  async function next(type, accept = () => true) {
    for (let i = 0; i < 250; i++) {
      await pending;
      const n = inbox.findIndex((e) => e.type === type && accept(e.data));
      if (n >= 0) return inbox.splice(n, 1)[0].data;
      if (!closed) poll();
      await delay(15);
    }
    throw Error("Timed out waiting for " + type);
  }
  await request("join", { ranger });
  await next("joined");
  const profile = await next("profile");
  const spawn = mode === "pvp" ? null : await next("position");
  return {
    client,
    cookie,
    profile,
    spawn,
    next,
    inbox,
    ws,
    send: (type, data) => {
      pending = pending.then(() => request("action", { type, data }));
    },
  };
}
async function ranger(
  mode = "normal",
  key = generateKeyPairSync("ed25519"),
  choice,
) {
  const { cookie } = await walletLogin(key);
  return connect(mode, cookie, undefined, choice);
}
try {
  assert.equal((await fetch(base + "/api/profile")).status, 401);
  assert.deepEqual(await (await fetch(base + "/api/session")).json(), {
    wallet: null,
  });
  for (const mode of ["normal", "pvp"]) {
    const response = await worldPost(undefined, {
      op: "join",
      mode,
      client: randomBytes(18).toString("hex"),
    });
    assert.equal(response.status, 401);
  }
  const key = generateKeyPairSync("ed25519");
  const a = await ranger("normal", key, 7),
    b = await ranger();
  const traitBeast = {
    ...a.profile.collection[0],
    variant: 45628,
    stage: 2,
    level: 8,
    marking: "Jade",
    mutation: "Ancient Grove",
    history: ["Private ranger history"],
  };
  const memo = beastMemo(traitBeast);
  assert.ok(Buffer.byteLength(memo) < 400);
  assert.deepEqual(readBeastMemo(memo), {
    id: traitBeast.id,
    species: traitBeast.name,
    element: "Nature",
    variant: 45628,
    rarity: traitBeast.rarity,
    personality: traitBeast.personality,
    stage: 2,
    level: 8,
    marking: "Jade",
    mutation: "Ancient Grove",
  });
  assert.equal(
    readBeastMemo(memo.replace('"variant":45628', '"variant":"bad"')),
    undefined,
  );
  const owner = Keypair.generate(),
    issuer = Keypair.generate();
  const signedMint = buildCollectibleTransaction(
    traitBeast,
    owner.publicKey,
    issuer,
    {
      blockhash: Keypair.generate().publicKey.toBase58(),
      lastValidBlockHeight: 100,
    },
  );
  signedMint.partialSign(owner);
  const serializedMint = signedMint.serialize();
  const roundTrip = Transaction.from(serializedMint);
  assert.ok(serializedMint.length <= 1232);
  assert.ok(roundTrip.verifySignatures());
  assert.equal(
    roundTrip.instructions[1].programId.toBase58(),
    beastMemoProgram,
  );
  assert.ok(roundTrip.instructions[1].keys[0].pubkey.equals(issuer.publicKey));
  assert.equal(roundTrip.instructions[1].data.toString("utf8"), memo);
  for (const [first, second, trait] of [
    ["Cinderclaw", "Aquabit", "Steam"],
    ["Crystalimp", "Mosskin", "Ancient Grove"],
    ["Emberling", "Prismtail", "Magma Crystal"],
    ["Bubblefin", "Snowpup", "Glacier"],
  ]) {
    assert.equal(inheritedMutation(first, second), trait);
    assert.equal(inheritedMutation(second, first), trait);
  }
  assert.equal(inheritedMutation("Mosskin", "Bloomtail"), undefined);
  const missionProfile = structuredClone(a.profile);
  const daily = missions(missionProfile).find((task) =>
    task.id.startsWith("day-"),
  );
  assert.equal(claim(missionProfile, daily.id), false);
  capture(missionProfile);
  capture(missionProfile);
  assert.equal(claim(missionProfile, daily.id), true);
  assert.equal(claim(missionProfile, daily.id), false);
  assert.equal(missionProfile.shards, a.profile.shards + daily.reward);
  // A periodic empty snapshot can arrive before the second ranger has joined.
  assert.equal(
    (await a.next("presence", (peers) => peers.length > 0)).length,
    1,
  );
  const rename = (name, cookie) =>
    fetch(base + "/api/profile/username", {
      method: "POST",
      headers: {
        origin: base,
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ name }),
    });
  assert.equal((await rename("Briar Scout")).status, 401);
  assert.equal((await rename("Guest 12345", a.cookie)).status, 400);
  assert.equal((await rename("Ranger 🐉", a.cookie)).status, 400);
  const savedName = await rename(" Briar  Scout ", a.cookie);
  assert.equal(savedName.status, 200);
  assert.deepEqual(await savedName.json(), { name: "Briar Scout" });
  assert.equal((await rename("briar scout", b.cookie)).status, 409);
  a.profile = await a.next("profile");
  assert.equal(a.profile.name, "Briar Scout");
  await b.next("presence", (peers) =>
    peers.some((peer) => peer.name === "Briar Scout"),
  );
  const renamed = await fetch(base + "/api/profile", {
    headers: { cookie: a.cookie },
  });
  assert.equal((await renamed.json()).name, "Briar Scout");
  await assert.rejects(
    prepareCollectible(
      {
        ...a.profile,
        collection: a.profile.collection.map((beast) => ({
          ...beast,
          name: "Lanternfrog",
        })),
      },
      a.profile.active,
    ),
    /in-game collectible/,
  );
  const failedMint = await fetch(base + "/api/collectible", {
    method: "POST",
    headers: {
      origin: base,
      cookie: a.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ beast: a.profile.active }),
  });
  assert.equal(failedMint.status, 400);
  assert.deepEqual(await failedMint.json(), {
    error: "The Devnet collectible issuer keypair could not be loaded.",
  });
  const session = await fetch(base + "/api/session", {
    headers: { cookie: a.cookie },
  });
  assert.equal((await session.json()).wallet, a.profile.wallet);
  await pg.query(
    "UPDATE wildhatch.profiles SET data=jsonb_set(data,'{wild}','5') WHERE data->>'wallet'=$1",
    [a.profile.wallet],
  );
  a.send("openCache", "charm");
  const charmed = await a.next("profile", (p) => p.charms === 1);
  assert.equal(charmed.wild, 0);
  let orbs = a.profile.orbs,
    caught = false,
    offspringParents = [];
  for (let i = 0; i < 8 && !caught; i++) {
    await delay(265);
    a.send("encounter", 0);
    const offer = await a.next("encounter");
    assert.equal(offer.index, 0);
    assert.equal(offer.chance, 74 - offer.rarityPenalty + (i === 0 ? 10 : 0));
    for (let j = 0; j < 2; j++) {
      a.send("study");
      const studied = await a.next("encounter");
      assert.equal(studied.chance, Math.min(90, offer.chance + 8));
      assert.equal(studied.focusChance, Math.min(90, studied.chance + 10));
    }
    const focused = i === 0;
    if (!orbs) {
      a.send("supply");
      orbs = (await a.next("profile")).orbs;
      await delay(265);
    }
    a.send("capture", focused ? "focus" : "standard");
    const p = await a.next("profile");
    orbs -= focused ? 2 : 1;
    assert.equal(p.orbs, orbs);
    assert.equal(p.charms, 0);
    caught = p.collection.length === 2;
    if (caught) {
      offspringParents = p.collection.map((b) => b.id);
      assert.equal((await a.next("caught")).beast.id, offspringParents[1]);
    } else assert.equal((await a.next("escaped")).cost, focused ? 2 : 1);
  }
  assert.ok(caught);
  await delay(265);
  a.send("breed", offspringParents);
  const bred = await a.next("profile");
  assert.deepEqual(bred.collection[2].parents, offspringParents);
  for (let i = 0; i < 2; i++) {
    await delay(260);
    a.send("train", a.profile.active);
    await a.next("profile");
  }
  await delay(260);
  a.send("evolve", a.profile.active);
  const evolved = await a.next("profile");
  assert.equal(evolved.collection[0].stage, 2);
  assert.equal(evolved.rangerXp, 36);
  await delay(265);
  a.send("marking", { id: evolved.active, marking: "Violet" });
  assert.equal((await a.next("profile")).collection[0].marking, "Violet");
  await delay(270);
  a.send("queue");
  await a.next("queue");
  b.send("queue");
  let d = await a.next("battle");
  await b.next("battle");
  assert.equal(d.max[d.you], beastStats(evolved.collection[0]).health);
  while (d.hp.every((h) => h > 0)) {
    await delay(265);
    (d.turn === d.you ? a : b).send("attack", "Strike");
    d = await a.next("battle");
    assert.equal(d.lastMove.name, "Strike");
    assert.ok(d.lastMove.damage > 0);
    await b.next("battle");
  }
  const ea = await a.next("end"),
    eb = await b.next("end");
  assert.notEqual(ea, eb);
  const persisted = await (
    await fetch(base + "/api/profile", { headers: { cookie: a.cookie } })
  ).json();
  assert.equal(persisted.collection.length, 3);
  assert.equal(persisted.collection[0].stage, 2);
  assert.equal(persisted.collection[0].marking, "Violet");
  assert.equal(persisted.wins, 1);
  assert.equal(persisted.wild, 12);
  const auth = await walletLogin(key);
  assert.equal(auth.cookie, a.cookie);
  assert.equal((await walletPost("login", auth.proof)).status, 401);
  await delay(265);
  a.send("buyOrbs");
  const supplied = await a.next("profile", (state) => state.wild === 8);
  assert.equal(supplied.orbs, persisted.orbs + 4);
  await delay(265);
  a.send("openCache", "trail");
  const loot = await a.next("cacheOpened");
  assert.equal(loot.kind, "trail");
  assert.ok(
    !starterRangers.includes(loot.ranger) &&
      rangers.some((r) => r.id === loot.ranger),
  );
  assert.equal(loot.orbs, 3);
  assert.equal(loot.shards + loot.charms, 1);
  assert.equal(
    (await a.next("profile", (state) => state.wild === 2)).shards,
    supplied.shards + loot.shards,
  );
  await delay(265);
  a.send("list", { beast: persisted.collection[2].id, price: 2 });
  const market = await a.next("market");
  assert.equal(market.listings.length, 1);
  await delay(265);
  b.send("buy", market.listings[0].id);
  const sold = await b.next("market");
  assert.equal(sold.history[0].price, 2);
  const buyer = await (
    await fetch(base + "/api/profile", { headers: { cookie: b.cookie } })
  ).json();
  assert.ok(buyer.collection.some((c) => c.id === persisted.collection[2].id));
  await delay(265);
  b.send("list", {
    beast: persisted.collection[2].id,
    price: 2,
    currency: "WILD",
  });
  const escrow = await b.next("market", (result) =>
    result.listings.some((entry) => entry.currency === "WILD"),
  );
  a.send("buy", escrow.listings[0].id);
  await a.next("market", (result) => result.history[0]?.currency === "WILD");
  const received = await a.next("profile", (state) => state.wild === 0);
  assert.ok(
    received.collection.some((c) => c.id === persisted.collection[2].id),
  );
  assert.equal(
    (await b.next("profile", (state) => state.wild === 2)).collection.length,
    1,
  );
  const visitors = await Promise.all(Array.from({ length: 7 }, () => ranger()));
  await a.next("presence", (list) => list.length === 8);
  const ninth = visitors.at(-1);
  await ninth.next("presence", (list) =>
    list.some((peer) => peer.name === a.profile.name),
  );
  const overflow = await Promise.all(
    Array.from({ length: 15 }, () =>
      connect("guest", undefined, randomBytes(18).toString("hex")),
    ),
  );
  const arrivals = [a, b, ...visitors, ...overflow].map((peer) => peer.spawn);
  for (const [index, [x, z]] of arrivals.entries())
    for (const [otherX, otherZ] of arrivals.slice(0, index))
      assert.ok(Math.hypot(x - otherX, z - otherZ) >= 3);
  await Promise.all(
    overflow.map(({ ws }) => {
      ws.close();
      return once(ws, "close");
    }),
  );
  const id = siteId(2, 0, 0),
    h = frontierSite(id);
  for (const q of [a, b]) {
    await delay(265);
    q.send("ferry");
    assert.deepEqual(await q.next("ferry"), [h[1] - 3, h[2] + 2]);
    q.send("encounter", id);
  }
  const offer = await a.next("encounter", (e) => e.index === id);
  assert.ok(offer.base >= 48 && offer.base <= 63);
  assert.equal(offer.chance, offer.base - offer.rarityPenalty);
  assert.deepEqual(await b.next("encounter", (e) => e.index === id), offer);
  a.send("study");
  await a.next("encounter", (e) => e.index === id && e.studied);
  for (let i = 0; i < 3; i++) {
    await delay(265);
    a.send("move", { x: h[1] - 3 + i, z: h[2] + 2, yaw: 0 });
  }
  await b.next("presence", (peers) =>
    peers.some((q) => Math.abs(q.x - (h[1] - 1)) < 0.01),
  );
  await delay(265);
  a.send("ferry");
  assert.deepEqual(await a.next("ferry"), [0, 0]);
  await delay(265);
  a.send("inviteCreate");
  const invitation = await a.next("invite");
  ninth.send("inviteJoin", invitation.code);
  const privateMatch = await a.next("battle");
  assert.equal(privateMatch.hp.length, 2);
  assert.ok(privateMatch.expires > Date.now());
  await ninth.next("battle");
  console.log(
    "PASS: 24 separated spawns in one world, shared frontier habitat, frontier movement and camp return",
  );

  const guestId = "00000001" + randomBytes(14).toString("hex");
  const visitor = await connect("guest", undefined, guestId);
  await transact(true, async (query) => {
    const {
      rows: [{ state }],
    } = await query("SELECT state FROM world WHERE id=1");
    const guest = state.guests.find(([id]) => id === guestId)[1];
    guest.expires = Date.now() - 1;
    await query("UPDATE world SET state=$1 WHERE id=1", [
      JSON.stringify(state),
    ]);
  });
  const another = await connect(
    "guest",
    b.cookie,
    "00000002" + randomBytes(14).toString("hex"),
  );
  assert.match(visitor.profile.name, /^Guest \d{5}$/);
  assert.notEqual(another.profile.name, visitor.profile.name);
  assert.equal(another.profile.wallet, undefined);
  assert.equal(visitor.profile.orbs, 3);
  const malformedMovement = await worldPost(undefined, {
    op: "action",
    mode: "guest",
    client: randomBytes(18).toString("hex"),
    guest: guestId,
    type: "move",
    data: null,
  });
  assert.equal(malformedMovement.status, 400);
  const visibleVisitor = (
    await a.next("presence", (list) =>
      list.some((peer) => peer.name === visitor.profile.name),
    )
  ).find((peer) => peer.name === visitor.profile.name);
  assert.equal(visibleVisitor.ranger, 6);
  assert.equal(
    (
      await visitor.next("presence", (list) =>
        list.some((peer) => peer.name === a.profile.name),
      )
    ).find((peer) => peer.name === a.profile.name).ranger,
    7,
  );
  assert.equal(
    (
      await a.next("presence", (list) =>
        list.some((peer) => peer.name === another.profile.name),
      )
    ).find((peer) => peer.name === another.profile.name).ranger,
    7,
  );
  assert.equal(visibleVisitor.beast, null);
  assert.equal(visibleVisitor.guest, true);
  await visitor.next("presence", (list) =>
    [a.profile.name, another.profile.name].every((name) =>
      list.some((peer) => peer.name === name),
    ),
  );
  for (let left = 2; left >= 0; left--) {
    if (left < 2) await delay(265);
    visitor.send("encounter", 0);
    await visitor.next("encounter");
    visitor.send("capture", "standard");
    const state = await visitor.next("profile");
    assert.equal(state.orbs, left);
    assert.deepEqual(state.collection, []);
    assert.equal(state.rangerXp, undefined);
    const result = visitor.inbox.findIndex((event) =>
      ["caught", "escaped"].includes(event.type),
    );
    assert.ok(result >= 0);
    const outcome = visitor.inbox.splice(result, 1)[0];
    if (outcome.type === "caught") assert.equal(outcome.data.practice, true);
  }
  await delay(265);
  for (const action of [
    "supply",
    "queue",
    "breed",
    "bossStrike",
    "openCache",
    "claim",
  ])
    visitor.send(action);
  visitor.send("encounter", 0);
  await visitor.next("encounter");
  visitor.send("capture", "standard");
  await visitor.next("captureUnavailable");
  assert.equal(
    visitor.inbox.some(({ type }) =>
      ["profile", "queue", "battle", "cacheOpened"].includes(type),
    ),
    false,
  );
  const resumed = await worldPost(undefined, {
    op: "join",
    mode: "guest",
    client: visitor.client,
    guest: guestId,
  });
  assert.equal(resumed.status, 200);
  const resumeState = await resumed.json();
  assert.deepEqual(
    resumeState.events.map((event) => event.type),
    ["joined", "profile", "position", "habitats"],
  );
  const origin = resumeState.events.find((e) => e.type === "position").data;
  let direction;
  for (let i = 0; i < 64 && !direction; i++) {
    const dx = Math.cos((i * Math.PI) / 32),
      dz = Math.sin((i * Math.PI) / 32);
    if (
      Array.from({ length: 70 }, (_, n) => (n + 1) / 4).every((d) =>
        walkable(origin[0] + dx * d, origin[1] + dz * d),
      )
    )
      direction = [dx, dz];
  }
  assert.ok(direction, "expected a clear route out of the guest spawn");
  const point = (distance) =>
    origin.map((v, axis) => v + distance * direction[axis]);
  const move = async (distance, after, path = []) => {
    const [x, z] = point(distance);
    const response = await worldPost(undefined, {
      op: "action",
      type: "move",
      client: visitor.client,
      guest: guestId,
      mode: "guest",
      after,
      data: { x, z, yaw: 0, path },
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  await delay(1800);
  const delayed = await move(15, resumeState.cursor, [point(7)]);
  assert.equal(delayed.events.length, 0, "valid delayed sprint was corrected");
  const burst = await move(16.5, delayed.cursor);
  assert.equal(
    burst.events.length,
    0,
    "closely spaced update lost travel credit",
  );
  const rejected = await move(1000, burst.cursor);
  const correction = rejected.events.find((e) => e.type === "position");
  assert.deepEqual(
    correction?.data,
    point(16.5),
    "correction must use the last accepted position",
  );
  const stale = await move(15, burst.cursor);
  assert.equal(
    stale.cursor,
    rejected.cursor,
    "stale movement triggered another correction",
  );
  const afterCorrection = await move(1000, stale.cursor);
  assert.deepEqual(
    afterCorrection.events[0]?.data,
    point(16.5),
    "stale movement overwrote the correction",
  );
  console.log(
    "PASS: delayed sprint, burst movement and stale updates after a correction",
  );
  visitor.ws.close();
  await once(visitor.ws, "close");
  const rejoined = await connect("guest", undefined, guestId, 0);
  assert.equal(
    (
      await a.next("presence", (list) =>
        list.some((peer) => peer.name === rejoined.profile.name),
      )
    ).find((peer) => peer.name === rejoined.profile.name).ranger,
    6,
  );
  console.log(
    "PASS: guests have session-specific characters and signed-in players publish their chosen character at spawn",
  );
  assert.deepEqual(rejoined.profile, { ...visitor.profile, orbs: 0 });

  const [host, challenger, third] = await Promise.all(
    Array.from({ length: 3 }, () => ranger("pvp")),
  );
  host.send("inviteCreate");
  const code = (await host.next("invite")).code;
  challenger.send("inviteJoin", code);
  const match = await host.next("battle");
  assert.deepEqual(match.players, [host.profile.name, challenger.profile.name]);
  assert.equal(match.hp.length, 2);
  await challenger.next("battle");
  third.send("inviteJoin", code);
  assert.match(await third.next("notice"), /expired/);
  assert.equal(
    third.inbox.some(({ type }) => type === "battle" || type === "presence"),
    false,
  );
  const redeem = (cookie) =>
    fetch(base + "/api/wild-receipt", {
      method: "POST",
      headers: { origin: base, cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ item: "prism", box: receiptAddress }),
    });
  const receipts = await Promise.all([
    redeem(third.cookie),
    redeem(third.cookie),
  ]);
  let earned;
  for (const receipt of receipts) {
    assert.equal(receipt.status, 200);
    const reward = await receipt.json();
    earned ??= reward.ranger;
    assert.ok(
      rangers.some((r) => r.id === earned) && !starterRangers.includes(earned),
    );
    assert.deepEqual(reward, {
      ranger: earned,
      orbs: 4,
      shards: 3,
      charms: 0,
      aurora: true,
    });
  }
  assert.equal((await redeem(host.cookie)).status, 400);
  const updated = (
    await pg.query(
      "SELECT data FROM wildhatch.profiles WHERE data->>'name'=$1",
      [third.profile.name],
    )
  ).rows[0].data;
  assert.equal(updated.orbs, third.profile.orbs + 4);
  assert.equal(updated.shards, third.profile.shards + 3);
  assert.equal(updated.aurora, true);
  assert.deepEqual(updated.unlockedRangers, [earned]);
  const walletRoster = async (cookie) =>
    (await fetch(base + "/api/session", { headers: { cookie } })).json();
  assert.deepEqual((await walletRoster(third.cookie)).unlockedRangers, [
    earned,
  ]);
  assert.deepEqual((await walletRoster(host.cookie)).unlockedRangers, []);
  for (const [player, expected] of [
    [third, earned],
    [host, starterRangers[0]],
  ]) {
    const join = await worldPost(player.cookie, {
      op: "join",
      mode: "pvp",
      client: player.client,
      ranger: earned,
    });
    assert.equal(join.status, 200);
    const peer = (
      await pg.query(
        "SELECT state FROM wildhatch.world_peers WHERE state->>'client'=$1",
        [player.client],
      )
    ).rows[0].state;
    assert.equal(peer.ranger, expected);
  }
  assert.deepEqual(starterRangers, [0, 6, 7, 8, 9, 10]);
  const almostFull = {
    orbs: 0,
    shards: 0,
    unlockedRangers: rangers.slice(6, -1).map((r) => r.id),
  };
  for (let i = 0; i < 2; i++) {
    const reward = wildReward("trail", 33);
    grantWildReward(almostFull, reward, 99);
    assert.equal(reward.ranger, i === 0 ? rangers.at(-1).id : undefined);
  }
  assert.ok(rangers.every((r) => ownsRanger(r.id, almostFull.unlockedRangers)));
  assert.equal(almostFull.orbs, 6);
  console.log(
    "PASS: starter roster, wallet-bound box unlock, equip authorization and completed roster",
  );
  console.log(
    "PASS: concurrent box redemptions grant once and bind the reward to the purchasing wallet",
  );
  const signals = await pg.query(
    "SELECT DISTINCT payload, event, topic, private FROM realtime.test_signals",
  );
  assert.deepEqual(signals.rows, [
    { payload: {}, event: "wake", topic: "wildhatch:world", private: false },
  ]);
  console.log(
    "PASS: authenticated arena, two-player invites, mixed-mode presence, practice orb cap and guest reconnect",
  );
  console.log(
    "PASS: wallet login and replay protection, capture and breeding, duel rewards, WILD purchases, boxes, private invite, and atomic creature escrow",
  );
} finally {
  for (const ws of sockets) ws.terminate();
  await new Promise((resolve) => server.close(resolve));
  await pg.close();
}
