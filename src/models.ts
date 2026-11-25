import { attachWildlife, attachAnimatedBeast } from "./wildlife";
import { makeVoxelExplorer } from "./voxelExplorer";
import { nativeBeasts } from "./frontier";
import { importedBeast, importedBeasts } from "./importedBeasts";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const species = [
  { name: "Mosskin", element: "Nature", color: "#89b755" },
  { name: "Bloomtail", element: "Nature", color: "#d7889c" },
  { name: "Emberling", element: "Fire", color: "#e48446" },
  { name: "Cinderclaw", element: "Fire", color: "#a44c46" },
  { name: "Aquabit", element: "Water", color: "#5ab6b8" },
  { name: "Bubblefin", element: "Water", color: "#708bc7" },
  { name: "Frostbite", element: "Ice", color: "#9dcfdd" },
  { name: "Snowpup", element: "Ice", color: "#d1dee4" },
  { name: "Crystalimp", element: "Crystal", color: "#967ac2" },
  { name: "Prismtail", element: "Crystal", color: "#6c81ae" },
  { name: "Sunplume", element: "Fire", color: "#fa9356", fallback: 2 },
  { name: "Reedmask", element: "Nature", color: "#90aa69", fallback: 1 },
  { name: "Rimehorn", element: "Ice", color: "#94cbdc", fallback: 6 },
  { name: "Geodeback", element: "Crystal", color: "#b496d6", fallback: 3 },
  { name: "Saltfleece", element: "Water", color: "#a2cec5", fallback: 7 },
  ...nativeBeasts.map(([name, element, color, , fallback]) => ({
    name,
    element,
    color,
    fallback,
  })),
  ...importedBeasts.map(({ name, element, color, fallback }) => ({
    name,
    element,
    color,
    fallback,
  })),
];

type Part = THREE.Group;
type Color = THREE.ColorRepresentation;
const skinMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.88,
});
const batches = new WeakMap<Part, THREE.BufferGeometry[]>();
const cube = new THREE.BoxGeometry(1, 1, 1);
const transform = new THREE.Object3D();

function pivot(parent: Part, name: string, x: number, y: number, z: number) {
  const p = new THREE.Group();
  p.name = name;
  p.position.set(x, y, z);
  parent.add(p);
  return p;
}

// Bake all cuboids on a rigid part into one draw call. Only joints move at runtime.
function box(
  p: Part,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  tint: Color,
  tilt = 0,
  pitch = 0,
) {
  transform.position.set(x, y, z);
  transform.rotation.set(pitch, 0, tilt);
  transform.scale.set(w, h, d);
  transform.updateMatrix();
  const geo = cube.clone().applyMatrix4(transform.matrix);
  const n = geo.getAttribute("position").count;
  const c = new THREE.Color(tint);
  const colors = new Float32Array(n * 3);
  // Retain a little sky bounce on upper edges and contact shading on lower edges.
  const vertices = cube.getAttribute("position");
  for (let i = 0; i < n; i++) {
    const lift = 0.93 + vertices.getY(i) * 0.12;
    colors[i * 3] = c.r * lift;
    colors[i * 3 + 1] = c.g * lift;
    colors[i * 3 + 2] = c.b * (0.96 + vertices.getY(i) * 0.075);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const list = batches.get(p) ?? [];
  list.push(geo);
  batches.set(p, list);
}

function finish(root: Part) {
  const joints: THREE.Object3D[] = [];
  root.traverse((p) => {
    if (p instanceof THREE.Bone) {
      joints.push(p);
      return;
    }
    if (!(p instanceof THREE.Group)) return;
    joints.push(p);
    const parts = batches.get(p);
    if (!parts) return;
    const combined = mergeGeometries(parts)!;
    const surface = new THREE.Mesh(combined, skinMaterial);
    surface.castShadow = true;
    surface.receiveShadow = true;
    p.add(surface);
    parts.forEach((g) => g.dispose());
    batches.delete(p);
  });
  root.userData.rest = joints
    .filter((p) => p !== root)
    .map((p) => ({
      p,
      y: p.position.y,
      z: p.position.z,
      rx: p.rotation.x,
      ry: p.rotation.y,
      rz: p.rotation.z,
    }));
  return root;
}

function shade(base: Color, brightness: number) {
  return new THREE.Color(base).multiplyScalar(brightness);
}

// A stepped contour keeps the block silhouette while rounding the crown and jaw.
function steppedForm(p: Part, w: number, h: number, d: number, coat: Color) {
  box(p, 0, 0, 0, w * 0.83, h, d * 0.91, coat);
  box(p, 0, h * 0.01, 0, w, h * 0.74, d * 0.86, coat);
  box(p, 0, -h * 0.025, 0, w * 0.85, h * 0.78, d, coat);
}

function face(
  head: Part,
  width: number,
  front: number,
  color: Color,
  gaze: Color,
) {
  const eyes = pivot(head, "eyes", 0, 0.03, 0);
  for (const s of [-1, 1]) {
    const x = s * width * 0.29;
    box(eyes, x, 0, front, 0.151, 0.17, 0.055, "#263537");
    box(eyes, x - 0.014, -0.021, front - 0.031, 0.07, 0.088, 0.024, gaze);
    box(eyes, x - 0.023, 0.038, front - 0.042, 0.043, 0.041, 0.019, "#fff5cf");
    box(
      head,
      s * width * 0.36,
      -0.105,
      front + 0.002,
      0.14,
      0.051,
      0.055,
      shade(color, 0.7),
    );
  }
}

function crest(
  p: Part,
  x: number,
  y: number,
  z: number,
  hue: Color,
  length: number,
  angle = 0,
) {
  box(
    p,
    x,
    y + length * 0.32,
    z,
    length * 0.31,
    length * 0.68,
    length * 0.3,
    hue,
    angle,
  );
  box(
    p,
    x - Math.sin(angle) * length * 0.34,
    y + length * 0.7,
    z,
    length * 0.17,
    length * 0.29,
    length * 0.16,
    shade(hue, 1.28),
    angle,
  );
}

function petal(
  p: Part,
  x: number,
  y: number,
  z: number,
  hue: Color,
  scale: number,
) {
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    box(
      p,
      x + dx * 0.15 * scale,
      y + dy * 0.15 * scale,
      z,
      0.23 * scale,
      0.23 * scale,
      0.13 * scale,
      hue,
    );
  }
  box(
    p,
    x,
    y,
    z - 0.065 * scale,
    0.17 * scale,
    0.17 * scale,
    0.12 * scale,
    "#ffd36f",
  );
}

