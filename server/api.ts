import { createHash, randomInt, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { PlayMode } from "../src/playMode.ts";
import { validateUsername } from "../src/username.ts";
import {
  grantWildReward,
  isWildItem,
  mysteryBox,
  wildReward,
} from "../src/wildStore.ts";
import { prepareCollectible } from "./collectibles.ts";
import { database, type Database, type Query } from "./database.ts";
import { profiles } from "./profiles.ts";
import { challenge, check } from "./wallet.ts";
import { verifiedBoxRoll, verifyWildBurn } from "./wildBurn.ts";
import { beast, openWorld, WorldError } from "./world.ts";

const posts = new Set([
  "/api/wallet/challenge",
  "/api/wallet/login",
  "/api/collectible",
  "/api/wild-receipt",
  "/api/profile/username",
  "/api/world",
]);

function tokenFor(req: IncomingMessage) {
  return (
    req.headers.cookie?.match(/(?:^|;\s*)bb=([a-f0-9]{64})(?:;|$)/)?.[1] ?? ""
  );
}

function sendJson(res: ServerResponse, data: unknown, status = 200) {
  res
    .writeHead(status, { "Content-Type": "application/json" })
    .end(JSON.stringify(data));
}

function realtimeConfig() {
  const url = URL.parse(process.env.WILDHATCH_SUPABASE_URL ?? "");
  const key = process.env.WILDHATCH_SUPABASE_PUBLISHABLE_KEY;
  if (
    !url ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !key ||
    !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)
  )
    return undefined;
  return { url: url.origin, key };
}

async function postBody(req: IncomingMessage & { body?: unknown }) {
  const max = 4096;
  if (Number(req.headers["content-length"]) > max)
    throw new WorldError("Request is too large.", 413);
  try {
    if (req.body !== undefined) {
      const raw =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      if (Buffer.byteLength(raw) > max)
        throw new WorldError("Request is too large.", 413);
      return JSON.parse(raw);
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += Buffer.byteLength(chunk);
      if (size > max) throw new WorldError("Request is too large.", 413);
      chunks.push(Buffer.from(chunk));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof WorldError) throw error;
    throw new WorldError("Invalid request body.", 400);
  }
}

