import * as T from "three";
import { ground } from "./world";

// Voxel coals stay fixed while flames and buoyant sparks share one instanced mesh.
export function campfire(scene: T.Scene, x: number, z: number) {
  const y = ground(x, z),
    geometry = new T.BoxGeometry(),
    matrix = new T.Object3D();
  const stones = new T.InstancedMesh(
    geometry,
    new T.MeshStandardMaterial({ roughness: 0.95 }),
    12,
  );
  const glow = new T.InstancedMesh(geometry, new T.MeshBasicMaterial(), 30);
  const lamp = new T.PointLight(0xffa24d, 5, 7);
  lamp.position.set(x, y + 0.65, z);
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4;
    matrix.position.set(
      x + Math.cos(a) * 0.52,
      y + 0.09,
      z + Math.sin(a) * 0.52,
    );
    matrix.scale.set(0.25, 0.17 + (i % 3) * 0.032, 0.25);
    matrix.rotation.y = a;
    matrix.updateMatrix();
    stones.setMatrixAt(i, matrix.matrix);
    stones.setColorAt(i, new T.Color(i % 2 ? 0x51483c : 0x6e665b));
  }
  for (let i = 0; i < 30; i++)
    glow.setColorAt(i, new T.Color([0xff8529, 0xffbc54, 0xffdf8c][i % 3]));
  scene.add(stones, glow, lamp);
  glow.frustumCulled = false;
  return (time: number) => {
    for (let i = 0; i < 30; i++) {
      const p = (time * (0.69 + (i % 5) * 0.07) + i * 0.618) % 1,
        a = i * 2.4,
        ember = i >= 22;
      const r = (0.11 + 0.025 * (i % 7)) * (1 - p * 0.5),
        height = ember ? 0.042 : 0.31 - 0.23 * p;
      matrix.position.set(
        x + Math.cos(a) * r + p * p * 0.17,
        y + 0.08 + p * (ember ? 1.45 : 0.72),
        z + Math.sin(a) * r,
      );
      matrix.rotation.set(0, a, Math.sin(a + time) * p * 0.18);
      matrix.scale.setScalar(ember ? 0.032 * (1 - p) : 0.14 * (1 - p) + 0.025);
      matrix.scale.y = height;
      matrix.updateMatrix();
      glow.setMatrixAt(i, matrix.matrix);
    }
    glow.instanceMatrix.needsUpdate = true;
    lamp.intensity =
      4.2 + 0.5 * Math.sin(time * 8.7) + 0.24 * Math.sin(time * 19);
  };
}
