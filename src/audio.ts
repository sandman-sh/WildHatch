export type SoundChannel = "music" | "ambience" | "effects";
export type MusicMode = "explore" | "battle" | "boss";
export type GameSound =
  | "ui"
  | "step"
  | "splash"
  | "land"
  | "crackle"
  | "rain"
  | "gust"
  | "call"
  | "throw"
  | "orbContact"
  | "orbLatch"
  | "study"
  | "capture"
  | "escape"
  | "evolve"
  | "resource"
  | "strike"
  | "pulse"
  | "scorch"
  | "guard"
  | "duelStart"
  | "eggCrack"
  | "hatch"
  | "victory"
  | "defeat"
  | "rare";
type Settings = Record<SoundChannel, number> & { muted: boolean };
type Habitat = {
  root: number;
  wind: number;
  windGain: number;
  accents: number[];
};

const habitats: Record<string, Habitat> = {
  "Emerald Forest": {
    root: 55,
    wind: 1450,
    windGain: 0.09,
    accents: [1690, 2070, 1910],
  },
  "Frozen Peaks": {
    root: 62,
    wind: 3100,
    windGain: 0.09,
    accents: [1130, 1694],
  },
  "Lava Realm": { root: 50, wind: 330, windGain: 0.19, accents: [140, 85] },
  "Crystal Valley": {
    root: 59,
    wind: 940,
    windGain: 0.065,
    accents: [989, 1483, 1978],
  },
  "Ocean Frontier": {
    root: 53,
    wind: 730,
    windGain: 0.17,
    accents: [460, 603, 755],
  },
};
const channels: SoundChannel[] = ["music", "ambience", "effects"];
const defaultSettings: Settings = {
  music: 0.48,
  ambience: 0.55,
  effects: 0.7,
  muted: false,
};
const settingsKey = "block-beasts-audio-v1";
const hz = (n: number) => 440 * 2 ** ((n - 69) / 12);
const clampVolume = (v: number) => Math.max(0, Math.min(1, v));

function preferences(): Settings {
  const prefs = { ...defaultSettings };
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) ?? "{}");
    for (const channel of channels) {
      if (Number.isFinite(saved[channel]))
        prefs[channel] = clampVolume(saved[channel]);
    }
    if (typeof saved.muted === "boolean") prefs.muted = saved.muted;
  } catch {
    /* Storage can be disabled in private browsing. */
  }
  return prefs;
}

// Original motifs are expressed as semitone offsets. A rest leaves room for ambience.
const trail = [0, 7, 12, null, 9, 7, null, 4, 2, null, 7, 9, 4, null, 2, null];
const duel = [0, 7, 3, 10, 0, 5, 7, 2, 0, 7, 3, 12, 10, 5, 3, 2];
const cues: Partial<
  Record<GameSound, { notes: number[]; gap: number; length: number }>
> = {
  ui: { notes: [79], gap: 0.04, length: 0.075 },
  orbContact: { notes: [82, 72, 60], gap: 0.035, length: 0.12 },
  orbLatch: { notes: [55, 67], gap: 0.055, length: 0.065 },
  study: { notes: [68, 79, 86], gap: 0.055, length: 0.11 },
  capture: { notes: [67, 71, 74, 79], gap: 0.092, length: 0.24 },
  escape: { notes: [70, 65, 62], gap: 0.1, length: 0.17 },
  evolve: { notes: [55, 62, 67, 71, 74, 78, 79, 86], gap: 0.115, length: 0.48 },
  resource: { notes: [79, 86], gap: 0.065, length: 0.16 },
  guard: { notes: [48, 55, 60], gap: 0.028, length: 0.24 },
  duelStart: { notes: [48, 55, 60, 72], gap: 0.095, length: 0.26 },
  hatch: { notes: [72, 76, 79, 84, 88], gap: 0.075, length: 0.3 },
  victory: { notes: [62, 69, 74, 73, 74, 81], gap: 0.12, length: 0.32 },
  defeat: { notes: [62, 60, 57, 50], gap: 0.17, length: 0.42 },
  rare: { notes: [76, 83, 88, 90], gap: 0.12, length: 0.48 },
};

export function battleSound(move: string): GameSound {
  switch (move) {
    case "Pulse":
      return "pulse";
    case "Guard":
      return "guard";
    case "Scorch":
      return "scorch";
    default:
      return "strike";
  }
}

