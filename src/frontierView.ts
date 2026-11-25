import * as T from "three";
import { cached } from "./scenery";
import {
  frontierAt,
  frontierHeight,
  sectorAt,
  sector,
  sectorProps,
  sample,
  type Prop,
} from "./frontier";

const width = 32;
const material = new T.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.94,
  flatShading: true,
});
const color = new T.Color();
function terrain(tx: number, tz: number) {
  const group = new T.Group();
  group.name = "Frontier " + tx + "," + tz;
  const x0 = tx * width,
    z0 = tz * width;
  group.position.set(x0, 0, z0);
  const region = sector(sectorAt(x0 + 16), sectorAt(z0 + 16));
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const stride = width + 2,
    heights = new Float32Array(stride * stride);
  for (let z = -1; z <= width; z++)
    for (let x = -1; x <= width; x++)
      heights[(z + 1) * stride + x + 1] = frontierHeight(
        x0 + x + 0.5,
        z0 + z + 0.5,
      );
  function quad(vertices: number[]) {
    const i = positions.length / 3;
    positions.push(...vertices);
    indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
    for (let n = 0; n < 4; n++) colors.push(color.r, color.g, color.b);
  }
  for (let z = 0; z < width; z++)
    for (let x = 0; x < width; x++) {
      const i = (z + 1) * stride + x + 1,
        h = heights[i];
      if (h < -0.18) continue;
      const tint =
        0.91 +
        sample(x + x0, z + z0, 8) * 0.1 +
        0.055 * Math.sin((x + x0) * 0.18 + (z + z0) * 0.12);
      color.setHex(h < 0.65 ? 0xd9c593 : region.range.top).multiplyScalar(tint);
      quad([x, h, z + 1, x + 1, h, z + 1, x + 1, h, z, x, h, z]);
      color.setHex(region.range.rock).multiplyScalar(tint);
      const east = heights[i + 1],
        west = heights[i - 1],
        north = heights[i - stride],
        south = heights[i + stride];
      if (east < h)
        quad([
          x + 1,
          h,
          z + 1,
          x + 1,
          east,
          z + 1,
          x + 1,
          east,
          z,
          x + 1,
          h,
          z,
        ]);
      if (west < h) quad([x, h, z, x, west, z, x, west, z + 1, x, h, z + 1]);
      if (north < h) quad([x + 1, h, z, x + 1, north, z, x, north, z, x, h, z]);
      if (south < h)
        quad([
          x,
          h,
          z + 1,
          x,
          south,
          z + 1,
          x + 1,
          south,
          z + 1,
          x + 1,
          h,
          z + 1,
        ]);
    }
  if (positions.length) {
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new T.Mesh(geo, material);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
function decorate(group: T.Group, active: () => boolean) {
  const { x, z } = group.position,
    byModel = new Map<string, Prop[]>();
  for (const p of sectorProps(sectorAt(x + 16), sectorAt(z + 16))) {
    if (
      Math.floor(p.x / width) !== x / width ||
      Math.floor(p.z / width) !== z / width
    )
      continue;
    const list = byModel.get(p.model) ?? [];
    list.push(p);
    byModel.set(p.model, list);
  }
  for (const [name, instances] of byModel)
    void cached(name)
      .then((model) => {
        if (!active()) return;
        model.updateMatrixWorld(true);
        const box = new T.Box3().setFromObject(model),
          c = box.getCenter(new T.Vector3()),
          size = box.getSize(new T.Vector3());
        const offset = new T.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z),
          pose = new T.Object3D(),
          matrix = new T.Matrix4();
        model.traverse((mesh) => {
          if (!(mesh instanceof T.Mesh)) return;
          const batch = new T.InstancedMesh(
            mesh.geometry,
            mesh.material,
            instances.length,
          );
          batch.name = name;
          for (const [i, p] of instances.entries()) {
            pose.position.set(
              p.x - x,
              Math.max(
                -0.16,
                frontierHeight(Math.floor(p.x) + 0.5, Math.floor(p.z) + 0.5),
              ),
              p.z - z,
            );
            pose.rotation.y = p.yaw;
            pose.scale.setScalar(p.height / Math.max(size.x, size.y, size.z));
            pose.updateMatrix();
            batch.setMatrixAt(
              i,
              matrix
                .copy(pose.matrix)
                .multiply(offset)
                .multiply(mesh.matrixWorld),
            );
          }
          batch.castShadow = batch.receiveShadow = true;
          group.add(batch);
        });
      })
      .catch((error) => console.error("Frontier prop failed", name, error));
}
export function streamFrontier(scene: T.Scene) {
  const live = new Map<string, T.Group>();
  let previous = "",
    queue: [number, number][] = [];
  return (x: number, z: number, quality: string) => {
    const tx = Math.floor(x / width),
      tz = Math.floor(z / width),
      radius = quality === "Low" ? 2 : 3,
      key = [tx, tz, radius].join(",");
    if (previous !== key) {
      previous = key;
      queue = [];
      const wanted = new Set<string>();
      for (let a = tx - radius; a <= tx + radius; a++)
        for (let b = tz - radius; b <= tz + radius; b++) {
          if (!frontierAt((a + 0.5) * width, (b + 0.5) * width)) continue;
          const id = a + "," + b;
          wanted.add(id);
          if (!live.has(id)) queue.push([a, b]);
        }
      queue.sort(
        ([a, b], [c, d]) =>
          Math.hypot(a - tx, b - tz) - Math.hypot(c - tx, d - tz),
      );
      for (const [id, group] of live)
        if (!wanted.has(id)) {
          live.delete(id);
          scene.remove(group);
          for (const mesh of group.children) {
            if (mesh instanceof T.InstancedMesh) mesh.dispose();
            else if (mesh instanceof T.Mesh) mesh.geometry.dispose();
          }
        }
    }
    for (let i = 0; i < 2 && queue.length; i++) {
      const [a, b] = queue.shift()!,
        id = a + "," + b,
        group = terrain(a, b);
      live.set(id, group);
      scene.add(group);
      decorate(group, () => live.get(id) === group);
    }
  };
}
