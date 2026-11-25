import type { Beast } from "./shared.ts";

export type PlayMode = "normal" | "guest" | "pvp";

export type WorldPlayer = {
  id: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
  ranger: number;
  guest: boolean;
  beast: Beast | null;
};