export function createApi(transact: Database, readBoxRoll = verifiedBoxRoll) {
  return async function api(
    req: IncomingMessage,
    res: ServerResponse,
    route?: string,
  ) {
    res.setHeader("Cache-Control", "no-store");
    const path = route ?? req.url?.split("?")[0] ?? "";
    const token = tokenFor(req);
    try {
      if (
        req.method === "GET" &&
        (path === "/api/session" || path === "/api/profile")
      ) {
        const profile = await transact(false, (query) =>
          profiles(query).signedIn(token),
        );
        if (path === "/api/session")
          return sendJson(
            res,
            profile
              ? {
                  wallet: profile.wallet,
                  unlockedRangers: profile.unlockedRangers ?? [],
                }
              : { wallet: null },
          );
        if (!profile)
          throw new WorldError("Sign in with your Solana wallet.", 401);
        return sendJson(res, profile);
      }
      if (req.method !== "POST" || !posts.has(path))
        return void res.writeHead(404).end();
      const origin = URL.parse(req.headers.origin ?? "");
      if (
        !origin ||
        origin.host !== req.headers.host ||
        !["http:", "https:"].includes(origin.protocol)
      )
        throw new WorldError("Invalid request origin.", 403);
      const data = await postBody(req);
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new WorldError("Invalid request body.", 400);

      if (path === "/api/world") {
        const { op, mode, client, guest, type, after = 0 } = data;
        if (
          !["join", "action", "poll", "heartbeat", "leave"].includes(op) ||
          !["normal", "pvp", "guest"].includes(mode) ||
          typeof client !== "string" ||
          !/^[a-f0-9]{36}$/.test(client) ||
          !Number.isSafeInteger(after) ||
          after < 0 ||
          (op === "action" && (typeof type !== "string" || type.length > 30))
        )
          throw new WorldError("Invalid world request.", 400);
        if (
          mode === "guest" &&
          (typeof guest !== "string" || !/^[a-f0-9]{36}$/.test(guest))
        )
          throw new WorldError("A valid visitor session is required.", 400);
        if (mode !== "guest" && !token)
          throw new WorldError("Sign in with your Solana wallet.", 401);
        const key: string = mode === "guest" ? guest : token;
        const moving = op === "action" && type === "move";
        if (
          moving &&
          ![data.data?.x, data.data?.z, data.data?.yaw].every(Number.isFinite)
        )
          throw new WorldError("Invalid movement coordinates.", 400);
        if (moving && data.data.path !== undefined) {
          const path = data.data.path;
          if (
            !Array.isArray(path) ||
            path.length > 48 ||
            !path.every(
              (point) =>
                Array.isArray(point) &&
                point.length === 2 &&
                point.every(Number.isFinite),
            )
          )
            throw new WorldError("Invalid movement path.", 400);
        }
        const scoped = moving || op === "poll";
        const result = await transact(op !== "poll", async (query) => {
          const world = await openWorld(
            query,
            scoped
              ? {
                  token: key,
                  guest: mode === "guest",
                  readOnly: op === "poll",
                }
              : undefined,
          );
          if (!scoped) await world.tick();
          const session =
            op === "join"
              ? await world.join(key, mode as PlayMode, client, data.ranger)
              : { peer: world.peer(key, client), after };
          const { peer } = session;
          if (peer.mode !== mode)
            throw new WorldError("Your expedition connection expired.", 410);
          if (op === "leave") {
            await world.leave(peer);
            await world.commit(true);
            return {};
          }
          if (op === "heartbeat") world.heartbeat(peer, after);
          if (op === "action") await world.action(peer, type, data.data, after);
          if (op !== "poll") await world.commit(op !== "heartbeat");
          const state = await world.view(peer, session.after, !moving);
          if (op !== "join") return state;
          return { ...state, realtime: realtimeConfig() };
        });
        return sendJson(res, result);
      }

      if (path === "/api/profile/username") {
        const result = validateUsername(data.name);
        if ("error" in result) throw new WorldError(result.error, 400);
        await transact(true, async (query) => {
          const profile = await profiles(query).signedIn(token);
          if (!profile)
            throw new WorldError(
              "Connect your wallet to edit your username.",
              401,
            );
          const { rows } = await query(
            `UPDATE profiles SET data = jsonb_set(data, '{name}', to_jsonb($1::text))
             WHERE token=$2 AND NOT EXISTS (
               SELECT 1 FROM profiles WHERE token<>$2 AND lower(data->>'name')=lower($1)
             ) RETURNING data`,
            [result.name, token],
          );
          if (!rows.length)
            throw new WorldError("That username is already taken.", 409);
          const world = await openWorld(query);
          world.updateProfile(token, rows[0].data);
          await world.commit(true);
        });
        return sendJson(res, { name: result.name });
      }

      if (path === "/api/collectible") {
        const profile = await transact(false, (query) =>
          profiles(query).signedIn(token),
        );
        if (!profile)
          throw new WorldError("Sign in with your Solana wallet.", 401);
        try {
          return sendJson(res, await prepareCollectible(profile, data.beast));
        } catch (error) {
          throw new WorldError(
            error instanceof Error
              ? error.message
              : "Could not prepare collectible.",
            400,
          );
        }
      }

      if (path === "/api/wild-receipt") {
        const { item, box } = data;
        const signature = box === undefined ? data.signature : box;
        const receiptPattern =
          box === undefined
            ? /^[1-9A-HJ-NP-Za-km-z]{64,88}$/
            : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        if (
          !isWildItem(item) ||
          typeof signature !== "string" ||
          !receiptPattern.test(signature)
        )
          throw new WorldError(
            "A signed-in wallet and a valid Devnet payment receipt are required.",
            400,
          );
        const readReceipt = async (query: Query) =>
          (
            await query(
              "SELECT owner, item, reward FROM wild_receipts WHERE signature=$1",
              [signature],
            )
          ).rows[0];
        const { profile, prior } = await transact(false, async (query) => ({
          profile: await profiles(query).signedIn(token),
          prior: await readReceipt(query),
        }));
        if (!profile?.wallet)
          throw new WorldError("A signed-in wallet is required.", 400);
        const wallet = profile.wallet;
        let roll = 0;
        if (!prior) {
          try {
            if (box !== undefined) roll = await readBoxRoll(box, wallet, item);
            else await verifyWildBurn(signature, wallet, item);
          } catch (error) {
            throw new WorldError(
              error instanceof Error
                ? error.message
                : "Devnet receipt could not be redeemed.",
              400,
            );
          }
        }
        const reward = await transact(true, async (query) => {
          const { read, save } = profiles(query);
          const used = await readReceipt(query);
          const current = await read(token);
          if (
            current.wallet !== wallet ||
            (used && (used.owner !== wallet || used.item !== item))
          )
            throw new WorldError(
              "Receipt already belongs to another purchase.",
              400,
            );
          if (used) return used.reward;
          const reward = wildReward(item, roll);
          // Older clients burned SPL tokens directly. Honor those receipts with their original loot table.
          if (box === undefined && mysteryBox(item)) {
            const legacy = randomInt(100);
            const bonus = legacy < (item === "trail" ? 30 : 25);
            reward.orbs = bonus ? 0 : item === "trail" ? 3 : 4;
            reward.shards = item === "trail" ? (bonus ? 4 : 1) : bonus ? 8 : 3;
            reward.aurora = false;
            reward.charms = 0;
          }
          // Bind character selection to this verified opening and its VRF result.
          const explorerSeed =
            box === undefined
              ? undefined
              : createHash("sha256")
                  .update("wildhatch/explorer/v1/" + box + "/" + roll)
                  .digest()
                  .readUInt32LE(0);
          grantWildReward(current, reward, explorerSeed);
          await save(token, current);
          await query("INSERT INTO wild_receipts VALUES ($1, $2, $3, $4)", [
            signature,
            wallet,
            item,
            JSON.stringify(reward),
          ]);
          const world = await openWorld(query);
          world.updateProfile(token, current);
          await world.commit(true);
          return reward;
        });
        return sendJson(res, reward);
      }

      if (path === "/api/wallet/challenge") {
        let pending: ReturnType<typeof challenge>;
        try {
          pending = challenge(data.address, origin.origin);
        } catch {
          throw new WorldError("Wallet sign-in request was invalid.", 400);
        }
        const id = randomUUID();
        await transact(true, async (query) => {
          await query("DELETE FROM login_challenges WHERE expires<=$1", [
            Date.now(),
          ]);
          const {
            rows: [row],
          } = await query(
            "SELECT count(*)::int AS total FROM login_challenges",
          );
          if (row.total >= 1024)
            throw new WorldError("Try again shortly.", 429);
          await query("INSERT INTO login_challenges VALUES ($1, $2, $3)", [
            id,
            JSON.stringify({ ...pending, guest: token, origin: origin.origin }),
            pending.expires,
          ]);
        });
        return sendJson(res, { id, message: pending.message });
      }

      if (typeof data.id !== "string" || !/^[a-f0-9-]{36}$/.test(data.id))
        throw new WorldError("Wallet signature could not be verified.", 401);
      const session = await transact(true, async (query) => {
        const {
          rows: [row],
        } = await query("SELECT pending FROM login_challenges WHERE id=$1", [
          data.id,
        ]);
        const pending = row?.pending;
        if (
          !pending ||
          pending.guest !== token ||
          pending.origin !== origin.origin ||
          !check(pending, data.signature)
        )
          throw new WorldError("Wallet signature could not be verified.", 401);
        await query("DELETE FROM login_challenges WHERE id=$1", [data.id]);
        const {
          rows: [linked],
        } = await query("SELECT token FROM wallets WHERE address=$1", [
          pending.address,
        ]);
        const account = profiles(query);
        if (linked) {
          const profile = await account.read(linked.token);
          return {
            token: linked.token,
            address: pending.address,
            unlockedRangers: profile.unlockedRangers ?? [],
          };
        }
        const { token: created, profile } = await account.create(
          beast("Mosskin"),
        );
        profile.wallet = pending.address;
        await account.save(created, profile);
        await query("INSERT INTO wallets VALUES ($1, $2)", [
          pending.address,
          created,
        ]);
        return {
          token: created,
          address: pending.address,
          unlockedRangers: [],
        };
      });
      res.setHeader(
        "Set-Cookie",
        "bb=" +
          session.token +
          "; HttpOnly; SameSite=Strict; Max-Age=31536000; Path=/" +
          (origin.protocol === "https:" ? "; Secure" : ""),
      );
      return sendJson(res, {
        wallet: session.address,
        unlockedRangers: session.unlockedRangers,
      });
    } catch (error) {
      if (error instanceof WorldError)
        return sendJson(res, { error: error.message }, error.status);
      console.error("WildHatch API request failed", {
        route: path,
        code: (error as NodeJS.ErrnoException)?.code ?? "unavailable",
      });
      return sendJson(
        res,
        { error: "The WildHatch server is temporarily unavailable." },
        503,
      );
    }
  };
}

export default createApi(database);
