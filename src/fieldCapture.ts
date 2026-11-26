import * as T from "three";
import { ground, cameraFloor } from "./world";
import { gameAudio } from "./audio";

export type OrbType = "standard" | "focus";
type Outcome = "caught" | "escaped";
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const unit = (v: number) => T.MathUtils.clamp(v, 0, 1);
const ease = (v: number) => T.MathUtils.smoothstep(v, 0, 1);

// Rotate the animated limb from its current world direction. Imported explorers
// use several different rest axes, so a local Euler angle is not portable.
function throwRig(ranger: T.Group) {
  const named = (...names: string[]) =>
    names.map((n) => ranger.getObjectByName(n)).find(Boolean);
  const arm = named("Right_Arm", "Right_Arm__parent", "RightArm_jnt", "arm");
  const forearm =
    arm &&
    (named("Right_Forearm", "Right_Forearm__parent", "RightForeArm_jnt") ??
      arm.getObjectByName("elbow"));
  const hand = named("Right_Hand", "RightHand_jnt");
  const chest = named("Chest", "Spine2_jnt", "body");
  const saved = new Map<T.Object3D, T.Quaternion>();
  const a = new T.Vector3(),
    b = new T.Vector3(),
    q = new T.Quaternion(),
    parentQ = new T.Quaternion();
  function aim(
    bone: T.Object3D,
    end: T.Vector3,
    direction: T.Vector3,
    weight: number,
  ) {
    bone.getWorldPosition(a);
    b.subVectors(end, a).normalize();
    q.setFromUnitVectors(b, direction.normalize());
    bone.parent!.getWorldQuaternion(parentQ);
    q.premultiply(parentQ.clone().invert())
      .multiply(parentQ)
      .multiply(bone.quaternion);
    saved.set(bone, bone.quaternion.clone());
    bone.quaternion.slerp(q, weight);
  }
  return {
    reset() {
      for (const [node, rotation] of saved) node.quaternion.copy(rotation);
      saved.clear();
    },
    pose(t: number, f: T.Vector3, side: T.Vector3, palm: T.Vector3) {
      const wind = ease(t / 0.29),
        release = ease((t - 0.29) / 0.14),
        recover = 1 - ease((t - 0.47) / 0.42);
      const weight = wind * recover;
      if (chest && weight) {
        saved.set(chest, chest.quaternion.clone());
        chest.rotateY((0.39 - 0.72 * release) * weight);
        chest.rotateX((-0.08 + 0.21 * release) * weight);
      }
      const wrist = () =>
        hand
          ? hand.getWorldPosition(palm)
          : forearm
            ? forearm.localToWorld(palm.set(0, -0.22, -0.02))
            : ranger.localToWorld(palm.set(0.34, 1.25, -0.12));
      if (arm && forearm && weight) {
        aim(
          arm,
          forearm.getWorldPosition(palm),
          f
            .clone()
            .multiplyScalar(-0.68 + 1.85 * release)
            .addScaledVector(side, 0.44)
            .setY(0.75 - 0.44 * release),
          weight,
        );
        aim(
          forearm,
          wrist(),
          f
            .clone()
            .multiplyScalar(-0.42 + 1.65 * release)
            .addScaledVector(side, 0.11)
            .setY(0.95 - 0.88 * release),
          weight,
        );
      }
      wrist();
    },
  };
}

