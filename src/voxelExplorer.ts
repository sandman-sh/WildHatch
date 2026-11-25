import { AnimationMixer, Box3, Group, LoopOnce, Mesh, Vector3 } from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneRig } from "three/examples/jsm/utils/SkeletonUtils.js";

import { rangerFor } from "./rangers";

const avatars = new Map<string, GLTF>();
const pending = new Map<string, Promise<void>>();
export function hasExplorer(index: number) {
  return avatars.has(rangerFor(index).file);
}
export async function loadExplorer(index: number) {
  const file = rangerFor(index).file;
  const cached = avatars.get(file);
  if (cached) {
    avatars.delete(file);
    avatars.set(file, cached);
    return;
  }
  let request = pending.get(file);
  if (!request) {
    request = new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .loadAsync("/explorers/" + file + ".glb")
      .then((asset) => {
        avatars.set(file, asset);
        if (avatars.size > 12) avatars.delete(avatars.keys().next().value!);
      })
      .finally(() => pending.delete(file));
    pending.set(file, request);
  }
  return request;
}
export function makeVoxelExplorer(index: number) {
  const ranger = rangerFor(index);
  const avatar = avatars.get(ranger.file);
  if (!avatar) throw new Error("Explorer asset is still loading");
  const root = new Group(),
    model = cloneRig(avatar.scene);
  model.traverse((node) => {
    if (node instanceof Mesh) {
      node.geometry = node.geometry.clone();
      node.castShadow = node.receiveShadow = true;
    }
  });
  const mixer = new AnimationMixer(model);
  const actions = new Map(
    avatar.animations.map((clip) => [clip.name, mixer.clipAction(clip)]),
  );
  let active = actions.get("Idle 01")!;
  active.play();
  mixer.update(0);
  const jump = actions.get("Jump 01")!;
  jump.setLoop(LoopOnce, 1);
  jump.clampWhenFinished = true;
  // WildHatch rigs face -Z. Older rigid-part exports need a half turn.
  if (!ranger.facesForward && !model.getObjectByProperty("type", "SkinnedMesh"))
    model.rotation.y = Math.PI;
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model, true),
    size = bounds.getSize(new Vector3()),
    center = bounds.getCenter(new Vector3());
  model.position.sub(new Vector3(center.x, bounds.min.y, center.z));
  root.add(model);
  root.scale.setScalar(2 / size.y);
  root.userData.kind = -1;
  root.userData.ranger = ranger.id;
  root.userData.playClip = (dt: number, speed: number, pose: string) => {
    const name =
      pose === "swim"
        ? "Swim Normal 01"
        : pose === "jump"
          ? "Jump 01"
          : speed > 1.4
            ? "Sprint 01"
            : speed > 0.85
              ? "Run 01"
              : speed > 0.08
                ? "Walk 01"
                : "Idle 01";
    const next = actions.get(name)!;
    if (next !== active) {
      const locomotion = (clip: string) => /^(Walk|Run|Sprint)/.test(clip);
      const from = active.getClip(),
        to = next.getClip();
      const gaitPhase =
        locomotion(from.name) && locomotion(to.name)
          ? (active.time / from.duration) % 1
          : 0;
      next.reset().play();
      next.time = gaitPhase * to.duration;
      active.crossFadeTo(next, 0.14, false);
      active = next;
    }
    const cadence =
      name === "Walk 01"
        ? Math.min(1.22, 0.7 + speed * 0.65)
        : name === "Run 01"
          ? Math.min(1.22, 0.8 + speed * 0.2)
          : name === "Sprint 01"
            ? 0.96 + Math.max(0, speed - 1.4) * 0.32
            : 1;
    active.setEffectiveTimeScale(cadence);
    mixer.update(dt);
  };
  return root;
}
