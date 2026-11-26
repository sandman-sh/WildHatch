import * as THREE from "three";
import { createIslandMaterials, surfaceFor } from "./world-materials.ts";
import { dragonPerch, layout, noise, WATER, type Part } from "./worldTerrain.ts";
export * from "./worldTerrain.ts";
export function buildWorld(scene: THREE.Scene) {
  const { chunks, waterChunks, glowChunks, fallsX, fallsZ, fallsHeight } =
    layout();
  const lod: { mesh: THREE.InstancedMesh; x: number; z: number }[] = [];
  let ocean: THREE.InstancedMesh | undefined;
  const root = new THREE.Group();
  root.name = "Wildreach Island";
  scene.add(root);
  const geometry = new THREE.BoxGeometry();
  const surfaces = createIslandMaterials();
  const chunkGeometries: THREE.BufferGeometry[] = [];
  const glowMaterial = new THREE.MeshBasicMaterial();
  const matrix = new THREE.Object3D(),
    color = new THREE.Color();
  function bake(
    set: Map<string, Part[]>,
    mat: THREE.Material,
    shadows: boolean,
  ) {
    for (const [id, parts] of set) {
      // Per-instance material IDs preserve one draw per chunk across every land surface.
      let chunkGeometry: THREE.BufferGeometry = geometry;
      if (mat === surfaces.land) {
        chunkGeometry = new THREE.BufferGeometry();
        chunkGeometry.setIndex(geometry.index);
        for (const [name, attribute] of Object.entries(geometry.attributes))
          chunkGeometry.setAttribute(name, attribute);
        const kinds = Float32Array.from(parts, (part) => surfaceFor(part[6]));
        chunkGeometry.setAttribute(
          "surfaceKind",
          new THREE.InstancedBufferAttribute(kinds, 1),
        );
        chunkGeometries.push(chunkGeometry);
      }
      const mesh = new THREE.InstancedMesh(chunkGeometry, mat, parts.length);
      mesh.name = "Landscape " + id;
      parts.forEach(([x, y, z, w, h, d, c, r], index) => {
        matrix.position.set(x, y, z);
        matrix.scale.set(w, h, d);
        matrix.rotation.y = r;
        matrix.updateMatrix();
        mesh.setMatrixAt(index, matrix.matrix);
        mesh.setColorAt(index, color.setHex(c));
      });
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      root.add(mesh);
      if (parts.some((p) => p[3] > 800)) ocean = mesh;
      const [cx, cz] = id.split(",").map(Number);
      if (
        !parts.some((p) => p[3] > 200) &&
        Math.hypot(cx * 20 + 10 - dragonPerch.x, cz * 20 + 10 - dragonPerch.z) >
          25
      )
        lod.push({ mesh, x: cx * 20 + 10, z: cz * 20 + 10 });
    }
  }
  bake(chunks, surfaces.land, true);
  bake(waterChunks, surfaces.water, false);
  bake(glowChunks, surfaces.lava, false);
  const spray = new THREE.InstancedMesh(geometry, glowMaterial, 18);
  spray.name = "Waterfall spray";
  spray.frustumCulled = false;
  root.add(spray);
  for (let k = 0; k < spray.count; k++)
    spray.setColorAt(k, color.setHex(k % 2 ? 0xdbf6ef : 0xa7e4e1));
  let lastCull = -1;
  function update(time: number, player?: THREE.Vector3, quality = "High") {
    if (player && time - lastCull > 0.28) {
      lastCull = time;
      if (ocean)
        ocean.position.set(
          Math.round(player.x / 128) * 128,
          0,
          Math.round(player.z / 128) * 128,
        );
      const radius =
        quality === "Low"
          ? 43
          : quality === "Medium"
            ? 62
            : quality === "Ultra"
              ? 120
              : 86;
      for (const batch of lod)
        batch.mesh.visible =
          (batch.x - player.x) ** 2 + (batch.z - player.z) ** 2 <
          (radius + 14) ** 2;
    }
    surfaces.update(time);
    for (let k = 0; k < spray.count; k++) {
      const phase = (k * 0.618 + time * 0.76) % 1;
      matrix.rotation.set(0, 0, 0);
      matrix.position.set(
        fallsX + (noise(k, 3) - 0.5) * 3.1,
        WATER + (1 - phase * phase) * fallsHeight,
        fallsZ + 0.13 + phase * 0.47,
      );
      matrix.scale.set(0.06, 0.17 + phase * 0.2, 0.09);
      matrix.updateMatrix();
      spray.setMatrixAt(k, matrix.matrix);
    }
    spray.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return {
    update,
    dispose() {
      root.traverse((object) => {
        if (object instanceof THREE.InstancedMesh) object.dispose();
      });
      scene.remove(root);
      geometry.dispose();
      for (const chunkGeometry of chunkGeometries) chunkGeometry.dispose();
      surfaces.dispose();
      glowMaterial.dispose();
    },
  };
}