function leg(
  body: Part,
  x: number,
  y: number,
  z: number,
  h: number,
  w: number,
  coat: Color,
  sole: Color,
  phase: number,
) {
  const p = pivot(body, "leg", x, y, z);
  p.userData.phase = phase;
  box(p, 0, -h * 0.43, 0, w, h * 0.85, w, coat);
  box(p, 0, -h + 0.07, -w * 0.12, w * 1.12, 0.14, w * 1.26, sole);
}

type Blueprint = {
  body: [number, number, number];
  leg: number;
  head: [number, number, number];
  lift: number;
  accent: string;
};
const blueprints: Blueprint[] = [
  {
    body: [0.97, 0.69, 1.01],
    leg: 0.29,
    head: [0.9, 0.69, 0.64],
    lift: 0.14,
    accent: "#b7d655",
  },
  {
    body: [0.59, 0.47, 0.9],
    leg: 0.37,
    head: [0.65, 0.53, 0.54],
    lift: 0.21,
    accent: "#f8bec7",
  },
  {
    body: [0.75, 0.71, 0.79],
    leg: 0.36,
    head: [0.88, 0.64, 0.65],
    lift: 0.29,
    accent: "#ffc36a",
  },
  {
    body: [1.03, 0.34, 0.73],
    leg: 0.25,
    head: [0.66, 0.35, 0.44],
    lift: 0.1,
    accent: "#ec9764",
  },
  {
    body: [0.91, 0.58, 0.98],
    leg: 0.22,
    head: [0.85, 0.5, 0.64],
    lift: 0.16,
    accent: "#b8e7be",
  },
  {
    body: [0.69, 0.83, 1.14],
    leg: 0.27,
    head: [0.66, 0.6, 0.49],
    lift: 0.09,
    accent: "#f8af9b",
  },
  {
    body: [0.78, 0.7, 1.05],
    leg: 0.53,
    head: [0.66, 0.56, 0.7],
    lift: 0.4,
    accent: "#d4f4ed",
  },
  {
    body: [0.74, 0.57, 0.92],
    leg: 0.35,
    head: [0.82, 0.65, 0.64],
    lift: 0.27,
    accent: "#91bbd2",
  },
  {
    body: [0.53, 0.64, 0.48],
    leg: 0.54,
    head: [0.89, 0.65, 0.6],
    lift: 0.45,
    accent: "#8ee4db",
  },
  {
    body: [0.64, 0.4, 1.15],
    leg: 0.27,
    head: [0.73, 0.4, 0.53],
    lift: 0.13,
    accent: "#d1a6ed",
  },
];

