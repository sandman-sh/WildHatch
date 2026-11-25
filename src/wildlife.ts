import * as T from "three";
import { nativeBeasts } from "./frontier";
import { importedBeast, importedBeasts } from "./importedBeasts";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";

const forms: Record<string, string> = {
  Mosskin: "North_American_Porcupine",
  Snowpup: "Wolf",
  Cinderclaw: "Wild_Boar",
  Aquabit: "Snapping_Turtle",
  Bubblefin: "North_American_River_Otter",
  ...Object.fromEntries(
    importedBeasts
      .filter((animal) => animal.source === "Cubicle Studio" && !animal.flight)
      .map(({ name, file }) => [name, file]),
  ),
};
type Joint = { name: string; origin: T.Vector3; phase: number };
type Rig = { geometry: T.BufferGeometry; joints: Joint[] };
const library = new Map<string, Rig>();
const material = new T.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.88,
});

function prepare(scene: T.Group, sizeLimit = 1.9): Rig {
  scene.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(scene),
    center = bounds.getCenter(new T.Vector3());
  const muzzle =
    scene.getObjectByProperty("name", "Nariz") ??
    scene.getObjectByProperty("name", "Bico") ??
    scene.getObjectByProperty("name", "Focinho") ??
    scene.getObjectByProperty("name", "Nariz_largo") ??
    scene.getObjectByName("Maxilar_superior");
  const nose = muzzle
    ? new T.Box3().setFromObject(muzzle).getCenter(new T.Vector3()).sub(center)
    : new T.Vector3(0, 0, -1);
  const size = bounds.getSize(new T.Vector3()),
    scale = sizeLimit / Math.max(size.x, size.y, size.z);
  const basis = new T.Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(
      new T.Matrix4().makeRotationY(Math.PI - Math.atan2(nose.x, nose.z)),
    )
    .multiply(
      new T.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z),
    );
  const height = size.y * scale;
  const joints: Joint[] = [
    "torso",
    "head",
    "tail",
    "leg",
    "leg",
    "leg",
    "leg",
  ].map((name, i) => ({
    name,
    origin: new T.Vector3(),
    phase: [0, 0, 0, 0.0, Math.PI, Math.PI * 1.35, Math.PI * 0.35][i],
  }));
  const boxes = joints.map(() => new T.Box3());
  const positions: number[] = [],
    normals: number[] = [],
    colors: number[] = [],
    owners: number[] = [];
  const v = new T.Vector3(),
    normal = new T.Vector3();
  scene.traverse((mesh) => {
    if (!(mesh instanceof T.Mesh)) return;
    const g = mesh.geometry,
      color = (mesh.material as T.MeshStandardMaterial).color;
    const transform = basis.clone().multiply(mesh.matrixWorld),
      nm = new T.Matrix3().getNormalMatrix(transform);
    const tag = (mesh.name + " " + mesh.parent?.name).toLowerCase();
    const foot = /pata|casco|garra|dedo|unha|perna|membro/.test(tag);
    const face =
      /cabeca|focinho|olho|nariz|narina|orelha|boca|bico|bigode|queixo|mandibula|maxilar|dente|chifre|galhada|sobrancelha|pupila|iris|orbita|presas/.test(
        tag,
      );
    for (let i = 0; i < (g.index?.count ?? g.attributes.position.count); i++) {
      const n = g.index ? g.index.getX(i) : i;
      v.fromBufferAttribute(g.attributes.position, n).applyMatrix4(transform);
      normal.fromBufferAttribute(g.attributes.normal, n).applyNormalMatrix(nm);
      const owner = foot
        ? 3 + (v.x > 0 ? 2 : 0) + (v.z > 0 ? 1 : 0)
        : tag.includes("cauda")
          ? 2
          : face
            ? 1
            : 0;
      boxes[owner].expandByPoint(v);
      owners.push(owner);
      positions.push(v.x, v.y, v.z);
      normals.push(normal.x, normal.y, normal.z);
      colors.push(color.r, color.g, color.b);
    }
  });
  boxes.forEach((b, i) => {
    if (b.isEmpty()) {
      // Some animals have a very short tail or feet merged into their torso.
      if (i >= 3)
        joints[i].origin.set(
          (i < 5 ? -1 : 1) * sizeLimit * 0.12,
          height * 0.42,
          (i % 2 === 0 ? 1 : -1) * sizeLimit * 0.2,
        );
      return;
    }
    const origin = b.getCenter(joints[i].origin);
    if (i === 1) origin.z = b.max.z;
    if (i === 2) origin.z = b.min.z;
    if (i >= 3) origin.y = Math.max(b.max.y, height * 0.41);
  });
  const indices: number[] = [],
    weights: number[] = [];
  // Blend the author's one-piece fur mesh into the neck and hips. Attach facial
  // features and claws fully so that eyes and toes follow the same limb.
  for (let i = 0; i < owners.length; i++) {
    const owner = owners[i];
    v.fromArray(positions, i * 3);
    let joint = owner,
      weight = 1;
    if (owner === 0) {
      const head = joints[1].origin;
      const neck =
        1 - T.MathUtils.smoothstep(v.z, head.z - 0.09, head.z + 0.12);
      const hipIndex = 3 + (v.x > 0 ? 2 : 0) + (v.z > 0 ? 1 : 0),
        hip = joints[hipIndex].origin;
      const distance = Math.hypot(v.x - hip.x, v.z - hip.z);
      const reach = Math.max(
        0.12,
        boxes[hipIndex].getSize(normal).length() * 0.6,
      );
      const leg =
        (1 - T.MathUtils.smoothstep(distance, reach * 0.5, reach)) *
        (1 - T.MathUtils.smoothstep(v.y, hip.y * 0.72, hip.y + 0.08));
      joint = neck >= leg ? 1 : hipIndex;
      weight = Math.max(neck, leg);
    }
    indices.push(0, joint, 0, 0);
    weights.push(1 - weight, weight, 0, 0);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("skinIndex", new T.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new T.Float32BufferAttribute(weights, 4));
  return { geometry, joints };
}
const animatedForms: Record<string, string> = {
  ...Object.fromEntries(
    nativeBeasts.map(([name, , , source]) => [name, "range-" + source]),
  ),
  Bloomtail: "BloomtailCat",
  "Green Dragon": "GreenDragon",
  Emberling: "Velociraptor",
  Frostbite: "Stegosaurus",
  Sunplume: "frontier-Chicken",
  Reedmask: "frontier-Raccoon",
  Rimehorn: "frontier-Yeti",
  Geodeback: "frontier-Pig",
  Saltfleece: "frontier-Sheep",
  ...Object.fromEntries(
    importedBeasts
      .filter((animal) => animal.source !== "Cubicle Studio" || animal.flight)
      .map(({ name, file }) => [name, file]),
  ),
};
const animatedAssets = new Map<string, GLTF>();
export function attachAnimatedBeast(
  root: T.Group,
  name: string,
  coat: T.Color,
  stage: number,
) {
  const asset = animatedAssets.get(name);
  const isDinosaur = name === "Emberling" || name === "Frostbite";
  const imported = importedBeast(name);
  if (!asset) return false;
  const model = cloneSkeleton(asset.scene);
  const holder = new T.Group();
  holder.add(model);
  root.add(holder);
  const mixer = new T.AnimationMixer(model);
  const range = animatedForms[name]?.startsWith("range-");
  const frontier = range || animatedForms[name]?.startsWith("frontier-");
  const actions = new Map(
    asset.animations.map((clip) => [
      frontier
        ? clip.name.split("|").pop()!.toLowerCase()
        : clip.name.split("_").pop()!.toLowerCase(),
      mixer.clipAction(clip),
    ]),
  );
  if (range) {
    for (const [key, source] of Object.entries({
      run: "gallop",
      jump: "gallop_jump",
      attack: "attack_headbutt",
      hitrecieve: "idle_hitreact_left",
      idle_eating: "eating",
    })) {
      if (!actions.has(key) && actions.has(source))
        actions.set(key, actions.get(source)!);
    }
  }
  if (imported) {
    for (const [key, source] of Object.entries({
      idle_eating: "eat",
      jump: "celebrate",
      attack: "eat",
    })) {
      const clip = actions.get(source);
      if (clip && !actions.has(key)) actions.set(key, clip);
    }
  }
  if (imported?.flight && !actions.has("fly")) {
    const wingMotion = actions.get("run");
    if (wingMotion) actions.set("fly", wingMotion);
  }
  let current = actions.get("idle")!;
  current.play();
  mixer.update(0);
  holder.updateMatrixWorld(true);
  const bones: T.Bone[] = [];
  model.traverse((o) => {
    if (o instanceof T.Bone) bones.push(o);
    if (
      !(o instanceof T.Mesh) ||
      (!(o instanceof T.SkinnedMesh) && !imported?.flight)
    )
      return;
    o.geometry = o.geometry.clone();
    const mat = (o.material as T.MeshStandardMaterial).clone();
    if (isDinosaur) {
      const frost = name === "Frostbite";
      const palette: Record<string, number> = frost
        ? { LightBrown: 0xb4dddb, DarkBrown: 0x477d88, Brown: 0x78aebe }
        : { LightBrown: 0xffb45c, Brown: 0xad5140, Black: 0x392a2b };
      mat.color
        .setHex(palette[mat.name] ?? 0x919680)
        .lerp(coat, stage > 1 ? 0.32 : 0.12);
    } else if (name === "Bloomtail" || frontier || imported)
      mat.color.lerp(coat, stage > 1 ? 0.26 : 0.09);
    mat.metalness = 0;

    mat.roughness = 0.9;
    o.material = mat;
    o.geometry.addEventListener("dispose", () => {
      if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
      mat.dispose();
    });
    o.castShadow = o.receiveShadow = true;
    if (imported && mat.map) {
      mat.map.magFilter = T.NearestFilter;
      mat.map.needsUpdate = true;
    }
  });
  const head = bones.find((o) => /head/i.test(o.name)),
    tail = bones.find((o) => /tail/i.test(o.name));
  const body =
    imported && bones.find((o) => /^(body|torso|hips|pelvis)$/i.test(o.name));
  const rear = tail || body;
  if (head && rear) {
    const d = head
      .getWorldPosition(new T.Vector3())
      .sub(rear.getWorldPosition(new T.Vector3()));
    model.rotation.y += Math.PI - Math.atan2(d.x, d.z);
  } else if (imported?.source === "Cubicle Studio" && imported.flight) {
    const beak = model.getObjectByName("Bico");
    const tail = model.getObjectByName("Cauda_branca");
    if (beak && tail) {
      const direction = new T.Box3()
        .setFromObject(beak)
        .getCenter(new T.Vector3())
        .sub(new T.Box3().setFromObject(tail).getCenter(new T.Vector3()));
      model.rotation.y += Math.PI - Math.atan2(direction.x, direction.z);
    }
  } else if (frontier) model.rotation.y += Math.PI;
  holder.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(model, true),
    size = box.getSize(new T.Vector3()),
    center = box.getCenter(new T.Vector3());
  const scale =
    ((imported?.size ??
      (name === "Green Dragon"
        ? 13
        : name === "Bloomtail"
          ? 1.75
          : name === "Sunplume"
            ? 1.05
            : name === "Rimehorn"
              ? 3.2
              : name === "Frostbite"
                ? 2.8
                : 2.1)) *
      (stage >= 2 ? 1.3 : 1)) /
    Math.max(size.x, size.y, size.z);
  model.position.sub(new T.Vector3(center.x, box.min.y, center.z));
  holder.scale.setScalar(scale);
  root.userData.source =
    imported?.source ??
    (isDinosaur || frontier ? "Quaternius" : "Supplied model");
  if (imported?.flight) root.userData.flight = imported.flight;
  if (name === "Green Dragon") {
    // Keep the planted pose. Only the two wing joints participate in this motion.
    const wings = bones
      .filter((b) => b.name === "wing1" || b.name === "wing-1")
      .map((bone) => ({
        bone,
        rest: bone.rotation.z,
        sign: bone.name === "wing1" ? -1 : 1,
      }));
    root.userData.perchedPose = (seconds: number) => {
      const phase = seconds % 180;
      const stretch =
        seconds >= 180 && phase < 4 ? Math.sin((Math.PI * phase) / 4) ** 2 : 0;
      for (const { bone, rest, sign } of wings)
        bone.rotation.z = rest + sign * 0.31 * stretch;
    };
    return true;
  }
  root.userData.playClip = (dt: number, speed: number, action: string) => {
    const preferred =
      action === "fly"
        ? "fly"
        : action === "attack"
          ? "attack"
          : action === "jump" || action === "victory"
            ? "jump"
            : speed > 1.15
              ? "run"
              : speed > 0.07
                ? "walk"
                : action === "eat"
                  ? "idle_eating"
                  : "idle";
    const alternate: Record<string, string> = {
      idle_eating: "idle_peck",
      attack: "headbutt",
      jump: "jump_start",
      run: "walk",
      walk: "run",
      hit: "hitrecieve",
    };
    const next =
      actions.get(
        action === "hit" && actions.has("hitrecieve")
          ? "hitrecieve"
          : preferred,
      ) ??
      actions.get(alternate[preferred]) ??
      actions.get("idle")!;
    if (next !== current) {
      next.reset().play();
      current.crossFadeTo(next, 0.18, false);
      current = next;
    }
    const stride =
      current === actions.get("walk") || current === actions.get("run");
    current.setEffectiveTimeScale(
      action === "fly"
        ? 1
        : stride
          ? T.MathUtils.clamp(speed * 1.45, 0.48, 1.65)
          : 1,
    );
    mixer.update(dt);
    holder.position.z =
      imported && action === "attack"
        ? -0.22 * Math.sin(Math.PI * Math.min(1, current.time / 0.6))
        : 0;
    holder.rotation.z =
      action === "hit" ? Math.sin(current.time * 18) * 0.12 : 0;
  };
  return true;
}
export async function loadWildlife(
  report: (done: number, total: number) => void,
) {
  const entries = Object.entries({ ...forms, ...animatedForms });
  let done = 0;
  await Promise.all(
    entries.map(async ([name, file]) => {
      if (!animatedAssets.has(name) && !library.has(name)) {
        const gltf = await new GLTFLoader()
          .setMeshoptDecoder(MeshoptDecoder)
          .loadAsync("/wildlife/" + file + ".glb");
        if (name in animatedForms) animatedAssets.set(name, gltf);
        else library.set(name, prepare(gltf.scene, importedBeast(name)?.size));
      }
      report(++done, entries.length);
    }),
  );
}
export function attachWildlife(body: T.Group, name: string, coat: T.Color) {
  const rig = library.get(name);
  if (!rig) return false;
  const geo = rig.geometry.clone(),
    colors = geo.getAttribute("color"),
    c = new T.Color();
  for (let i = 0; i < colors.count; i++) {
    c.fromBufferAttribute(colors, i);
    if (c.r + c.g + c.b > 0.08) c.lerp(coat, 0.21);
    colors.setXYZ(i, c.r, c.g, c.b);
  }
  const mesh = new T.SkinnedMesh(geo, material);
  const bones = rig.joints.map((j) => {
    const bone = new T.Bone();
    bone.name = j.name;
    bone.position.copy(j.origin);
    bone.userData.phase = j.phase;
    mesh.add(bone);
    return bone;
  });
  mesh.updateMatrixWorld(true);
  const skeleton = new T.Skeleton(bones);
  mesh.bind(skeleton);
  geo.addEventListener("dispose", () => skeleton.dispose());
  mesh.castShadow = mesh.receiveShadow = true;
  body.add(mesh);
  return true;
}
