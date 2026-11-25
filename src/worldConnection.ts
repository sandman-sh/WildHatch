import type { PlayMode } from "./playMode";

type Message = { type: string; data?: any };
type Reply = {
  cursor: number;
  events: (Message & { seq: number })[];
  presence?: unknown[];
  realtime?: { url: string; key: string };
};
type Operation = "join" | "poll" | "heartbeat" | "action";

function secret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(18)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}

let guestKey = "";
export function connectWorld(
  mode: PlayMode,
  receive: (message: Message) => void,
  disconnected: (reason: string, retry: boolean) => void,
) {
  // The wallet cookie identifies the player. This key identifies the live tab.
  const client = (tabKey ||= secret());
  if (mode === "guest")
    guestKey ||= sessionStorage.getItem("wildhatch-guest") || secret();
  if (mode === "guest") sessionStorage.setItem("wildhatch-guest", guestKey);

  let cursor = 0;
  let ready = false;
  let closed = false;
  let polling = false;
  let sending = false;
  let failures = 0;
  let lastPull = 0;
  let lastHeartbeat = Date.now();
  let latestPresence = 0;
  let requestId = 0;
  let pollTimer = 0;
  let unsubscribe = () => {};
  const pending: Message[] = [];

  function close() {
    if (closed) return;
    closed = true;
    ready = false;
    clearTimeout(pollTimer);
    removeEventListener("pagehide", onPageHide);
    unsubscribe();
  }

  function onPageHide(event: PageTransitionEvent) {
    if (event.persisted || closed) return;
    navigator.sendBeacon(
      "/api/world",
      new Blob(
        [JSON.stringify({ op: "leave", mode, client, guest: guestKey })],
        { type: "application/json" },
      ),
    );
    close();
  }

  async function request(op: Operation, action?: Message) {
    const id = ++requestId;
    const response = await fetch("/api/world", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        op,
        mode,
        client,
        guest: mode === "guest" ? guestKey : undefined,
        after: cursor,
        ...action,
      }),
      signal: AbortSignal.timeout(9000),
    });
    const result = await response.json();
    if (!response.ok) {
      const message = result.error || "The game server is unavailable.";
      if (op !== "join" && [401, 409, 410].includes(response.status)) {
        close();
        disconnected(message, response.status === 410);
      }
      throw Error(message);
    }
    if (closed) return;
    const reply: Reply = result;
    failures = 0;
    for (const event of reply.events) {
      if (event.seq > cursor) receive(event);
    }
    cursor = Math.max(cursor, reply.cursor);
    if (reply.presence && id > latestPresence) {
      latestPresence = id;
      receive({ type: "presence", data: reply.presence });
    }
    return reply;
  }

  function schedule(delay: number) {
    if (closed) return;
    clearTimeout(pollTimer);
    pollTimer = window.setTimeout(pull, delay);
  }

  async function pull() {
    if (closed || polling) return;
    polling = true;
    lastPull = Date.now();
    const heartbeat = lastPull - lastHeartbeat >= 5500;
    try {
      await request(heartbeat ? "heartbeat" : "poll");
      if (heartbeat) lastHeartbeat = Date.now();
    } catch {
      if (!closed && ++failures >= 4) {
        close();
        disconnected("The island connection was interrupted.", true);
      }
    } finally {
      polling = false;
      // Catch up if a broadcast drops or the Realtime socket is reconnecting.
      schedule(850);
    }
  }

  async function subscribe(config: NonNullable<Reply["realtime"]>) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      if (closed) return;
      const realtime = createClient(config.url, config.key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      const channel = realtime
        .channel("wildhatch:world")
        .on("broadcast", { event: "wake" }, () => {
          if (!polling && Date.now() - lastPull >= 225) schedule(0);
        })
        .subscribe();
      unsubscribe = () => {
        void realtime.removeChannel(channel);
      };
    } catch {
      // The regular catch-up request continues while Realtime is unavailable.
    }
  }

  async function drain() {
    if (sending || closed || !ready) return;
    sending = true;
    try {
      while (!closed && pending.length) {
        const action = pending.shift()!;
        try {
          await request("action", action);
        } catch (error) {
          if (!closed && action.type !== "move")
            receive({ type: "notice", data: (error as Error).message });
        }
      }
    } finally {
      sending = false;
    }
  }

  async function start() {
    try {
      const reply = await request("join");
      if (!reply || closed) return;
      ready = true;
      addEventListener("pagehide", onPageHide);
      if (reply.realtime) void subscribe(reply.realtime);
      schedule(300);
      void drain();
    } catch (error) {
      close();
      throw error;
    }
  }

  return {
    get ready() {
      return ready;
    },
    start,
    close,
    send(type: string, data?: any) {
      if (!ready || pending.length >= 32) return;
      if (type === "move" && pending.at(-1)?.type === "move") pending.pop();
      pending.push({ type, data });
      void drain();
    },
  };
}

let tabKey = "";