class GameAudio {
  private prefs = preferences();
  private ctx?: AudioContext;
  private master?: GainNode;
  private mixer?: Record<SoundChannel, GainNode>;
  private noise?: AudioBuffer;
  private timer?: number;
  private next = 0;
  private beat = 0;
  private biome = "Emerald Forest";
  private mode: MusicMode = "explore";
  private lastStep = -1;

  get settings(): Readonly<Settings> {
    return { ...this.prefs };
  }

  // Call from a pointer or keyboard gesture to comply with browser autoplay rules.
  async unlock(): Promise<void> {
    try {
      if (!this.ctx) {
        if (typeof AudioContext === "undefined") return;
        const ctx = (this.ctx = new AudioContext({
          latencyHint: "interactive",
        }));
        this.master = ctx.createGain();
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -14;
        limiter.ratio.value = 6;
        this.master.connect(limiter).connect(ctx.destination);
        this.mixer = {
          music: ctx.createGain(),
          effects: ctx.createGain(),
          ambience: ctx.createGain(),
        };
        for (const channel of channels) {
          this.mixer[channel].connect(this.master);
          this.mixer[channel].gain.value = this.prefs[channel];
        }
        this.master.gain.value = this.prefs.muted ? 0 : 0.68;
        // Repeatable band-limited gusts and percussion share one short noise buffer.
        this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const samples = this.noise.getChannelData(0);
        let state = 2387401;
        for (let i = 0; i < samples.length; i++) {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          samples[i] = state / 2147483648 - 1;
        }
        document.addEventListener("visibilitychange", this.visibility);
      }
      if (document.hidden) return;
      if (this.ctx.state !== "running") await this.ctx.resume();
      if (this.timer === undefined) {
        this.next = this.ctx.currentTime + 0.045;
        this.schedule();
        this.timer = window.setInterval(() => this.schedule(), 75);
      }
    } catch {
      /* Unavailable audio devices must not interrupt play. */
    }
  }

  private visibility = () => {
    if (!this.ctx) return;
    if (document.hidden) {
      if (this.timer !== undefined) window.clearInterval(this.timer);
      this.timer = undefined;
      void this.ctx.suspend().catch(() => {});
    } else void this.unlock();
  };

  setVolume(channel: SoundChannel, level: number) {
    if (!Number.isFinite(level)) return;
    this.prefs[channel] = clampVolume(level);
    if (this.ctx && this.mixer)
      this.mixer[channel].gain.setTargetAtTime(
        this.prefs[channel],
        this.ctx.currentTime,
        0.035,
      );
    this.save();
  }
  setMuted(muted: boolean) {
    this.prefs.muted = muted;
    if (this.ctx && this.master)
      this.master.gain.setTargetAtTime(
        muted ? 0 : 0.68,
        this.ctx.currentTime,
        0.025,
      );
    this.save();
  }
  private save() {
    try {
      localStorage.setItem(settingsKey, JSON.stringify(this.prefs));
    } catch {
      /* Keep session controls functional. */
    }
  }
  setBiome(name: string) {
    if (Object.hasOwn(habitats, name)) this.biome = name;
  }
  setMode(mode: MusicMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.beat = 0;
  }

