import { randomUUID } from "node:crypto";
import type { Query } from "./database.ts";
import type { Profile } from "../src/shared.ts";

type ReadProfile = (token: string) => Promise<Profile>;
type SaveProfile = (token: string, profile: Profile) => Promise<unknown>;

export class MarketError extends Error {}

export function marketplace(
  query: Query,
  read: ReadProfile,
  save: SaveProfile,
) {
  return {
    async browse(token: string) {
      const { rows } = await query(
        `SELECT l.id, l.seller, l.beast, l.price, l.currency, p.data
         FROM listings l JOIN profiles p ON p.token = l.seller
         ORDER BY l.posted DESC LIMIT 80`,
      );
      return {
        listings: rows.flatMap((offer) => {
          const seller: Profile = offer.data;
          const beast = seller.collection.find((b) => b.id === offer.beast);
          return beast
            ? [
                {
                  id: offer.id,
                  seller: seller.name,
                  mine: offer.seller === token,
                  beast,
                  price: offer.price,
                  currency: offer.currency,
                },
              ]
            : [];
        }),
        history: (
          await query(
            "SELECT species, price, sold_at::float8, currency FROM sales ORDER BY sold_at DESC LIMIT 10",
          )
        ).rows,
      };
    },
    async change(token: string, type: string, data: any) {
      const me = await read(token);
      if (type === "list") {
        const currency = data?.currency ?? "shards";
        if (
          !data ||
          !["shards", "WILD"].includes(currency) ||
          !Number.isSafeInteger(data.price) ||
          data.price < 1 ||
          data.price > 999 ||
          !me.collection.some((b) => b.id === data.beast) ||
          me.active === data.beast
        )
          throw new MarketError(
            "Select an owned reserve beast and a price from 1 to 999.",
          );
        const { rows } = await query(
          `INSERT INTO listings(id, seller, beast, price, currency)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (beast) DO NOTHING RETURNING id`,
          [randomUUID(), token, data.beast, data.price, currency],
        );
        if (!rows.length) throw new MarketError("Beast already listed.");
        return;
      }
      if (typeof data !== "string") throw new MarketError("Listing closed.");
      const {
        rows: [offer],
      } = await query("SELECT * FROM listings WHERE id=$1", [data]);
      if (!offer) throw new MarketError("Listing closed.");
      if (type === "unlist") {
        if (offer.seller !== token)
          throw new MarketError("Only the seller can withdraw this listing.");
      } else {
        const seller = await read(offer.seller);
        const index = seller.collection.findIndex((b) => b.id === offer.beast);
        const balance = offer.currency === "WILD" ? "wild" : "shards";
        if (
          offer.seller === token ||
          index < 0 ||
          seller.active === offer.beast ||
          (me[balance] ?? 0) < offer.price
        )
          throw new MarketError("This purchase could not be completed.");
        const [beast] = seller.collection.splice(index, 1);
        me[balance] = (me[balance] ?? 0) - offer.price;
        seller[balance] = (seller[balance] ?? 0) + offer.price;
        beast.history.push("Traded to " + me.name);
        me.collection.push(beast);
        await save(token, me);
        await save(offer.seller, seller);
        await query("INSERT INTO sales VALUES ($1, $2, $3, $4, $5)", [
          offer.id,
          beast.name,
          offer.price,
          Date.now(),
          offer.currency,
        ]);
      }
      await query("DELETE FROM listings WHERE id=$1", [data]);
    },
    async listed(id: string) {
      return !!(await query("SELECT 1 FROM listings WHERE beast=$1", [id])).rows
        .length;
    },
  };
}
