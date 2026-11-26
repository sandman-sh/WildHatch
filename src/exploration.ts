import { closestDestination, destinations, destinationInk, type Destination } from "./destinations";
import { portraitGame } from "./displayMode";
import { placeScenery } from "./scenery";
import { campfire } from "./fire";
import { rangerFor, fieldRanger } from "./rangers";
import { hasExplorer, loadExplorer } from "./voxelExplorer";
import { setupAtmosphere } from "./atmosphere";
import { gameAudio } from "./audio";
import { createFieldCapture } from "./fieldCapture";
import * as T from "three";
import {
  buildWorld,
  ground,
  fluid,
  biome,
  walkable,
  cameraFloor,
  dragonPerch,
  sailingRadius,
  sailingCenterZ,
} from "./world";
import {
  makeCreature,
  makeExplorer,
  makeBeastFigure,
  animateModel,
} from "./models";
import type { Beast } from "./shared";
import type { WorldPlayer } from "./playMode";
import type { BeastFlight } from "./importedBeasts";
import { habitats, habitatAt } from "./shared";
import {
  frontierAt,
  nearbySites,
  sectorAt,
  sector,
  sample,
  ferryCamp,
} from "./frontier";
import { streamFrontier } from "./frontierView";
import { outerIslandAt, outerIslands } from "./outerIslands";
const canvas = document.querySelector<HTMLCanvasElement>("#world")!;
export const renderer = new T.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
const scene = new T.Scene();
scene.background = new T.Color(0xabdadc);
scene.fog = new T.FogExp2(0xc3ddcf, 0.012);
const hemi = new T.HemisphereLight(0xfff4db, 0xb7c2a3, 2.05);
scene.add(hemi);
const sun = new T.DirectionalLight(0xffedc4, 2.3);
sun.position.set(-28, 42, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
  left: -34,
  right: 34,
  top: 34,
  bottom: -34,
  far: 120,
});
sun.shadow.normalBias = 0.035;
scene.add(sun, sun.target);
const atmosphere = setupAtmosphere(scene, sun, hemi);
const world = buildWorld(scene),
  player = makeExplorer(fieldRanger),
  camera = new T.PerspectiveCamera(58, 1, 0.1, 270);
const fire = campfire(scene, 4, -2);
let climateClock = 0;
scene.add(player);
export const fieldCapture = createFieldCapture(scene, player);
export function frameEncounter(index: number) {
  const m = wild.get(index);
  if (m) fieldCapture.focus(index, m);
}
const scenery = placeScenery(scene);
export function ferryRoute() {
  const { x, z } = player.position;
  const camp = ferryCamp(x, z);
  return {
    ...camp,
    label: camp.frontier ? "Return to trailhead" : "Sail to the frontier",
  };
}
export function localDestination(kind?: Destination["kind"]) {
  return closestDestination(player.position.x, player.position.z, kind);
}
export function nearbyMerchant() {
  const {place, distance} = localDestination();
  return place.kind !== "boss" && distance <= 6.5 ? place : undefined;
}
export function siteAction() {
  if (guestExplorer) return null;
  const { x, z } = player.position;
  if (Math.hypot(x + 6.4, z + 21) < 6) return "boss";
  if (Math.hypot(x - 7, z + 6) < 3.8) return "market";
  return null;
}
player.position.y = ground(0, 0);
const wild = new Map<number, T.Group>(),
  spent = new Set<number>();
const frontierTerrain = streamFrontier(scene);
let wildlifeCell = "";
function addWild(i: number, variant: number) {
  const [name, x, z] = habitatAt(i)!;
  const m = makeCreature(name, variant);
  m.position.set(x, ground(x, z) + (m.userData.flight?.altitude ?? 0), z);
  m.visible = !spent.has(i);
  wild.set(i, m);
  scene.add(m);
}
function dropWild(i: number) {
  const m = wild.get(i);
  if (!m) return;
  scene.remove(m);
  m.traverse((o) => {
    if (o instanceof T.Mesh) o.geometry.dispose();
  });
  wild.delete(i);
}
function streamWild(x: number, z: number) {
  const cell = Math.floor(x / 12) + "," + Math.floor(z / 12);
  if (cell === wildlifeCell) return;
  wildlifeCell = cell;
  const sites = nearbySites(x, z).filter((id) => {
    const h = habitatAt(id)!;
    return Math.hypot(h[1] - x, h[2] - z) < 86;
  });
  for (const i of wild.keys()) if (i >= 32 && !sites.includes(i)) dropWild(i);
  for (const i of sites)
    if (!wild.has(i) && !spent.has(i))
      addWild(i, Math.floor(sample(i, 0, 31) * 65536));
}
const guardian = makeCreature("Green Dragon");
guardian.position.set(
  dragonPerch.x,
  ground(dragonPerch.x, dragonPerch.z),
  dragonPerch.z,
);
guardian.rotation.y = 2.35;
scene.add(guardian);
const perchStart = performance.now();
let guardianRespawn = 0;
export function updateGuardian(respawn: number) {
  guardianRespawn = respawn;
}
const velocity = new T.Vector2();
let grounded = true,
  stepClock = 0,
  previousMedium = "land";
let stride = 0;
let angle = -0.06,
  pitch = 0.15,
  distance = 10,
  jump = 0,
  up = 0,
  elapsed = 0,
  prev = performance.now(),
  lastSent = 0,
  lastQuality = matchMedia("(pointer: coarse)").matches ? "Low" : "High",
  paused = false;
const keys = new Set<string>(),
  target = new T.Vector3(),
  desired = new T.Vector3(),
  remotes = new Map<
    string,
    {
      m: T.Group;
      b?: T.Group;
      label: HTMLSpanElement;
      x: number;
      z: number;
      yaw: number;
    }
  >();
