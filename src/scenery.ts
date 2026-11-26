import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { VOXLoader, VOXMesh } from "three/examples/jsm/loaders/VOXLoader.js";
import { destinations, destinationInk, type Destination } from "./destinations";
import { fixtures } from "./fixtures";
import { ground, islandPlants } from "./world";

const textured = new Set([
  "market",
  "produce",
  "bench",
  "rune",
  "berries",
  "flowers-1",
  "flowers-2",
  "coast-palm",
  "coast-ferns",
]);
async function loadModel(name: string) {
  const base = "/scenery/" + name;
  if (["farm", "Birch", "Oak", "Hazel", "Spruce"].includes(name)) {
    const chunks = await new VOXLoader().loadAsync(base + ".vox");
    const voxel = new VOXMesh(chunks[0]);
    return new T.Mesh(voxel.geometry, voxel.material);
  }
  if (!textured.has(name))
    return (await new GLTFLoader().loadAsync(base + ".glb")).scene;
  const [model, palette] = await Promise.all([
    new OBJLoader().loadAsync(base + ".obj"),
    new T.TextureLoader().loadAsync(base + ".png"),
  ]);
  palette.colorSpace = T.SRGBColorSpace;
  palette.magFilter = T.NearestFilter;
  palette.minFilter = T.NearestFilter;
  palette.generateMipmaps = false;
  const material = new T.MeshStandardMaterial({ map: palette, roughness: 0.9 });
  model.traverse((node) => {
    if (node instanceof T.Mesh) node.material = material;
  });
  return model;
}
const loaded = new Map<string, Promise<T.Object3D>>();
export function cached(name: string) {
  let result = loaded.get(name);
  if (!result) {
    result = loadModel(name).catch((error) => {
      loaded.delete(name);
      throw error;
    });
    loaded.set(name, result);
  }
  return result;
}

export async function preloadScenery(
  report: (done: number, total: number) => void,
) {
  const names = new Set([
    ...fixtures.map((f) => f.model),
    ...islandPlants().map((p) => p.model),
  ]);
  let done = 0;
  await Promise.all(
    Array.from(names, async (name) => {
      await cached(name);
      report(++done, names.size);
    }),
  );
}
function destinationSign(place: Destination) {
  const ink = destinationInk[place.kind];
  const face = document.createElement("canvas");
  face.width = 256; face.height = 68;
  const ctx = face.getContext("2d")!;
  ctx.fillStyle = "#32281f"; ctx.fillRect(0, 0, 256, 68);
  ctx.fillStyle = ink.color; ctx.fillRect(3, 3, 250, 62);
  ctx.fillStyle = "#233b32"; ctx.fillRect(6, 6, 244, 56);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = ink.color; ctx.font = 'bold 31px "Pixelify Sans", monospace';
  ctx.fillText(place.name.toUpperCase(), 128, 35, 230);
  const texture = new T.CanvasTexture(face);
  texture.colorSpace = T.SRGBColorSpace;
  texture.magFilter = T.NearestFilter;
  const wood = new T.MeshStandardMaterial({color: 0x583e2c});
  const lettered = new T.MeshBasicMaterial({map:texture});
  const group = new T.Group();
  const board = new T.Mesh(new T.BoxGeometry(3.6, 0.96, 0.16),
    [wood, wood, wood, wood, lettered, lettered]);
  board.position.y = 3.25;
  group.add(board);
  for (const x of [-1.52, 1.52]) {
    const post = new T.Mesh(new T.BoxGeometry(.14, 3.8, .14), wood);
    post.position.set(x, 1.85, -.1); group.add(post);
  }
  group.position.set(place.x, ground(place.x, place.z), place.z + 1);
  return group;
}
export function placeScenery(scene: T.Scene) {
  for (const site of destinations) scene.add(destinationSign(site));
  const waiting = new Set(fixtures);
  // One instanced draw per source primitive per grove; repeated trees share geometry and materials.
  const groves = new Map<string, ReturnType<typeof islandPlants>>();
  for (const p of islandPlants()) {
    const key =
      p.model + "/" + Math.floor(p.x / 24) + "/" + Math.floor(p.z / 24);
    const group = groves.get(key) ?? [];
    group.push(p);
    groves.set(key, group);
  }
  const groveBatches: { cx: number; cz: number; root: T.Group }[] = [];
  let last = -1;
  return (time: number, position: T.Vector3) => {
    if (time - last < 0.5) return;
    last = time;
    for (const batch of groveBatches)
      batch.root.visible =
        Math.hypot(position.x - batch.cx, position.z - batch.cz) < 68;
    for (const [key, plants] of groves) {
      const [name, tx, tz] = key.split("/"),
        cx = Number(tx) * 24 + 12,
        cz = Number(tz) * 24 + 12;
      if (Math.hypot(position.x - cx, position.z - cz) > 65) continue;
      groves.delete(key);
      void cached(name)
        .then((model) => {
          model.updateMatrixWorld(true);
          const bounds = new T.Box3().setFromObject(model),
            center = bounds.getCenter(new T.Vector3()),
            size = bounds.getSize(new T.Vector3());
          const offset = new T.Matrix4().makeTranslation(
            -center.x,
            -bounds.min.y,
            -center.z,
          );
          const root = new T.Group();
          root.name = "Grove " + key;
          model.traverse((mesh) => {
            if (!(mesh instanceof T.Mesh)) return;
            const batch = new T.InstancedMesh(
                mesh.geometry,
                mesh.material,
                plants.length,
              ),
              transform = new T.Object3D();
            plants.forEach((p, i) => {
              transform.position.set(p.x, p.y - 0.03, p.z);
              transform.rotation.y = p.yaw;
              transform.scale.setScalar(
                p.size / Math.max(size.x, size.y, size.z),
              );
              transform.updateMatrix();
              batch.setMatrixAt(
                i,
                transform.matrix
                  .clone()
                  .multiply(offset)
                  .multiply(mesh.matrixWorld),
              );
            });
            batch.receiveShadow = batch.castShadow = true;
            batch.computeBoundingSphere();
            root.add(batch);
          });
          groveBatches.push({ cx, cz, root });
          scene.add(root);
        })
        .catch((e) => console.error("Grove load failed", name, e));
    }
    for (const f of waiting) {
      if (Math.hypot(f.x - position.x, f.z - position.z) > 46) continue;
      waiting.delete(f);
      void cached(f.model)
        .then((original) => {
          const model = original.clone(true),
            holder = new T.Group();
          holder.add(model);
          const bounds = new T.Box3().setFromObject(model),
            size = bounds.getSize(new T.Vector3()),
            center = bounds.getCenter(new T.Vector3());
          model.position.sub(new T.Vector3(center.x, bounds.min.y, center.z));
          holder.scale.setScalar(f.size / Math.max(size.x, size.y, size.z));
          holder.rotation.y = f.yaw;
          holder.position.set(f.x, ground(f.x, f.z) - 0.018, f.z);
          holder.name = f.model;
          model.traverse((node) => {
            if (node instanceof T.Mesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });
          scene.add(holder);
        })
        .catch((error) =>
          console.error("Scenery load failed:", f.model, error),
        );
    }
  };
}
