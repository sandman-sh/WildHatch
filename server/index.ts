import { createServer } from "node:http";
import api from "./api.ts";

createServer((req, res) => void api(req, res)).listen(
  Number(process.env.PORT || 8787),
  "127.0.0.1",
  () => console.log("WildHatch game server ready"),
);