const nameLayer = document.querySelector<HTMLDivElement>("#world-names")!;
const namePosition = new T.Vector3();
const placedNames: { x: number; y: number; width: number }[] = [];
const nameWidths = new WeakMap<HTMLSpanElement, number>();
let guestExplorer = false;
function makeNameplate() {
  const label = document.createElement("span");
  label.className = "world-name";
  label.hidden = true;
  nameLayer.append(label);
  return label;
}
const localName = makeNameplate();
export function setWorldIdentity(name: string, guest: boolean) {
  guestExplorer = guest;
  if (localName.textContent !== name) nameWidths.delete(localName);
  localName.textContent = name;
  localName.classList.toggle("guest", guest);
}
function positionName(label: HTMLSpanElement, position: T.Vector3) {
  if (position.distanceToSquared(player.position) > 48 ** 2) {
    label.hidden = true;
    return;
  }
  namePosition.copy(position).y += 2.28;
  namePosition.project(camera);
  const { x, y, z } = namePosition;
  label.hidden = Math.abs(x) > 0.99 || Math.abs(y) > 0.97 || Math.abs(z) > 1;
  if (label.hidden) return;
  const screenX = ((x + 1) * innerWidth) / 2;
  const screenY = ((1 - y) * innerHeight) / 2;
  const width = nameWidths.get(label) ?? label.offsetWidth;
  if (!width) return;
  nameWidths.set(label, width);
  let top = screenY;
  while (
    placedNames.some(
      (name) =>
        Math.abs(name.x - screenX) < (name.width + width) / 2 + 6 &&
        Math.abs(name.y - top) < 24,
    )
  )
    top -= 24;
  placedNames.push({ x: screenX, y: top, width });
  label.style.transform =
    "translate3d(" + screenX + "px," + top + "px,0) translate(-50%,-100%)";
}
const previousCameraRotation = new T.Quaternion();
let wasFraming = false,
  cameraRecovery = 0;
const gentleCamera = matchMedia("(prefers-reduced-motion: reduce)");
export let nearest = -1;
let companion: T.Group | undefined,
  companionKey = "";
const appearanceKey = (b: Beast) =>
  [b.id, b.name, b.stage, b.marking, b.mutation].join("/");