export function createFieldCapture(scene: T.Scene, ranger: T.Group) {
  const rig = throwRig(ranger);
  const group = new T.Group(),
    orb = new T.Group();
  group.visible = false;
  scene.add(group);
  group.add(orb);
  const enamel = new T.MeshStandardMaterial({
    color: 0x32bc98,
    roughness: 0.26,
    metalness: 0.38,
    flatShading: true,
  });
  const gold = new T.MeshStandardMaterial({
    color: 0xeabf78,
    metalness: 0.62,
    roughness: 0.28,
    flatShading: true,
  });
  const base = new T.MeshStandardMaterial({
    color: 0x253e43,
    metalness: 0.45,
    roughness: 0.32,
    flatShading: true,
  });
  const glow = new T.MeshBasicMaterial({ color: 0xbaffd7, toneMapped: false });
  const r = 0.23;
  const cap = new T.Mesh(
    new T.SphereGeometry(r, 12, 5, 0, Math.PI * 2, 0, Math.PI * 0.46),
    enamel,
  );
  const hull = new T.Mesh(
    new T.SphereGeometry(
      r,
      12,
      5,
      0,
      Math.PI * 2,
      Math.PI * 0.53,
      Math.PI * 0.47,
    ),
    gold,
  );
  const band = new T.Mesh(new T.CylinderGeometry(r, r, 0.05, 12), base);
  orb.add(cap, hull, band);
  for (let i = 0; i < 4; i++) {
    const lamp = new T.Mesh(new T.BoxGeometry(0.072, 0.067, 0.031), glow);
    const angle = (i * Math.PI) / 2;
    lamp.position.set(Math.sin(angle) * r, 0, Math.cos(angle) * r);
    lamp.rotation.y = angle;
    orb.add(lamp);
  }
  orb.traverse((n) => {
    n.castShadow = true;
  });
  const trailMat = new T.MeshBasicMaterial({
    color: 0x8bffcd,
    transparent: true,
    opacity: 0.83,
    depthWrite: false,
  });
  const trail = new T.InstancedMesh(
    new T.OctahedronGeometry(0.072),
    trailMat,
    12,
  );
  const ringMat = new T.MeshBasicMaterial({
    color: 0xa8ffbf,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const ring = new T.Mesh(new T.RingGeometry(0.82, 0.86, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  const spark = new T.InstancedMesh(
    new T.BoxGeometry(0.075, 0.075, 0.075),
    glow,
    16,
  );
  const marker = new T.Mesh(new T.OctahedronGeometry(0.105), glow);
  trail.frustumCulled = spark.frustumCulled = false;
  group.add(trail, ring, spark, marker);
  const point = new T.Object3D(),
    start = new T.Vector3(),
    end = new T.Vector3(),
    palm = new T.Vector3(),
    f = new T.Vector3(),
    side = new T.Vector3(),
    originalScale = new T.Vector3(),
    look = new T.Vector3(),
    viewPos = new T.Vector3();
  let beast: T.Group | undefined,
    index = -1,
    time = -1,
    releaseSet = false,
    result: Outcome | undefined,
    finish: (() => void) | undefined,
    burstAt = -1,
    height = 1;
  function color(type: OrbType, aurora = false) {
    const focus = type === "focus";
    enamel.color.setHex(aurora ? 0xe073b8 : focus ? 0x8966ee : 0x20af91);
    gold.color.setHex(focus ? 0x9bc3ef : 0xebbc70);
    glow.color.setHex(focus ? 0xf3caff : 0xcbffc3);
    trailMat.color.setHex(aurora ? 0x67fff2 : focus ? 0xc49bff : 0x84ffce);
    ringMat.color.copy(trailMat.color);
  }
  function stop() {
    rig.reset();
    if (beast) beast.scale.copy(originalScale);
    beast = undefined;
    index = -1;
    group.visible = false;
    time = -1;
    finish = undefined;
    result = undefined;
  }
  function path(t: number, out: T.Vector3) {
    out.lerpVectors(start, end, t);
    out.y += 4 * t * (1 - t) * (0.43 + start.distanceTo(end) * 0.19);
    return out;
  }
  return {
    get index() {
      return index;
    },
    get casting() {
      return time >= 0;
    },
    color,
    stop,
    focus(i: number, m: T.Group) {
      if (index === i) return;
      stop();
      index = i;
      beast = m;
      originalScale.copy(m.scale);
      height = T.MathUtils.clamp(
        new T.Box3().setFromObject(m).getSize(end).y,
        0.3,
        3,
      );
      f.subVectors(m.position, ranger.position).setY(0).normalize();
      if (!f.lengthSq()) f.set(0, 0, -1);
      side.set(-f.z, 0, f.x);
      ranger.rotation.y = Math.atan2(-f.x, -f.z);
      m.rotation.y = Math.atan2(f.x, f.z);
      group.visible = ring.visible = true;
      marker.visible = orb.visible = true;
      cap.position.y = 0;
      orb.rotation.set(0, 0, 0);
      marker.position.copy(m.position);
      marker.position.y += height + 0.36;
      trail.visible = spark.visible = false;
      ring.scale.setScalar(0.85);
      ringMat.opacity = 0.8;
      ring.position.copy(m.position);
      ring.position.y = ground(m.position.x, m.position.z) + 0.045;
    },
    launch(type: OrbType, aurora = false) {
      if (!beast || time >= 0) return;
      color(type, aurora);
      time = 0;
      releaseSet = false;
      result = undefined;
      burstAt = -1;
      end.copy(beast.position);
      end.y += height * 0.55;
      orb.rotation.set(0, 0, 0);
      orb.visible = true;
    },
    resolve(outcome: Outcome, done: () => void) {
      result = outcome;
      finish = done;
    },
    resetRig: rig.reset,
    camera(camera: T.PerspectiveCamera, dt: number) {
      if (!beast) return;
      const distance = ranger.position.distanceTo(beast.position);
      look.lerpVectors(ranger.position, beast.position, 0.53);
      look.y += Math.max(1, height * 0.47);
      viewPos
        .copy(look)
        .addScaledVector(side, Math.max(3.25, distance * 0.82))
        .addScaledVector(f, -Math.max(2.3, distance * 0.57));
      viewPos.y += 1.3 + distance * 0.11;
      viewPos.y = Math.max(viewPos.y, cameraFloor(viewPos.x, viewPos.z) + 0.65);
      camera.position.lerp(
        viewPos,
        reduced.matches ? 1 : 1 - Math.exp(-dt * 7),
      );
      camera.lookAt(look);
    },
    update(dt: number) {
      if (!beast) return;
      if (time < 0) {
        rig.pose(0, f, side, palm);
        orb.position.copy(palm);
        return;
      }
      const previous = time;
      time += dt * (reduced.matches ? 2.4 : 1);
      if (previous < 0.43 && time >= 0.43) gameAudio.play("throw");
      if (previous < 1 && time >= 1) gameAudio.play("orbContact");
      if (previous < 1.9 && time >= 1.9) gameAudio.play("orbLatch");
      rig.pose(time, f, side, palm);
      const flight = unit((time - 0.43) / 0.57);
      if (!releaseSet) {
        start.copy(palm);
        releaseSet = time >= 0.43;
      }
      path(flight, orb.position);
      orb.rotation.x = flight * Math.PI * 3;
      trail.visible = flight > 0 && flight < 1 && !reduced.matches;
      if (trail.visible) {
        for (let i = 0; i < trail.count; i++) {
          path(Math.max(0, flight - i * 0.021), point.position);
          point.scale.setScalar(1 - i / trail.count);
          point.updateMatrix();
          trail.setMatrixAt(i, point.matrix);
        }
        trail.instanceMatrix.needsUpdate = true;
      }
      if (time < 1) return;
      marker.visible = false;
      const absorb = ease((time - 1) / 0.32);
      const floor = ground(end.x, end.z) + r;
      orb.position.y = T.MathUtils.lerp(
        end.y,
        floor,
        ease((time - 1.14) / 0.45),
      );
      orb.position.y +=
        Math.abs(Math.sin(unit((time - 1.59) / 0.35) * Math.PI)) * 0.11;
      beast.scale
        .copy(originalScale)
        .multiplyScalar(Math.max(0.001, 1 - absorb));
      if (absorb < 1 && !reduced.matches) {
        spark.visible = true;
        for (let i = 0; i < spark.count; i++) {
          const a = i * 2.4 + absorb * 2.8,
            size = (1 - absorb) * (0.45 + height * 0.28);
          point.position.copy(end);
          point.position.x += size * Math.cos(a);
          point.position.z += size * Math.sin(a);
          point.position.y += size * Math.sin(i * 0.87);
          point.scale.setScalar(1.2 - absorb * 0.7);
          point.updateMatrix();
          spark.setMatrixAt(i, point.matrix);
        }
        spark.instanceMatrix.needsUpdate = true;
      } else spark.visible = false;
      cap.position.y = 0.1 * Math.sin(absorb * Math.PI);
      const shake = unit((time - 1.69) / 0.68);
      orb.rotation.z = reduced.matches
        ? 0
        : 0.31 * Math.sin(shake * Math.PI * 4) * Math.sin(shake * Math.PI);
      ring.scale.setScalar(0.85 + absorb * 0.6);
      ringMat.opacity = 0.7 * (1 - absorb);
      if (time < 2.38 || !result) return;
      if (burstAt < 0) burstAt = time;
      const burst = unit((time - burstAt) / 0.49);
      if (result === "escaped")
        beast.scale
          .copy(originalScale)
          .multiplyScalar(Math.max(0.001, ease(burst)));
      ringMat.color.setHex(result === "caught" ? 0xffda74 : 0xabeaff);
      ringMat.opacity = 0.8 * (1 - burst);
      ring.scale.setScalar(0.4 + burst * 1.2);
      spark.visible = !reduced.matches;
      for (let i = 0; i < spark.count; i++) {
        const a = i * 2.39996,
          radius = 0.17 + burst * (0.55 + (i % 3) * 0.16);
        point.position.set(
          end.x + Math.cos(a) * radius,
          floor +
            (0.2 + (i % 5) * 0.13) * Math.sin(burst * Math.PI) +
            burst * 0.3,
          end.z + Math.sin(a) * radius,
        );
        point.scale.setScalar(1.5 * (1 - burst));
        point.updateMatrix();
        spark.setMatrixAt(i, point.matrix);
      }
      spark.instanceMatrix.needsUpdate = true;
      if (burst === 1) {
        const callback = finish;
        stop();
        callback?.();
      }
    },
  };
}
