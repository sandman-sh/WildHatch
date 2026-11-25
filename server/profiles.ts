import { randomBytes, randomInt } from "node:crypto";
import type { Beast, Profile } from "../src/shared.ts";
import type { Query } from "./database.ts";

export function profiles(query: Query) {
  async function get(token: string): Promise<Profile | undefined> {
    if (!token) return;
    const { rows } = await query("SELECT data FROM profiles WHERE token=$1", [
      token,
    ]);
    return rows[0]?.data;
  }
  async function read(token: string): Promise<Profile> {
    const profile = await get(token);
    if (!profile) throw Error("Ranger profile is missing.");
    return profile;
  }
  async function save(token: string, profile: Profile) {
    await query("UPDATE profiles SET data=$1 WHERE token=$2", [
      JSON.stringify(profile),
      token,
    ]);
  }
  async function signedIn(token: string) {
    const profile = await get(token);
    return profile?.wallet ? profile : undefined;
  }
  async function create(starter: Beast) {
    const token = randomBytes(32).toString("hex");
    let name: string;
    do {
      name = "Ranger " + randomInt(100000, 1000000);
    } while (
      (
        await query(
          "SELECT 1 FROM profiles WHERE lower(data->>'name')=lower($1) LIMIT 1",
          [name],
        )
      ).rows.length
    );
    const profile: Profile = {
      name,
      orbs: 8,
      shards: 4,
      collection: [starter],
      active: starter.id,
      wins: 0,
    };
    await query("INSERT INTO profiles VALUES ($1, $2)", [
      token,
      JSON.stringify(profile),
    ]);
    return { token, profile };
  }
  return { get, read, save, signedIn, create };
}