export function selectCompanion(beast?: Beast) {
  const key = beast ? appearanceKey(beast) : "";
  if (key === companionKey) return;
  if (companion) {
    scene.remove(companion);
    companion.traverse((o) => {
      if (o instanceof T.Mesh) o.geometry.dispose();
    });
  }
  companionKey = key;
  companion = undefined;
  if (!beast) return;
  companion = makeBeastFigure(beast);
  const cx = player.position.x - 1.6;
  const cz = player.position.z + 0.6;
  companion.position.set(
    cx,
    ground(cx, cz) + (companion.userData.flight ? 1.4 : 0),
    cz,
  );
  scene.add(companion);
}
export function availableHabitats() {
  const { x, z } = player.position;
  const signals = new Set([...wild.keys(), ...nearbySites(x, z)]);
  return [...signals]
    .filter((i) => !spent.has(i))
    .map((i) => {
      const [name, x, z] = habitatAt(i)!;
      return {
        i,
        name,
        distance: Math.round(
          Math.hypot(x - player.position.x, z - player.position.z),
        ),
      };
    })
    .sort((a, b) => a.distance - b.distance);
}
export let trackedHabitat = -1;
let landmark: readonly [string, number, number] | undefined;
export function trackPlace(place: readonly [string, number, number]) {
  trackedHabitat = -1;
  landmark = place;
}
export function trackHabitat(index: number) {
  landmark = undefined;
  trackedHabitat = index;
}
let tell: (type: string, data: any) => void = () => {};
export function configure(send: typeof tell) {
  tell = send;
}
export function freeze(value: boolean) {
  paused = value;
  resetStick();
  velocity.set(0, 0);
  keys.clear();
}
export function quality(q: string) {
  lastQuality = q;
  renderer.shadowMap.enabled = q !== "Low";
  renderer.setPixelRatio(
    Math.min(
      devicePixelRatio,
      q === "Low" ? 1 : q === "Medium" ? 1.25 : q === "Ultra" ? 2.5 : 1.7,
    ),
  );
  resize();
}
function resize() {
  const w = innerWidth,
    h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
quality(lastQuality);
addEventListener("resize", resize);
function key(k: string, v: boolean) {
  if (k === " " && v && grounded) {
    up = 7;
    grounded = false;
  }
  if (v) keys.add(k);
  else keys.delete(k);
}
addEventListener("keydown", (e) => {
  if (
    !document.body.classList.contains("at-title") &&
    !paused &&
    !portraitGame.matches &&
    !(
      e.key === " " &&
      e.target instanceof HTMLButtonElement &&
      e.target.closest("dialog")
    ) &&
    [
      "w",
      "s",
      "a",
      "d",
      " ",
      "shift",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
    ].includes(e.key.toLowerCase())
  ) {
    e.preventDefault();
    key(e.key.toLowerCase(), true);
  }
});
addEventListener("keyup", (e) => key(e.key.toLowerCase(), false));
addEventListener("blur", () => keys.clear());
document.querySelectorAll<HTMLElement>("[data-key]").forEach((b) => {
  b.onpointerdown = (e) => {
    b.setPointerCapture(e.pointerId);
    key(b.dataset.key!, true);
  };
  b.onlostpointercapture = () => key(b.dataset.key!, false);
});
const stick = document.querySelector<HTMLElement>("#move-stick")!;
const knob = stick.querySelector<HTMLElement>("span")!;
const stickInput = new T.Vector2();
let stickPointer: number | null = null;
function resetStick() {
  stickPointer = null;
  stickInput.set(0, 0);
  knob.style.transform = "";
}
function moveStick(e: PointerEvent) {
  if (e.pointerId !== stickPointer) return;
  const box = stick.getBoundingClientRect(),
    r = box.width * 0.34;
  stickInput
    .set(
      (e.clientX - box.left - box.width / 2) / r,
      (e.clientY - box.top - box.height / 2) / r,
    )
    .clampLength(0, 1);
  knob.style.transform =
    "translate(" + stickInput.x * r + "px," + stickInput.y * r + "px)";
}
stick.onpointerdown = (e) => {
  if (paused || stickPointer !== null) return;
  stickPointer = e.pointerId;
  stick.setPointerCapture(e.pointerId);
  moveStick(e);
};
stick.onpointermove = moveStick;
stick.onlostpointercapture = (e) => {
  if (e.pointerId === stickPointer) resetStick();
};
addEventListener("blur", resetStick);
const cameraPointers = new Map<number, T.Vector2>();
portraitGame.addEventListener("change", () => {
  cameraPointers.clear();
  resetStick();
  keys.clear();
  velocity.set(0, 0);
  prev = performance.now();
});
canvas.onpointerdown = (e) => {
  if (fieldCapture.index >= 0 || cameraPointers.size >= 2) return;
  cameraPointers.set(e.pointerId, new T.Vector2(e.clientX, e.clientY));
  canvas.setPointerCapture(e.pointerId);
};
canvas.onpointermove = (e) => {
  const point = cameraPointers.get(e.pointerId);
  if (!point) return;
  if (cameraPointers.size === 2) {
    const other = [...cameraPointers.values()].find((p) => p !== point)!;
    const previous = point.distanceTo(other);
    point.set(e.clientX, e.clientY);
    const separation = point.distanceTo(other);
    if (previous > 2 && separation > 2)
      distance = T.MathUtils.clamp((distance * previous) / separation, 4, 19);
  } else {
    angle -= (e.clientX - point.x) * 0.006;
    pitch = T.MathUtils.clamp(
      pitch + (e.clientY - point.y) * 0.004,
      -0.75,
      1.35,
    );
    point.set(e.clientX, e.clientY);
  }
};
canvas.onlostpointercapture = (e) => {
  cameraPointers.delete(e.pointerId);
};
canvas.onwheel = (e) => {
  distance = T.MathUtils.clamp(distance + e.deltaY * 0.012, 4, 19);
};
export function relocate(x: number, z: number) {
  player.position.set(x, ground(x, z), z);
  if (companion && companion.position.distanceTo(player.position) > 20)
    companion.position.copy(player.position).x -= 1.6;
  velocity.set(0, 0);
  up = 0;
  grounded = true;
}
export function setHabitats(variants: number[]) {
  spent.clear();
  wildlifeCell = "";
  for (const i of wild.keys()) dropWild(i);
  variants.forEach((v, i) => addWild(i, v));
}
export function removeWild(i: number) {
  spent.add(i);
  const m = wild.get(i);
  if (m) m.visible = false;
  if (trackedHabitat === i) trackedHabitat = -1;
}
export function respawnWild(i: number, variant?: number) {
  spent.delete(i);
  dropWild(i);
  const h = habitatAt(i);
  if (!h) return;
  addWild(i, variant ?? Math.floor(Math.random() * 65536));
}
function removeRemote(model?: T.Group) {
  if (!model) return;
  scene.remove(model);
  model.traverse((object) => {
    if (object instanceof T.Mesh) object.geometry.dispose();
  });
}
export function presence(list: WorldPlayer[]) {
  for (const q of list) {
    let peer = remotes.get(q.id);
    const ranger = rangerFor(q.ranger).id;
    if ((!peer || peer.m.userData.ranger !== ranger) && !hasExplorer(ranger)) {
      void loadExplorer(ranger).catch(() => {});
      continue;
    }
    if (peer && peer.m.userData.ranger !== ranger) {
      const position = peer.m.position.clone();
      removeRemote(peer.m);
      peer.m = makeExplorer(ranger);
      peer.m.position.copy(position);
      scene.add(peer.m);
    }
    if (!peer) {
      const m = makeExplorer(ranger);
      const label = makeNameplate();
      label.classList.toggle("guest", q.guest);
      scene.add(m);
      peer = { m, label, x: q.x, z: q.z, yaw: q.yaw };
      remotes.set(q.id, peer);
      m.position.set(q.x, ground(q.x, q.z), q.z);
    }
    if (peer.label.textContent !== q.name) {
      peer.label.textContent = q.name;
      nameWidths.delete(peer.label);
    }
    const key = q.beast ? appearanceKey(q.beast) : undefined;
    if (peer.b?.userData.appearanceKey !== key) {
      removeRemote(peer.b);
      peer.b = q.beast ? makeBeastFigure(q.beast) : undefined;
      if (peer.b) {
        peer.b.userData.appearanceKey = key;
        scene.add(peer.b);
      }
    }
    Object.assign(peer, { x: q.x, z: q.z, yaw: q.yaw });
  }
  for (const [id, r] of remotes)
    if (!list.some((q) => q.id === id)) {
      removeRemote(r.m);
      removeRemote(r.b);
      r.label.remove();
      remotes.delete(id);
    }
}
export const palette: Record<string, string> = {
  "Emerald Forest": "#719760",
  "Frozen Peaks": "#c3d9da",
  "Lava Realm": "#917469",
  "Crystal Valley": "#9a87ad",
  "Ocean Frontier": "#e2cf98",
};
const atlasHalf = sailingRadius + Math.abs(sailingCenterZ) + 6;
const atlas = document.createElement("canvas");
atlas.width = atlas.height = atlasHalf * 2;
const ink = atlas.getContext("2d")!;
ink.fillStyle = "#6ca5ac";
ink.fillRect(0, 0, atlas.width, atlas.height);
for (let z = -atlasHalf; z < atlasHalf; z++)
  for (let x = -atlasHalf; x < atlasHalf; x++) {
    if ((Math.abs(x) > 104 || Math.abs(z) > 100) && !outerIslandAt(x, z))
      continue;
    const y = ground(x, z);
    if (y < 0.5) continue;
    ink.fillStyle = palette[biome(x, z)];
    ink.fillRect(x + atlasHalf, z + atlasHalf, 1, 1);
    if (y > 1) {
      ink.fillStyle = "rgba(255,255,238," + Math.min(0.3, y * 0.013) + ")";
      ink.fillRect(x + atlasHalf, z + atlasHalf, 1, 1);
    }
  }
const chart = document.createElement("canvas");
chart.width = chart.height = 112;
let chartCell = "";
function seaChart(ox: number, oz: number) {
  const key = ox + "," + oz;
  if (key === chartCell) return chart;
  chartCell = key;
  const ctx = chart.getContext("2d")!;
  const step = atlas.width / chart.width;
  for (let j = 0; j < chart.height; j++)
    for (let i = 0; i < chart.width; i++) {
      const x = ox - atlasHalf + (i + 0.5) * step,
        z = oz - atlasHalf + (j + 0.5) * step,
        y = ground(x, z);
      ctx.fillStyle =
        y <= 0
          ? "#6ca5ac"
          : frontierAt(x, z)
            ? "#" + sector(sectorAt(x), sectorAt(z)).range.top.toString(16)
            : palette[biome(x, z)];
      ctx.fillRect(i, j, 1, 1);
    }
  return chart;
}
const minimap = document.querySelector<HTMLCanvasElement>("#minimap")!;
let miniX = 0,
  miniZ = 0,
  lastMapDraw = -Infinity;
let openAtlas: { canvas: HTMLCanvasElement; update: () => void } | undefined;

export function showAtlas(canvas?: HTMLCanvasElement, update = () => {}) {
  openAtlas = canvas ? { canvas, update } : undefined;
  if (canvas) drawMap(canvas);
}

function drawMap(c: HTMLCanvasElement, mini = false) {
  const g = c.getContext("2d")!;
  const { x: px, z: pz } = player.position;
  const outer = Math.max(Math.abs(px), Math.abs(pz)) > 130;
  const chartX = outer ? Math.round(px / 32) * 32 : 0,
    chartZ = outer ? Math.round(pz / 32) * 32 : 0;
  const scale = c.width / (mini ? 88 : atlas.width);
  if (mini) {
    if (Math.abs(miniX - px) > 44 || Math.abs(miniZ - pz) > 44) {
      miniX = px;
      miniZ = pz;
    }
    miniX = T.MathUtils.clamp(miniX, px - 20, px + 20);
    miniZ = T.MathUtils.clamp(miniZ, pz - 20, pz + 20);
  }
  const centerX = mini ? miniX : chartX;
  const centerZ = mini ? miniZ : chartZ;
  const mapX = (x: number) => c.width / 2 + (x - centerX) * scale;
  const mapZ = (z: number) => c.height / 2 + (z - centerZ) * scale;
  const playerX = mapX(px);
  const playerZ = mapZ(pz);
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#6ca5ac";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(
    outer ? seaChart(chartX, chartZ) : atlas,
    mapX(chartX - atlasHalf),
    mapZ(chartZ - atlasHalf),
    atlas.width * scale,
    atlas.height * scale,
  );

  function waypoint(x: number, z: number) {
    g.beginPath();
    g.arc(mapX(x), mapZ(z), 6, 0, Math.PI * 2);
    g.strokeStyle = "#ffeaa4";
    g.lineWidth = 2;
    g.stroke();
  }
  if (landmark) waypoint(landmark[1], landmark[2]);
  for (const [i, m] of wild) {
    if (!m.visible) continue;
    const [, x, z] = habitatAt(i)!;
    const mx = mapX(x),
      mz = mapZ(z);
    if (mx < -6 || mz < -6 || mx > c.width + 6 || mz > c.height + 6) continue;
    if (i === trackedHabitat) waypoint(x, z);
    g.fillStyle = "#354934";
    g.fillRect(mx - 1.5, mz - 1.5, 3, 3);
  }

  if (!mini) {
    const compact = c.clientWidth > 0 && c.clientWidth < 320;
    g.font =
      (compact ? "bold 16px" : "bold 11px") + " Pixelify Sans, monospace";
    g.textAlign = "center";
    g.lineWidth = 3;
    g.strokeStyle = "#233e35";
    g.fillStyle = "#fff4cf";
    const labels: [string, number, number][] = compact
      ? [["Trailhead", 0, 8]]
      : [
          ["Frozen Peaks", 0, -70],
          ["Lava Realm", 65, -28],
          ["Crystal Valley", -60, -16],
          ["Ocean Frontier", 2, 65],
          ["Trailhead", 0, 8],


        ];
    for (const island of outerIslands)
      labels.push([island.name, island.x, island.z]);
    if (outer) {
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
          const r = sector(sectorAt(px) + dx, sectorAt(pz) + dz);
          if (frontierAt(r.x, r.z)) labels.push([r.range.name, r.x, r.z]);
        }
    }
    for (const [label, x, z] of labels) {
      const labelX = mapX(x);
      const labelZ = mapZ(z);
      // Keep the local marker and its label legible in the crowded trailhead.
      if (
        Math.abs(labelX - playerX) < g.measureText(label).width / 2 + 16 &&
        labelZ > playerZ - 15 &&
        labelZ < playerZ + 38
      )
        continue;
      g.strokeText(label, labelX, labelZ);
      g.fillText(label, labelX, labelZ);
    }
  }

  for (const place of destinations) {
    const x = mapX(place.x), z = mapZ(place.z);
    if (x < 0 || z < 0 || x > c.width || z > c.height) continue;
    const ink = destinationInk[place.kind];
    const offset = mini ? 0 : place.kind === "shop" ? -17 : 17;
    const y = z + (mini ? 0 : place.kind === "boss" ? -11 : 5);
    g.strokeStyle = ink.color;
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x, z); g.lineTo(x + offset, y); g.stroke();
    g.fillStyle = "#203a32"; g.fillRect(x + offset - 6, y - 6, 12, 12);
    g.strokeRect(x + offset - 6, y - 6, 12, 12);
    g.font = "bold 10px monospace"; g.textAlign = "center"; g.fillStyle = ink.color;
    g.fillText(ink.mark, x + offset, y + 3.5);
  }
  g.save();
  g.translate(playerX, playerZ);
  g.rotate(-player.rotation.y);
  g.strokeStyle = "#172b25";
  g.lineJoin = "round";
  g.lineWidth = 2.5;
  g.fillStyle = "#ffdb72";
  g.beginPath();
  g.moveTo(0, -15);
  g.lineTo(4.5, -7);
  g.lineTo(-4.5, -7);
  g.closePath();
  g.stroke();
  g.fill();
  g.beginPath();
  g.arc(0, 0, 7, 0, Math.PI * 2);
  g.stroke();
  g.fill();
  g.fillStyle = "#fff9dd";
  g.beginPath();
  g.arc(0, 0, 2.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
  if (!mini) {
    g.font = "bold 16px Pixelify Sans, monospace";
    g.textAlign = "center";
    g.lineWidth = 4;
    g.strokeStyle = "#172b25";
    g.fillStyle = "#fff9dd";
    g.strokeText("You", playerX, playerZ + 23);
    g.fillText("You", playerX, playerZ + 23);
  }
}
// Expanding crests follow the swimmer and fade back into the water.
const wakes = Array.from({ length: 4 }, () => {
  const mesh = new T.Mesh(
    new T.RingGeometry(0.4, 0.43, 28),
    new T.MeshBasicMaterial({
      color: 0xc3ebdf,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, birth: -10 };
});
let wakeIndex = 0,
  lastWake = -1;
function flyAroundHabitat(
  model: T.Group,
  flight: BeastFlight,
  hx: number,
  hz: number,
  time: number,
  dt: number,
) {
  const angle = time * flight.turnRate;
  const approaching =
    Math.hypot(player.position.x - hx, player.position.z - hz) < 6;
  const radius = approaching ? 0 : flight.radius;
  const x = hx + Math.cos(angle) * radius;
  const z = hz + Math.sin(angle) * radius;
  const altitude = approaching
    ? 1.25
    : flight.altitude + Math.sin(angle * 2) * 0.65;
  model.position.x = T.MathUtils.damp(model.position.x, x, 2.8, dt);
  model.position.z = T.MathUtils.damp(model.position.z, z, 2.8, dt);
  const floor = ground(model.position.x, model.position.z);
  model.position.y = Math.max(
    floor + 0.7,
    T.MathUtils.damp(model.position.y, floor + altitude, 2.8, dt),
  );
  const yaw = approaching
    ? Math.atan2(
        model.position.x - player.position.x,
        model.position.z - player.position.z,
      )
    : Math.atan2(Math.sin(angle), -Math.cos(angle));
  const turn = Math.atan2(
    Math.sin(yaw - model.rotation.y),
    Math.cos(yaw - model.rotation.y),
  );
  model.rotation.y += turn * (1 - Math.exp(-dt * 5));
  model.rotation.z = T.MathUtils.damp(
    model.rotation.z,
    approaching ? 0 : 0.22,
    4,
    dt,
  );
  animateModel(model, time, 1, "fly");
}
const arenaScene = new T.Scene();
arenaScene.background = new T.Color(0x132722);
arenaScene.fog = new T.FogExp2(0x132722, 0.024);
let arenaMode: "lobby" | "duel" | null = null;
let arenaRingMat: T.MeshStandardMaterial | undefined;
let arenaFighters: {
  group: T.Group;
  youBeast?: T.Group;
  foeBeast?: T.Group;
} | null = null;
let arenaBuilt = false;
function buildArenaScene() {
  if (arenaBuilt) return;
  arenaBuilt = true;
  const aHemi = new T.HemisphereLight(0xf6e6be, 0x1a3029, 1.9);
  const aSun = new T.DirectionalLight(0xffdfa8, 2.2);
  aSun.position.set(10, 18, 12);
  const rimLight = new T.PointLight(0x7be0c4, 18, 30);
  rimLight.position.set(0, 6, 0);
  arenaScene.add(aHemi, aSun, rimLight);

  const floor = new T.Mesh(
    new T.CylinderGeometry(11.5, 12.2, 1.2, 32),
    new T.MeshStandardMaterial({ color: 0x223b32, roughness: 0.85 }),
  );
  floor.position.y = -0.6;
  const innerDeck = new T.Mesh(
    new T.CylinderGeometry(8.6, 8.6, 0.14, 24),
    new T.MeshStandardMaterial({ color: 0x2c4b3f, roughness: 0.8 }),
  );
  innerDeck.position.y = 0.06;
  arenaRingMat = new T.MeshStandardMaterial({
    color: 0x7be0c4,
    emissive: 0x2f7d69,
    emissiveIntensity: 0.75,
    roughness: 0.35,
  });
  const runeRing = new T.Mesh(
    new T.TorusGeometry(6.8, 0.14, 10, 48),
    arenaRingMat,
  );
  runeRing.rotation.x = Math.PI / 2;
  runeRing.position.y = 0.16;
  arenaScene.add(floor, innerDeck, runeRing);

  const pillarGeo = new T.BoxGeometry(1.1, 4.6, 1.1);
  const pillarMat = new T.MeshStandardMaterial({
    color: 0x1a2d26,
    roughness: 0.75,
  });
  const crystalGeo = new T.OctahedronGeometry(0.55);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pillar = new T.Mesh(pillarGeo, pillarMat);
    pillar.position.set(Math.cos(a) * 10.2, 2.2, Math.sin(a) * 10.2);
    pillar.rotation.y = -a;
    const crystal = new T.Mesh(crystalGeo, arenaRingMat);
    crystal.position.set(Math.cos(a) * 10.2, 5.1, Math.sin(a) * 10.2);
    arenaScene.add(pillar, crystal);
  }
  const padGeo = new T.CylinderGeometry(1.9, 2.1, 0.22, 16);
  const padMat = new T.MeshStandardMaterial({ color: 0x3b6150, roughness: 0.6 });
  for (const [px, pz] of [
    [-3.6, 1.6],
    [3.6, -1.6],
  ]) {
    const pad = new T.Mesh(padGeo, padMat);
    pad.position.set(px, 0.18, pz);
    arenaScene.add(pad);
  }
}
function clearArenaFighters() {
  if (!arenaFighters) return;
  arenaScene.remove(arenaFighters.group);
  arenaFighters.group.traverse((o) => {
    if (o instanceof T.Mesh) o.geometry.dispose();
  });
  arenaFighters = null;
}
export function setPvpLobby() {
  buildArenaScene();
  clearArenaFighters();
  arenaMode = "lobby";
  if (arenaRingMat) {
    arenaRingMat.color.setHex(0x88dfc2);
    arenaRingMat.emissive.setHex(0x286b58);
  }
  const group = new T.Group();
  const me = makeExplorer(fieldRanger);
  me.position.set(-2.2, 0.28, 1.6);
  me.rotation.y = 0.6;
  group.add(me);
  arenaScene.add(group);
  arenaFighters = { group };
}
export function enterPvpRoom(
  roomId: string,
  duel: { names: Beast[]; you: number },
) {
  buildArenaScene();
  clearArenaFighters();
  arenaMode = "duel";
  let hash = 0;
  for (let i = 0; i < roomId.length; i++)
    hash = (hash * 31 + roomId.charCodeAt(i)) >>> 0;
  if (arenaRingMat) {
    const hue = ((hash % 360) / 360);
    arenaRingMat.color.setHSL(hue, 0.68, 0.62);
    arenaRingMat.emissive.setHSL(hue, 0.65, 0.25);
  }
  const group = new T.Group();
  const youBeast = makeBeastFigure(duel.names[duel.you]);
  const foeBeast = makeBeastFigure(duel.names[1 - duel.you]);
  const youRanger = makeExplorer(fieldRanger);
  youRanger.position.set(-5.3, 0.28, 2.4);
  youRanger.lookAt(3.6, 0.3, -1.6);
  youBeast.position.set(-3.4, 0.3 + (youBeast.userData.flight ? 1.1 : 0), 1.4);
  youBeast.lookAt(3.4, youBeast.position.y, -1.4);
  foeBeast.position.set(3.4, 0.3 + (foeBeast.userData.flight ? 1.1 : 0), -1.4);
  foeBeast.lookAt(-3.4, foeBeast.position.y, 1.4);
  group.add(youRanger, youBeast, foeBeast);
  arenaScene.add(group);
  arenaFighters = { group, youBeast, foeBeast };
}
export function exitPvpRoom(keepLobby = false) {
  clearArenaFighters();
  arenaMode = keepLobby ? "lobby" : null;
  if (keepLobby) setPvpLobby();
}

function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.2, (now - prev) / 1000));
  prev = now;
  if (portraitGame.matches) return;
  elapsed += dt;
  if (arenaMode) {
    const orbit = elapsed * 0.14;
    camera.position.set(
      Math.sin(orbit) * 11.5,
      5.4,
      Math.cos(orbit) * 11.5,
    );
    camera.lookAt(0, 1.2, 0);
    if (arenaFighters?.youBeast)
      animateModel(
        arenaFighters.youBeast,
        elapsed,
        0.2,
        arenaFighters.youBeast.userData.flight ? "fly" : "idle",
      );
    if (arenaFighters?.foeBeast)
      animateModel(
        arenaFighters.foeBeast,
        elapsed + 1.3,
        0.2,
        arenaFighters.foeBeast.userData.flight ? "fly" : "idle",
      );
    renderer.render(arenaScene, camera);
    for (const r of remotes.values()) r.label.hidden = true;
    localName.hidden = true;
    return;
  }
  scenery(elapsed, player.position);
  world.update(elapsed, player.position, lastQuality);
  const p = player.position;
  frontierTerrain(p.x, p.z, lastQuality);
  streamWild(p.x, p.z);
  fire(elapsed);
  const climate = atmosphere.update(elapsed, p, biome(p.x, p.z), lastQuality);
  climateClock -= dt;
  if (climateClock <= 0) {
    climateClock = 1.1;
    if (Math.hypot(p.x - 4, p.z + 2) < 5 || biome(p.x, p.z) === "Lava Realm")
      gameAudio.play("crackle");
    if (climate.rain > 0.35) gameAudio.play("rain");
    else if (climate.snow > 0.42) gameAudio.play("gust");
  }

  const a =
      Number(keys.has("d") || keys.has("arrowright")) -
      Number(keys.has("a") || keys.has("arrowleft")),
    b =
      Number(keys.has("s") || keys.has("arrowdown")) -
      Number(keys.has("w") || keys.has("arrowup"));
  const medium = fluid(p.x, p.z),
    swimming = medium === "water";
  const input = new T.Vector2(a, b)
    .add(stickInput)
    .clampLength(0, 1)
    .rotateAround(new T.Vector2(), -angle);
  const oldX = p.x,
    oldZ = p.z;
  const ticks = Math.max(1, Math.ceil(dt / (1 / 45))),
    step = dt / ticks;
  for (let tick = 0; tick < ticks; tick++) {
    const wet = fluid(p.x, p.z) === "water";
    const maxSpeed = wet
      ? 2.7
      : keys.has("shift") || stickInput.lengthSq() > 0.83
        ? 9
        : 5.3;
    const traction = wet
      ? 3.2
      : biome(p.x, p.z) === "Frozen Peaks"
        ? 5
        : grounded
          ? 14
          : 3;
    const blend = 1 - Math.exp(-step * traction);
    velocity.x += (input.x * maxSpeed - velocity.x) * blend;
    velocity.y += (input.y * maxSpeed - velocity.y) * blend;
    if (paused) velocity.set(0, 0);
    const nx = p.x + velocity.x * step,
      nz = p.z + velocity.y * step;
    // Buoyancy places the swimmer below the surface. Use the bank height for stepping out.
    const limit = Math.max(p.y, ground(p.x, p.z)) + 1.21;
    if (walkable(nx, p.z) && ground(nx, p.z) <= limit) p.x = nx;
    else velocity.x = 0;
    if (walkable(p.x, nz) && ground(p.x, nz) <= limit) p.z = nz;
    else velocity.y = 0;
    const floor = ground(p.x, p.z);
    if (fluid(p.x, p.z) === "water") {
      const waterline = floor - 0.55 + 0.075 * Math.sin(elapsed * 2.8);
      up += (waterline - p.y) * 32 * step;
      up *= Math.exp(-6 * step);
      p.y += up * step;
      grounded = true;
    } else {
      up -= 17 * step;
      p.y += up * step;
      grounded = p.y <= floor;
      if (grounded) {
        if (up < -6) gameAudio.play("land");
        p.y = floor;
        up = 0;
      }
    }
  }
  const travel = Math.hypot(p.x - oldX, p.z - oldZ);
  let bank = 0;
  if (travel > 0.00001) {
    const heading = Math.atan2(oldX - p.x, oldZ - p.z);
    const turn = Math.atan2(
      Math.sin(heading - player.rotation.y),
      Math.cos(heading - player.rotation.y),
    );
    player.rotation.y += turn * (1 - Math.exp(-dt * 14));
    bank =
      T.MathUtils.clamp(turn, -0.65, 0.65) *
      Math.min(1, velocity.length() / 6) *
      0.2;
  }
  player.rotation.z = T.MathUtils.damp(player.rotation.z, bank, 9, dt);
  const pace = Math.min(
    1.7,
    travel / Math.max(dt, 0.001) / (swimming ? 2.7 : 5.3),
  );
  stride = T.MathUtils.damp(stride, pace, 10, dt);
  const floor = ground(p.x, p.z);
  jump = Math.max(0, p.y - floor);
  fieldCapture.resetRig();
  animateModel(
    player,
    elapsed,
    stride,
    swimming ? "swim" : grounded ? "idle" : "jump",
  );
  stepClock += dt * velocity.length();
  if (swimming && previousMedium !== "water") gameAudio.play("splash");
  if (stepClock > (swimming ? 1.7 : 1.5) && grounded) {
    stepClock = 0;
    gameAudio.play(swimming ? "splash" : "step");
  }
  if (swimming && velocity.length() > 0.4 && elapsed - lastWake > 0.48) {
    lastWake = elapsed;
    const wake = wakes[wakeIndex++ % wakes.length];
    wake.birth = elapsed;
    wake.mesh.position.set(p.x, floor + 0.035, p.z);
  }
  for (const { mesh, birth } of wakes) {
    const age = elapsed - birth;
    mesh.visible = age < 1.6;
    if (mesh.visible) {
      mesh.scale.setScalar(0.55 + age * 1.7);
      mesh.material.opacity = 0.52 * (1 - age / 1.6);
    }
  }
  previousMedium = medium;
  guardian.visible = Date.now() >= guardianRespawn;
  if (guardian.visible) animateModel(guardian, (now - perchStart) / 1000, 0);
  let best = 6;
  nearest = -1;
  wild.forEach((m, i) => {
    if (!m.visible) return;
    if (i === fieldCapture.index) {
      animateModel(
        m,
        elapsed + i,
        0,
        m.userData.flight ? "fly" : fieldCapture.casting ? "capture" : "look",
      );
      return;
    }
    const [, hx, hz] = habitatAt(i)!;
    const distanceToHabitat = Math.hypot(p.x - hx, p.z - hz);
    if (distanceToHabitat > 58) return;
    const distance = Math.hypot(p.x - m.position.x, p.z - m.position.z);
    if (distance < best && distanceToHabitat <= 7) {
      nearest = i;
      best = distance;
    }
    const flight = m.userData.flight as BeastFlight | undefined;
    if (flight) {
      flyAroundHabitat(m, flight, hx, hz, elapsed + i, dt);
      return;
    }
    const aquatic = fluid(hx, hz) === "water";
    const nearPlayer = Math.hypot(p.x - m.position.x, p.z - m.position.z) < 3.5;
    const roam = (m.userData.roam ??= {
      angle: i * 2.4,
      wait: 1 + (i % 15) * 0.3,
      x: hx,
      z: hz,
    });
    roam.wait -= dt;
    if (
      !nearPlayer &&
      roam.wait <= 0 &&
      Math.hypot(roam.x - m.position.x, roam.z - m.position.z) < 0.12
    ) {
      roam.angle += 2.39996;
      const tx = hx + Math.cos(roam.angle) * 1.65,
        tz = hz + Math.sin(roam.angle) * 1.65;
      if (walkable(tx, tz) && (fluid(tx, tz) === "water") === aquatic) {
        roam.x = tx;
        roam.z = tz;
      }
      roam.wait = 0.8 + (i % 3) * 0.45;
    }
    const dx = roam.x - m.position.x,
      dz = roam.z - m.position.z;
    const facing = nearPlayer
      ? Math.atan2(m.position.x - p.x, m.position.z - p.z)
      : Math.atan2(-dx, -dz);
    const turn = Math.atan2(
      Math.sin(facing - m.rotation.y),
      Math.cos(facing - m.rotation.y),
    );
    const walking = !nearPlayer && roam.wait <= 0 && Math.hypot(dx, dz) > 0.12;
    if (nearPlayer || walking) m.rotation.y += turn * (1 - Math.exp(-dt * 5));
    const patrolSpeed = aquatic
      ? 0.68
      : i === 2 && Math.sin(roam.angle) > 0.35
        ? 1.65
        : 0.78;
    const speed = patrolSpeed * Math.max(0, Math.cos(turn));
    let pace = 0;
    if (walking) {
      const step = Math.min(speed * dt, Math.hypot(dx, dz));
      const nx = m.position.x - Math.sin(m.rotation.y) * step,
        nz = m.position.z - Math.cos(m.rotation.y) * step;
      if (
        walkable(nx, nz) &&
        (fluid(nx, nz) === "water") === aquatic &&
        Math.abs(ground(nx, nz) - ground(m.position.x, m.position.z)) <= 0.61
      ) {
        m.position.x = nx;
        m.position.z = nz;
        pace = step / Math.max(dt, 0.001);
      } else {
        roam.x = m.position.x;
        roam.z = m.position.z;
      }
    }
    m.position.y = T.MathUtils.damp(
      m.position.y,
      ground(m.position.x, m.position.z) - (aquatic ? 0.22 : 0),
      14,
      dt,
    );
    animateModel(
      m,
      elapsed + i,
      pace,
      aquatic ? "swim" : nearPlayer ? "look" : pace > 0.05 ? "walk" : "eat",
    );
  });
  if (companion) {
    const dx = p.x - companion.position.x,
      dz = p.z - companion.position.z;
    const gap = Math.hypot(dx, dz);
    const step = Math.min(Math.max(0, gap - 1.8), dt * 8);
    if (step > 0) {
      companion.rotation.y = Math.atan2(-dx, -dz);
      companion.position.x += (dx / gap) * step;
      companion.position.z += (dz / gap) * step;
    }
    const flying = companion.userData.flight;
    companion.position.y =
      ground(companion.position.x, companion.position.z) + (flying ? 1.4 : 0);
    animateModel(
      companion,
      elapsed,
      (step / Math.max(dt, 0.001)) * 0.16,
      flying ? "fly" : "idle",
    );
  }
  for (const r of remotes.values()) {
    const moving = Math.hypot(r.m.position.x - r.x, r.m.position.z - r.z);
    r.m.position.lerp(
      new T.Vector3(r.x, ground(r.x, r.z), r.z),
      Math.min(1, dt * 10),
    );
    r.m.rotation.y = r.yaw;
    animateModel(r.m, elapsed, Math.min(1, moving));
    if (r.b) {
      r.b.position.set(
        r.m.position.x + 1,
        ground(r.m.position.x + 1, r.m.position.z) +
          (r.b.userData.flight ? 1.4 : 0),
        r.m.position.z,
      );
      animateModel(r.b, elapsed, 0.2, r.b.userData.flight ? "fly" : "idle");
    }
  }
  fieldCapture.update(dt);
  previousCameraRotation.copy(camera.quaternion);
  const framing = fieldCapture.index >= 0;
  if (framing) fieldCapture.camera(camera, dt);
  else {
    target.copy(p);
    target.y += 1.5;
    // Keep the boom above the ground as the player looks up toward the peaks.
    const boomPitch = Math.max(0.12, pitch);
    desired.set(
      Math.sin(angle) * Math.cos(boomPitch),
      Math.sin(boomPitch),
      Math.cos(angle) * Math.cos(boomPitch),
    );
    let reach = distance;
    for (let n = 1; n < distance; n += 0.5) {
      if (
        target.y + desired.y * n <
        cameraFloor(target.x + desired.x * n, target.z + desired.z * n) + 0.3
      ) {
        reach = Math.max(1, n - 0.6);
        break;
      }
    }
    desired.multiplyScalar(reach).add(target);
    if (!lastSent) camera.position.copy(desired);
    camera.position.lerp(desired, 1 - Math.exp(-dt * 11));
    camera.lookAt(target);
    camera.rotateX(0.28 + boomPitch - pitch);
  }
  if (wasFraming && !framing) cameraRecovery = 0.65;
  if ((framing || cameraRecovery > 0) && !gentleCamera.matches) {
    camera.quaternion.slerp(previousCameraRotation, Math.exp(-dt * 11));
  }
  cameraRecovery = Math.max(0, cameraRecovery - dt);
  wasFraming = framing;
  if (now - lastSent > 130) {
    lastSent = now;
    tell("move", {
      x: p.x,
      z: p.z,
      yaw: player.rotation.y,
      ranger: fieldRanger,
    });
    const zone = biome(p.x, p.z);
    gameAudio.setBiome(zone);
    const island = outerIslandAt(p.x, p.z);
    const region = frontierAt(p.x, p.z)
      ? sector(sectorAt(p.x), sectorAt(p.z)).range.name
      : undefined;
    document.querySelector("#region")!.textContent =
      region ?? (island && fluid(p.x, p.z) === "land" ? island.name : zone);
    document.querySelector("#coords")!.textContent =
      "X " + Math.round(p.x) + " / Z " + Math.round(p.z);
    const targetHabitat =
      landmark ?? (trackedHabitat >= 0 ? habitatAt(trackedHabitat) : undefined);
    document.querySelector("#trail-target")!.textContent = targetHabitat
      ? targetHabitat[0] +
        " · " +
        Math.round(Math.hypot(p.x - targetHabitat[1], p.z - targetHabitat[2])) +
        " m " + ["N","NE","E","SE","S","SW","W","NW"][
          (Math.round(Math.atan2(targetHabitat[1] - p.x, p.z - targetHabitat[2]) / (Math.PI / 4)) + 8) % 8
        ]
      : "";
    const merchant = nearbyMerchant();
    const prompt = document.querySelector<HTMLButtonElement>("#merchant-prompt")!;
    prompt.hidden = !merchant;
    if (merchant && prompt.dataset.kind !== merchant.kind) {
      prompt.dataset.kind = merchant.kind;
      prompt.querySelector("strong")!.textContent = merchant.name;
      prompt.querySelector("small")!.textContent = merchant.kind === "shop" ? "Browse supplies" : "Visit trading post";
      prompt.querySelector("use")!.setAttribute("href", merchant.kind === "shop" ? "#icon-pack" : "#icon-trade");
    }
    const site = siteAction();
    const action =
      site === "boss"
        ? "Raid"
        : site === "market"
          ? "Trade"
          : nearest < 0
            ? "Scan"
            : "Catch";
    const interact = document.querySelector<HTMLButtonElement>("#interact")!;
    if (interact.dataset.action !== action) {
      interact.dataset.action = action;
      interact
        .querySelector("use")!
        .setAttribute("href", "#icon-" + action.toLowerCase());
      interact.querySelector(".action-label")!.textContent = action;
    }
    interact.setAttribute(
      "aria-label",
      action === "Catch" ? "Catch " + habitatAt(nearest)![0] : action,
    );
  }
  if (now - lastMapDraw >= 32) {
    lastMapDraw = now;
    drawMap(minimap, true);
    if (openAtlas) {
      drawMap(openAtlas.canvas);
      openAtlas.update();
    }
  }
  renderer.render(scene, camera);
  placedNames.length = 0;
  positionName(localName, player.position);
  for (const r of remotes.values()) positionName(r.label, r.m.position);
}
export async function prepareTrailhead() {
  scenery(0, player.position);
  await Promise.resolve();
  camera.position.set(
    player.position.x,
    player.position.y + 3,
    player.position.z + 10,
  );
  camera.lookAt(player.position.x, player.position.y + 1.5, player.position.z);
  world.update(0, player.position, lastQuality);
  await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);
}
export function startExploring() {
  prev = performance.now();
  requestAnimationFrame(frame);
}