  private voice(
    channel: SoundChannel,
    at: number,
    frequency: number,
    duration: number,
    volume: number,
    shape: OscillatorType = "sine",
    endHz = frequency,
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = shape;
    osc.frequency.setValueAtTime(frequency, at);
    osc.frequency.exponentialRampToValueAtTime(endHz, at + duration);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(
      volume,
      at + Math.min(0.035, duration * 0.18),
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(envelope).connect(this.mixer![channel]);
    osc.onended = () => {
      osc.disconnect();
      envelope.disconnect();
    };
    osc.start(at);
    osc.stop(at + duration + 0.005);
  }

  private rustle(
    channel: SoundChannel,
    at: number,
    duration: number,
    center: number,
    volume: number,
    slow = false,
  ) {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noise!;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = center;
    filter.Q.value = 0.65;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(
      volume,
      at + duration * (slow ? 0.48 : 0.12),
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter).connect(envelope).connect(this.mixer![channel]);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
    source.start(at, (this.beat % 9) * 0.16);
    source.stop(at + duration + 0.005);
  }

  private schedule() {
    const ctx = this.ctx!;
    if (ctx.state !== "running" || document.hidden) return;
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.03;
    const calm = this.mode === "explore";
    const step = calm ? 0.43 : this.mode === "boss" ? 0.22 : 0.275;
    const habitat = habitats[this.biome];
    while (this.next < ctx.currentTime + 0.18) {
      const n = this.beat++,
        at = this.next;
      this.next += step;
      if (this.prefs.muted) continue;
      const root = calm ? habitat.root : this.mode === "boss" ? 43 : 50;
      const chord = (calm ? [0, -5, -3, -7] : [0, 0, -2, -5])[
        Math.floor(n / 16) % 4
      ];
      const note = (calm ? trail : duel)[n % 16];
      if (this.prefs.music > 0) {
        if (note !== null) {
          this.voice(
            "music",
            at,
            hz(root + chord + note + 12),
            calm ? 0.75 : 0.24,
            calm ? 0.11 : 0.12,
            "triangle",
          );
        }
        if (n % (calm ? 8 : 2) === 0) {
          this.voice(
            "music",
            at,
            hz(root + chord - 12),
            calm ? 2.3 : 0.34,
            0.15,
          );
        }
        if (!calm && n % 4 === 2) this.rustle("music", at, 0.12, 870, 0.13);
      }
      if (calm && this.prefs.ambience > 0) {
        if (n % 8 === 0)
          this.rustle(
            "ambience",
            at,
            4.2,
            habitat.wind,
            habitat.windGain,
            true,
          );
        if (n % 31 === 12) {
          habitat.accents.forEach((f, i) =>
            this.voice(
              "ambience",
              at + i * 0.16,
              f,
              0.22,
              0.047,
              "sine",
              f * 0.92,
            ),
          );
        }
      }
    }
  }

  play(sound: GameSound) {
    if (
      !this.ctx ||
      this.ctx.state !== "running" ||
      this.prefs.muted ||
      this.prefs.effects === 0
    )
      return;
    const at = this.ctx.currentTime + 0.008;
    const cue = cues[sound];
    if (cue) {
      cue.notes.forEach((note, i) =>
        this.voice(
          "effects",
          at + i * cue.gap,
          hz(note),
          cue.length,
          0.19,
          "triangle",
        ),
      );
      return;
    }
    switch (sound) {
      case "splash":
        this.rustle("effects", at, 0.27, 1800, 0.15);
        this.voice("effects", at, 175, 0.18, 0.07, "sine", 74);
        break;
      case "land":
        this.rustle("effects", at, 0.11, 850, 0.23);
        this.voice("effects", at, 110, 0.14, 0.13, "sine", 42);
        break;
      case "rain":
        this.rustle("ambience", at, 1.1, 2400, 0.09);
        break;
      case "gust":
        this.rustle("ambience", at, 1.5, 630, 0.12);
        break;
      case "crackle":
        this.rustle("ambience", at, 0.075, 3200, 0.13);
        break;
      case "step":
        if (at - this.lastStep < 0.17) return;
        this.lastStep = at;
        this.rustle(
          "effects",
          at,
          0.088,
          habitats[this.biome].wind * 0.82,
          0.17,
        );
        this.voice("effects", at, 92, 0.09, 0.12, "sine", 48);
        break;
      case "call": {
        const pitch = hz(habitats[this.biome].root + 18);
        this.voice("effects", at, pitch, 0.18, 0.17, "triangle", pitch * 1.37);
        this.voice(
          "effects",
          at + 0.18,
          pitch * 1.2,
          0.18,
          0.13,
          "sine",
          pitch * 0.94,
        );
        break;
      }
      case "throw":
        this.rustle("effects", at, 0.23, 1450, 0.25);
        this.voice("effects", at, 340, 0.26, 0.19, "sine", 1020);
        break;
      case "strike":
        this.rustle("effects", at, 0.13, 1120, 0.32);
        this.voice("effects", at + 0.025, 172, 0.22, 0.28, "triangle", 45);
        break;
      case "pulse":
        this.voice("effects", at, 190, 0.3, 0.24, "sine", 640);
        this.voice("effects", at + 0.09, 640, 0.27, 0.14, "triangle", 330);
        break;
      case "scorch":
        this.rustle("effects", at, 0.43, 2300, 0.28, true);
        this.voice("effects", at + 0.09, 140, 0.29, 0.21, "triangle", 60);
        break;
      case "eggCrack":
        this.rustle("effects", at, 0.095, 2400, 0.38);
        this.rustle("effects", at + 0.075, 0.13, 3300, 0.25);
        break;
    }
  }
}

export const gameAudio = new GameAudio();