// A variant is an existing authoritative genetic seed. This renderer never rolls traits.
export function makeCreature(
  name: string,
  variant = 0,
  stage = 1,
): THREE.Group {
  if (name === "Green Dragon") {
    const guardian = new THREE.Group();
    guardian.userData.kind = 8;
    if (attachAnimatedBeast(guardian, name, new THREE.Color(0x75b784), 1))
      return guardian;
    return makeCreature("Mosskin", 379, 2);
  }
  const i = species.findIndex(
    (entry) => entry.name.toLowerCase() === name.toLowerCase(),
  );
  if (i < 0) throw new Error("Unknown creature species: " + name);
  const seed = Math.abs(Math.trunc(variant)) >>> 0;
  const entry = species[i],
    kind = entry.fallback ?? i,
    b = blueprints[kind];
  const coat = new THREE.Color(entry.color);
  coat.offsetHSL([0, 0.035, -0.033, 0.08, -0.075][seed % 5], 0, 0);
  const accent = new THREE.Color(b.accent);
  const dark = shade(coat, 0.46),
    pale = shade(coat, 1.35);
  const eye = ["#ffcf65", "#77dfe8", "#d9a6ff", "#98d78a"][(seed >>> 3) % 4];
  const root = new THREE.Group();
  root.userData.kind = kind;
  if (attachAnimatedBeast(root, entry.name, coat, stage)) return root;
  const imported = new THREE.Group();
  imported.name = "body";
  if (attachWildlife(imported, entry.name, coat)) {
    root.add(imported);
    root.userData.source =
      importedBeast(entry.name)?.source ?? "Cubicle Studio";
    const bounds = new THREE.Box3().setFromObject(imported),
      size = bounds.getSize(new THREE.Vector3());
    // Elemental dorsal plates keep each acquired animal identifiable across stages.
    const count = stage >= 2 ? 7 : 2 + (seed % 3);
    for (let k = 0; k < count; k++) {
      const length = stage >= 2 ? 0.27 : 0.09;
      box(
        imported,
        0,
        size.y * (0.78 + 0.09 * Math.sin((k / count) * Math.PI)),
        size.z * (k / count - 0.42) * 0.6,
        0.09,
        length + 0.04 * (k % 2),
        0.11,
        accent,
        0,
        0.18,
      );
    }
    if (stage >= 2)
      for (const side of [-1, 1]) {
        box(
          imported,
          side * size.x * 0.32,
          size.y * 0.92,
          -size.z * 0.2,
          0.13,
          0.42,
          0.14,
          pale,
          side * 0.32,
          -0.28,
        );
        box(
          imported,
          side * size.x * 0.43,
          size.y * 0.67,
          0.04,
          0.14,
          0.23,
          0.48,
          accent,
          side * 0.18,
        );
      }
    return finish(root);
  }
  const [w, h, d] = b.body,
    [hw, hh, hd] = b.head;
  const body = pivot(root, "body", 0, b.leg + h * 0.5, 0);
  steppedForm(body, w, h, d, coat);
  box(body, 0, -h * 0.29, -0.018, w * 0.8, h * 0.45, d * 1.024, pale);
  const head = pivot(body, "head", 0, b.lift, -d * 0.46 - hd * 0.25);
  steppedForm(head, hw, hh, hd, coat);
  face(head, hw, -hd * 0.5, coat, eye);
  const tail = pivot(body, "tail", 0, -h * 0.06, d * 0.46);
  for (const s of [-1, 1]) {
    if (kind === 5 || kind === 8) continue;
    leg(
      body,
      s * w * 0.34,
      -h * 0.34,
      -d * 0.29,
      b.leg + h * 0.16,
      w * 0.25,
      coat,
      dark,
      s > 0 ? 0 : Math.PI,
    );
    if (kind !== 2)
      leg(
        body,
        s * w * 0.34,
        -h * 0.34,
        d * 0.3,
        b.leg + h * 0.16,
        w * 0.27,
        coat,
        dark,
        s > 0 ? Math.PI : 0,
      );
  }
  switch (kind) {
    case 0: // Mosskin carries a terraced living hill and a tiny fern crown.
      box(body, 0, h * 0.42, 0.06, w * 1.08, 0.22, d * 0.9, "#5c8848");
      box(body, -0.05, h * 0.63, 0.13, w * 0.83, 0.22, d * 0.66, "#83a74e");
      box(body, 0.07, h * 0.84, 0.17, w * 0.54, 0.17, d * 0.43, accent);
      for (const s of [-1, 1]) {
        const fern = pivot(head, "sprout", s * 0.23, 0.24, 0.02);
        fern.userData.side = s;
        box(fern, s * 0.05, 0.13, 0, 0.17, 0.42, 0.13, accent, -s * 0.48);
        box(fern, s * 0.13, 0.22, 0, 0.15, 0.12, 0.15, "#d6df78");
        box(fern, s * 0.19, 0.21, 0.01, 0.16, 0.075, 0.11, "#a2c864", s * 0.24);
        box(body, s * 0.39, 0.44, 0.13, 0.14, 0.12, 0.33, "#94b45e");
        box(head, s * 0.38, -0.04, -0.16, 0.12, 0.16, 0.2, "#739b49");
      }
      box(body, -0.18, 0.68, 0.16, 0.063, 0.19, 0.064, "#e4cf86");
      box(body, -0.18, 0.78, 0.16, 0.23, 0.075, 0.19, "#d49160");
      box(body, -0.18, 0.83, 0.16, 0.14, 0.04, 0.12, "#fab979");
      box(head, 0, -0.21, -0.29, 0.32, 0.13, 0.16, "#bed184");
      box(tail, 0, 0.02, 0.16, 0.22, 0.19, 0.36, dark);
      break;
    case 1: // Small long-eared glider with flowers growing from a curled tail.
      for (const s of [-1, 1]) {
        const ear = pivot(head, "sprout", s * 0.17, 0.19, 0.02);
        ear.userData.side = s;
        box(ear, s * 0.06, 0.26, 0, 0.14, 0.5, 0.19, coat, -s * 0.28);
        box(ear, s * 0.08, 0.28, -0.102, 0.075, 0.31, 0.03, accent, -s * 0.28);
        box(body, s * 0.29, 0.095, 0.08, 0.075, 0.13, 0.42, accent, 0, 0.22);
      }
      box(tail, 0, 0.1, 0.22, 0.19, 0.19, 0.54, coat);
      box(tail, 0, 0.34, 0.45, 0.19, 0.44, 0.19, coat);
      petal(tail, 0, 0.61, 0.44, accent, 1.15);
      petal(head, -0.3, 0.19, -0.2, "#f3ab8c", 0.6);
      break;
    case 2: // Bipedal kiln gremlin, ember brows and a stepped flame tail.
      for (const s of [-1, 1]) {
        box(head, s * 0.32, 0.32, 0.02, 0.21, 0.27, 0.22, dark, -s * 0.27);
        box(
          head,
          s * 0.26,
          0.14,
          -hd * 0.5,
          0.23,
          0.075,
          0.065,
          accent,
          -s * 0.17,
        );
        box(body, s * 0.41, 0.015, -0.12, 0.19, 0.31, 0.21, coat, -s * 0.18);
      }
      box(head, 0, -0.18, -0.35, 0.41, 0.16, 0.19, pale);
      for (const s of [-1, 1]) {
        box(body, s * 0.38, 0, 0.09, 0.054, 0.18, 0.22, "#744b47");
        box(body, s * 0.405, 0.015, 0.085, 0.016, 0.035, 0.14, "#ffd282");
        box(head, s * 0.102, -0.12, -0.445, 0.046, 0.04, 0.02, dark);
      }
      box(tail, 0, -0.05, 0.22, 0.25, 0.23, 0.5, dark);
      box(tail, 0, 0.15, 0.42, 0.27, 0.37, 0.23, "#f78036");
      box(tail, -0.04, 0.36, 0.43, 0.15, 0.25, 0.15, "#ffd268");
      break;
    case 3: // Low lava crab with articulated pincers and layered shell plates.
      for (const s of [-1, 1]) {
        const claw = pivot(body, "arm", s * 0.49, 0.05, -0.26);
        claw.userData.phase = s > 0 ? 0 : Math.PI;
        box(claw, s * 0.18, -0.02, -0.07, 0.43, 0.17, 0.22, dark);
        box(claw, s * 0.38, 0.03, -0.18, 0.32, 0.27, 0.38, coat);
        box(claw, s * 0.44, 0.08, -0.41, 0.16, 0.19, 0.26, accent);
        box(claw, s * 0.26, 0.01, -0.37, 0.12, 0.12, 0.24, accent);
        crest(body, s * 0.3, 0.16, 0.12, dark, 0.29, -s * 0.28);
      }
      box(body, 0, 0.21, 0.04, 0.57, 0.11, 0.61, dark);
      box(body, 0, 0.27, 0.04, 0.11, 0.035, 0.56, accent);
      for (const s of [-1, 1]) {
        box(body, s * 0.29, 0.19, -0.04, 0.22, 0.07, 0.44, "#784445", s * 0.16);
        box(body, s * 0.29, 0.235, -0.025, 0.08, 0.035, 0.3, "#c78258");
      }
      break;
    case 4: // River grazer with layered external gills and a paddle.
      for (const s of [-1, 1])
        for (let n = 0; n < 3; n++) {
          box(
            head,
            s * (0.44 + n * 0.043),
            0.15 - n * 0.11,
            0.04 + n * 0.06,
            0.24,
            0.071,
            0.12,
            accent,
            s * (0.38 - n * 0.29),
          );
        }
      box(head, 0, -0.16, -0.35, 0.53, 0.17, 0.21, pale);
      box(tail, 0, 0, 0.24, 0.23, 0.19, 0.55, coat);
      box(tail, 0, 0.025, 0.53, 0.49, 0.12, 0.39, accent);
      for (const s of [-1, 1]) {
        for (let n = 0; n < 3; n++)
          box(
            body,
            s * 0.457,
            0.05,
            0.03 + n * 0.09,
            0.018,
            0.055,
            0.051,
            "#def1c1",
          );
      }
      break;
    case 5: // Floating lantern fish, brow lure, fins, forked tail.
      for (const s of [-1, 1]) {
        const fin = pivot(body, "wing", s * 0.32, 0.01, 0.02);
        fin.userData.side = s;
        box(fin, s * 0.24, 0, 0.04, 0.51, 0.095, 0.31, accent, s * 0.2);
        box(tail, 0, s * 0.14, 0.3, 0.13, 0.24, 0.39, accent, 0, s * 0.52);
      }
      crest(body, 0, 0.39, 0.05, accent, 0.31);
      for (const s of [-1, 1]) {
        box(
          body,
          s * 0.35,
          0.055,
          0.02,
          0.024,
          0.28,
          0.11,
          "#555f94",
          0,
          -0.28,
        );
        box(body, s * 0.35, 0.04, 0.22, 0.024, 0.24, 0.07, "#b9bad8", 0, -0.28);
      }
      box(head, 0, 0.4, -0.05, 0.07, 0.32, 0.08, dark);
      box(head, 0, 0.54, -0.17, 0.07, 0.07, 0.28, dark);
      box(head, 0, 0.47, -0.32, 0.16, 0.17, 0.16, "#f6e590");
      break;
    case 6: // Horned alpine herbivore, split antlers and shaggy chin.
      for (const s of [-1, 1]) {
        crest(head, s * 0.24, 0.27, 0.03, accent, 0.63, -s * 0.21);
        crest(head, s * 0.31, 0.45, -0.04, accent, 0.31, -s * 0.79);
        box(head, s * 0.37, 0.14, 0.06, 0.29, 0.15, 0.2, coat, s * 0.33);
      }
      box(head, 0, -0.31, -0.18, 0.24, 0.23, 0.23, accent);
      for (const s of [-1, 1]) {
        box(
          body,
          s * 0.34,
          0.26,
          -0.24,
          0.22,
          0.31,
          0.39,
          "#c2dedf",
          -s * 0.26,
        );
        box(
          body,
          s * 0.38,
          0.15,
          -0.14,
          0.13,
          0.28,
          0.24,
          "#c2dedf",
          -s * 0.34,
        );
      }
      box(tail, 0, 0, 0.15, 0.21, 0.18, 0.33, accent);
      break;
    case 7: // Compact polar hound with dark mask and rolled cloud tail.
      for (const s of [-1, 1]) {
        box(head, s * 0.31, 0.28, 0.04, 0.24, 0.28, 0.27, dark, -s * 0.23);
        box(head, s * 0.31, 0.32, -0.105, 0.12, 0.14, 0.03, accent, -s * 0.23);
        box(body, s * 0.28, 0.18, -0.24, 0.27, 0.44, 0.36, "#eaf1e4");
      }
      box(head, 0, -0.17, -0.34, 0.45, 0.23, 0.24, "#eaf1e4");
      box(head, 0, -0.11, -0.47, 0.19, 0.09, 0.055, dark);
      box(tail, 0, 0.12, 0.13, 0.3, 0.36, 0.31, accent);
      box(tail, 0, 0.35, 0.08, 0.34, 0.24, 0.32, "#eaf1e4");
      for (const s of [-1, 1]) {
        box(
          head,
          s * 0.35,
          -0.09,
          -0.14,
          0.17,
          0.19,
          0.24,
          "#eff1df",
          s * 0.16,
        );
        box(body, s * 0.3, 0.08, 0.26, 0.19, 0.2, 0.26, "#a2c1cc");
      }
      break;
    case 8: // Floating geode with detached fists and split crown.
      for (const s of [-1, 1]) {
        const arm = pivot(body, "arm", s * 0.42, 0.02, 0);
        arm.userData.phase = s > 0 ? 0 : Math.PI;
        box(arm, 0, 0, 0, 0.24, 0.29, 0.27, dark, s * 0.13);
        crest(arm, 0, 0.11, 0, accent, 0.2);
        crest(head, s * 0.33, 0.27, 0.02, accent, 0.42, -s * 0.36);
        box(body, s * 0.14, -0.4, 0.02, 0.18, 0.26, 0.2, dark);
      }
      box(body, 0, 0.03, -0.26, 0.21, 0.21, 0.055, accent, Math.PI / 4);
      crest(head, 0, 0.32, 0.12, "#bc9de1", 0.58);
      for (const s of [-1, 1]) {
        box(
          head,
          s * 0.33,
          -0.18,
          -0.1,
          0.14,
          0.19,
          0.31,
          "#76649e",
          -s * 0.27,
        );
        box(
          body,
          s * 0.195,
          0.06,
          -0.16,
          0.09,
          0.11,
          0.16,
          "#b6b1de",
          s * 0.29,
        );
      }
      break;
    case 9: // Long crystal-backed skink with a segmented prism club.
      for (let n = 0; n < 4; n++)
        crest(
          body,
          0,
          0.18,
          -0.32 + n * 0.23,
          n % 2 ? accent : "#91cbd9",
          0.31 - n * 0.03,
        );
      for (const s of [-1, 1])
        crest(head, s * 0.36, 0.1, 0.08, accent, 0.27, -s * 0.94);
      box(tail, 0, -0.01, 0.28, 0.28, 0.23, 0.62, coat);
      box(tail, 0, 0.01, 0.6, 0.21, 0.19, 0.35, dark);
      box(tail, 0, 0.06, 0.86, 0.32, 0.32, 0.35, accent, Math.PI / 4);
      for (const s of [-1, 1])
        for (let n = 0; n < 3; n++) {
          box(
            body,
            s * 0.32,
            0.046,
            -0.24 + n * 0.24,
            0.024,
            0.15,
            0.098,
            n % 2 ? accent : "#9dbacb",
            0,
            0.43,
          );
        }
      break;
  }
  if (seed % 7 === 3) {
    for (const s of [-1, 1])
      crest(head, s * hw * 0.3, hh * 0.45, 0.14, eye, 0.28, -s * 0.23);
  }
  if ((seed >>> 4) % 3 === 1)
    for (const s of [-1, 1]) {
      for (let n = 0; n < 3; n++)
        box(
          body,
          s * w * 0.5,
          0.04 + n * 0.02,
          -d * 0.24 + n * d * 0.23,
          0.014,
          h * 0.25,
          0.073,
          dark,
        );
    }
  if (stage >= 2) {
    // Element-specific additional anatomy, including a canopy, fins or a mantle.
    for (const s of [-1, 1]) {
      if (entry.element === "Nature") {
        box(
          body,
          s * w * 0.37,
          h * 0.74,
          0.14,
          0.21,
          0.46,
          0.21,
          dark,
          -s * 0.3,
        );
        box(body, s * w * 0.55, h * 0.99, 0.14, 0.71, 0.18, 0.53, accent);
        petal(body, s * w * 0.62, h * 1.11, 0.0, "#e8c574", 0.62);
      } else if (entry.element === "Ice") {
        crest(head, s * hw * 0.46, hh * 0.26, 0.15, accent, 0.78, -s * 0.49);
        box(
          body,
          s * w * 0.47,
          h * 0.16,
          -d * 0.26,
          0.26,
          0.54,
          0.34,
          pale,
          -s * 0.27,
        );
      } else {
        const wing = pivot(body, "wing", s * w * 0.43, h * 0.28, 0.15);
        wing.userData.side = s;
        box(wing, s * 0.31, 0.22, 0.04, 0.78, 0.2, 0.39, accent, s * 0.49);
        box(wing, s * 0.52, 0.23, 0.27, 0.59, 0.17, 0.41, coat, s * 0.49);
        box(wing, s * 0.64, 0.22, 0.48, 0.36, 0.14, 0.33, dark, s * 0.49);
      }
    }
  }
  // Paired flank markings follow the body joint and stay visible during locomotion.
  for (const side of [-1, 1])
    for (let k = 0; k < 4; k++) {
      const z = d * (0.29 - k * 0.15),
        rise = Math.sin(k * 1.5 + i) * h * 0.08;
      box(
        body,
        side * w * 0.5,
        h * 0.12 + rise,
        z,
        0.026,
        h * (0.1 + 0.025 * (k % 2)),
        d * 0.072,
        k % 2 ? accent : pale,
        0,
        side * 0.24,
      );
    }
  return finish(root);
}

export type BeastFigure = {
  name: string;
  variant?: number;
  stage?: number;
  mutation?: string;
  marking?: string;
};
export function makeBeastFigure(beast: BeastFigure) {
  const figure = makeCreature(beast.name, beast.variant, beast.stage);
  if (
    !(beast.stage && beast.stage > 1) &&
    !beast.mutation &&
    (!beast.marking || beast.marking === "None")
  )
    return figure;
  const bounds = new THREE.Box3().setFromObject(figure, true);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const hues: Record<string, number> = {
    Steam: 0x9ce6ec,
    Glacier: 0x81d5ff,
    "Magma Crystal": 0xf28357,
    "Ancient Grove": 0x9cc36d,
    Amber: 0xffc262,
    Jade: 0x54d7a6,
    Violet: 0xc39bff,
  };
  // Scale and offset are measured from the displayed form so small aquatic beasts also fit.
  if (beast.mutation || (beast.stage ?? 1) > 1) {
    const color = hues[beast.mutation ?? ""] ?? 0xdaca96;
    for (const side of [-1, 1]) {
      box(
        figure,
        center.x + side * size.x * 0.25,
        bounds.max.y - 0.03,
        center.z,
        0.15,
        0.34,
        0.16,
        color,
        0,
        side * -0.28,
      );
    }
  }
  if (beast.marking && beast.marking !== "None") {
    box(
      figure,
      center.x,
      center.y,
      bounds.min.z - 0.025,
      0.22,
      0.16,
      0.08,
      hues[beast.marking] ?? 0xffffff,
    );
  }
  return figure;
}
export const makeExplorer = makeVoxelExplorer;

type Rest = {
  p: THREE.Object3D;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
};
// Cadence, lift and lateral roll distinguish a skitter, bound, trot, swim or hover.
const locomotion = [
  { cadence: 6.0, lift: 0.027, roll: 0.05 },
  { cadence: 9.2, lift: 0.125, roll: 0.025 },
  { cadence: 8.6, lift: 0.088, roll: 0.084 },
  { cadence: 12.4, lift: 0.024, roll: 0.066 },
  { cadence: 6.3, lift: 0.022, roll: 0.082 },
  { cadence: 4.8, lift: 0.032, roll: 0.11 },
  { cadence: 7.4, lift: 0.058, roll: 0.034 },
  { cadence: 9.0, lift: 0.077, roll: 0.049 },
  { cadence: 3.8, lift: 0.06, roll: 0.085 },
  { cadence: 8.8, lift: 0.021, roll: 0.082 },
];
const rangerGait = { cadence: 8.4, lift: 0.047, roll: 0.025 };
type Motion = {
  previous: number;
  phase: number;
  speed: number;
  pose: string;
  poseTime: number;
  landing: number;
};
export function animateModel(
  model: THREE.Group,
  time: number,
  moving: number,
  action = "idle",
): void {
  if (model.userData.perchedPose) {
    model.userData.perchedPose(time);
    return;
  }
  const kind: number = model.userData.kind;
  const target = THREE.MathUtils.clamp(moving, 0, 1.7);
  const gaitStyle = kind < 0 ? rangerGait : locomotion[kind];
  const motion: Motion = (model.userData.motion ??= {
    previous: time,
    phase: kind * 0.57,
    speed: target,
    pose: action,
    poseTime: 0,
    landing: 0,
  });
  const dt = THREE.MathUtils.clamp(time - motion.previous, 0, 0.12);
  motion.previous = time;
  motion.speed = THREE.MathUtils.damp(motion.speed, target, 9, dt);
  if (model.userData.playClip) {
    model.userData.playClip(dt, motion.speed, action);
    return;
  }
  motion.phase +=
    dt *
    gaitStyle.cadence *
    (model.userData.source
      ? Math.min(1.8, motion.speed * 1.6)
      : 0.72 + motion.speed * 0.37);
  if (motion.pose !== action) {
    if (motion.pose === "jump") motion.landing = 1;
    motion.pose = action;
    motion.poseTime = 0;
  }
  motion.poseTime += dt;
  motion.landing = Math.max(0, motion.landing - dt * 5.5);
  const landing = Math.sin(motion.landing * Math.PI);
  const speed = motion.speed;
  const t = time * (kind === 8 ? 1.8 : kind === 1 ? 3.2 : 2.4) + kind * 0.7;
  const gait = motion.phase;
  const swing = Math.sin(gait);
  const idle = 1 - Math.min(speed, 1);
  const hop = (1 - Math.cos(2 * gait)) * 0.5;
  const moveWeight = speed * (action === "jump" ? 0.28 : 1);
  const attackTime = motion.poseTime % 1.35;
  const windup =
    action === "attack"
      ? Math.max(0, 1 - Math.abs(attackTime - 0.18) / 0.18)
      : 0;
  const strike =
    action === "attack"
      ? Math.max(0, 1 - Math.abs(attackTime - 0.39) / 0.2)
      : 0;
  const floating = (kind === 5 && !model.userData.source) || kind === 8;
  const blinkTime = THREE.MathUtils.euclideanModulo(time + kind * 0.23, 4.3);
  const eyeOpen =
    action === "sleep"
      ? 0.08
      : THREE.MathUtils.clamp(Math.abs(blinkTime - 0.12) / 0.085, 0.08, 1);
  for (const { p, y, z, rx, ry, rz } of model.userData.rest as Rest[]) {
    p.position.y = y;
    p.position.z = z;
    p.rotation.set(rx, ry, rz);
    switch (p.name) {
      case "body":
        p.position.y +=
          Math.sin(t) * (floating ? 0.082 : 0.009 * idle) +
          hop * gaitStyle.lift * moveWeight;
        p.rotation.z +=
          (floating ? Math.sin(t * 0.66) * 0.075 : 0) +
          swing * gaitStyle.roll * moveWeight;
        p.rotation.y +=
          swing * (kind === 9 || kind === 4 ? 0.19 : 0.043) * moveWeight;
        p.rotation.x +=
          kind < 0 ? -0.065 * moveWeight : hop * 0.046 * moveWeight;
        p.rotation.x += windup * 0.2 - strike * 0.3;
        p.position.z += windup * 0.12 - strike * 0.29;
        p.position.y -= landing * 0.09;
        if (action === "hit") {
          const recoil = Math.exp(-motion.poseTime * 5);
          p.rotation.z += Math.sin(motion.poseTime * 31) * recoil * 0.32;
          p.position.z += recoil * 0.18;
        }
        if (action === "defend" || action === "sleep") p.position.y -= 0.12;
        if (action === "swim") {
          p.rotation.x = kind < 0 ? -0.8 : 0.055 * Math.sin(gait);
          p.position.y += 0.05 * Math.sin(gait);
        }
        if (action === "jump") p.rotation.x -= 0.16;
        if (action === "land") p.position.y -= 0.08;
        if (action === "capture") p.rotation.y += Math.sin(time * 22) * 0.23;
        if (action === "victory" || action === "evolve")
          p.position.y += Math.abs(Math.sin(motion.poseTime * 6)) * 0.24;
        break;
      case "head":
        p.rotation.y +=
          Math.sin(t * 0.64) *
          (0.053 + (kind === 0 ? 0.08 : 0)) *
          (1 - Math.min(speed, 1));
        p.rotation.x +=
          Math.sin(t) * 0.04 -
          (action === "eat"
            ? Math.min(1, motion.poseTime * 3) * (0.2 + 0.07 * Math.sin(t * 2))
            : 0);
        p.rotation.z -= swing * gaitStyle.roll * moveWeight * 0.66;
        if (kind === 7 || kind === 0)
          p.rotation.z +=
            Math.pow(Math.max(0, Math.sin(t * 0.55)), 5) * 0.14 * idle;
        if (kind === 6)
          p.rotation.x +=
            Math.pow(Math.max(0, Math.sin(t * 0.39)), 8) * 0.34 * idle;
        if (kind === 2)
          p.rotation.x -=
            Math.pow(Math.max(0, Math.sin(t * 0.72)), 7) * 0.16 * idle;
        if (kind < 0) p.rotation.y -= swing * 0.053 * moveWeight;
        if (action === "look" || action === "turn")
          p.rotation.y += Math.sin(time * 2) * 0.32;
        if (action === "interact") p.rotation.x += 0.19;
        break;
      case "eyes":
        p.scale.y = eyeOpen;
        break;
      case "leg":
      case "arm":
        p.rotation.x +=
          Math.sin(gait + p.userData.phase) *
          moveWeight *
          (kind < 0 && p.name === "arm" ? 0.47 : 0.56);
        if (model.userData.source && p.name === "leg") {
          const phase = gait + p.userData.phase;
          if (action === "swim") {
            const side = p.position.x > 0 ? 1 : -1;
            p.rotation.y += side * (0.18 + 0.42 * Math.sin(phase)) * moveWeight;
            p.rotation.z += side * 0.13 * Math.cos(phase) * moveWeight;
          } else
            p.position.y += Math.max(0, Math.cos(phase)) * 0.064 * moveWeight;
        }
        if (floating) p.position.y += Math.sin(t + p.userData.phase) * 0.065;
        if (p.name === "arm" && action === "attack")
          p.rotation.x += strike * 0.85 - windup * 0.35;
        if (p.name === "arm" && kind === 3)
          p.rotation.y += Math.sin(t + p.userData.phase) * 0.1;
        if (p.name === "arm" && action === "jump")
          p.rotation.z += (p.userData.phase === 0 ? 1 : -1) * 0.3;
        if (p.name === "arm" && action === "interact" && p.userData.phase === 0)
          p.rotation.x += 1.25;
        if (p.name === "leg" && action === "jump") p.rotation.x += 0.25;
        break;
      case "elbow": {
        const forward = Math.max(0, Math.sin(gait + p.userData.phase));
        p.rotation.x += 0.11 + moveWeight * (0.16 + forward * 0.46);
        if (action === "jump") p.rotation.x += 0.45;
        break;
      }
      case "knee": {
        const toeOff = Math.max(0, Math.cos(gait + p.userData.phase));
        p.rotation.x -=
          toeOff * toeOff * moveWeight * 0.89 + 0.045 + landing * 0.31;
        if (action === "jump") p.rotation.x -= 0.64;
        break;
      }
      case "boot":
        p.rotation.x -= Math.sin(gait + p.userData.phase) * moveWeight * 0.23;
        break;
      case "pack":
        p.position.y += Math.sin(2 * gait - 0.6) * moveWeight * 0.019;
        p.rotation.z -= Math.sin(gait - 0.7) * moveWeight * 0.036;
        p.rotation.x += Math.cos(2 * gait - 0.5) * moveWeight * 0.034;
        break;
      case "scarf":
        p.rotation.x -= 0.07 + moveWeight * (0.34 + 0.1 * Math.sin(gait));
        p.rotation.z +=
          0.075 * Math.sin(t * 1.9) + moveWeight * 0.1 * Math.cos(gait);
        break;
      case "sprout":
        p.rotation.z +=
          p.userData.side *
          (Math.cos(t * 1.29) * 0.059 +
            Math.sin(2 * gait - 0.5) * moveWeight * 0.14);
        p.rotation.x += Math.sin(t * 0.88) * 0.07;
        break;
      case "tail":
        p.rotation.y +=
          Math.sin(t * (kind === 7 ? 2.65 : kind === 9 ? 1.55 : 1)) *
          (kind === 7 || kind === 9 || kind === 4 ? 0.36 : 0.17);
        p.rotation.x += Math.cos(t) * 0.075;
        break;
      case "wing":
        p.rotation.z += p.userData.side * Math.sin(t * 1.8) * 0.25;
        break;
    }
  }
}
