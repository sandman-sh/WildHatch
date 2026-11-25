import * as THREE from "three";

const SURFACE = {
  stone: 0,
  meadow: 1,
  needle: 2,
  bark: 3,
  plank: 4,
  soil: 5,
  sand: 6,
  snow: 7,
  gem: 8,
  copper: 9,
  cloud: 10,
} as const;
const surfaceByColor = new Map<number, number>();
const register = (surface: number, colors: number[]) => {
  for (const color of colors) surfaceByColor.set(color, surface);
};
register(
  SURFACE.meadow,
  [
    0x8caf58, 0x8db057, 0x85aa54, 0x91b45d, 0x85aa53, 0x9cb964, 0x98b560,
    0x9ebd67, 0x9bb961, 0x7e9a60, 0xa4a993,
  ],
);
register(
  SURFACE.needle,
  [
    0x386767, 0x427875, 0x548982, 0x2c6450, 0x397451, 0x508659, 0x51834b,
    0x669f56, 0x7fab5b, 0x9dbd68, 0x437a4c, 0x558a49, 0x689c50, 0x82ac58,
    0x529264, 0x608549, 0x577e47, 0x80a75a,
  ],
);
register(SURFACE.bark, [0x70553d, 0x77563c, 0x8a6c47]);
register(
  SURFACE.plank,
  [
    0xd7bd8c, 0x694f3b, 0x615947, 0x866548, 0xa58760, 0xb19569, 0x81684e,
    0xaf936a,
  ],
);
register(SURFACE.soil, [0xc5ab76, 0xc9ad7a, 0xd1b982, 0x978763]);
register(
  SURFACE.sand,
  [0xe8ca87, 0xe1c28c, 0xedcf98, 0xe6c994, 0xc4bc84, 0xbba879],
);
register(SURFACE.snow, [0xe7f2ea, 0xd7e8e4, 0xe9f4ee, 0xd6e7ec, 0xe3f0e6]);
register(
  SURFACE.gem,
  [0x3c9ba3, 0x72dfd4, 0xb0f2e6, 0x735aa6, 0xb88bd6, 0xe6bcfa, 0x487b80],
);
register(SURFACE.copper, [0xa96444, 0xb87750]);
register(SURFACE.cloud, [0xf9f5dc, 0x8ad1cb, 0xa4e4dc, 0x79c9cc, 0xc6ede1]);
export const surfaceFor = (color: number) =>
  surfaceByColor.get(color) ?? SURFACE.stone;

function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x + seed, 0x45d9f3b) ^ Math.imul(y + seed, 0x119de1f3);
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2d);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

// Periodic cells keep all tile boundaries seamless, including generated mip levels.
function grain(u: number, v: number, nx: number, ny: number, seed: number) {
  const px = u * nx,
    py = v * ny;
  const x = Math.floor(px),
    y = Math.floor(py);
  const fx = px - x,
    fy = py - y;
  const ax = fx * fx * (3 - 2 * fx),
    ay = fy * fy * (3 - 2 * fy);
  const sx = ((x % nx) + nx) % nx,
    sy = ((y % ny) + ny) % ny;
  const a = hash(sx, sy, seed),
    b = hash((sx + 1) % nx, sy, seed);
  const c = hash(sx, (sy + 1) % ny, seed),
    d = hash((sx + 1) % nx, (sy + 1) % ny, seed);
  return (a + (b - a) * ax) * (1 - ay) + (c + (d - c) * ax) * ay;
}

function makeSurfaceAtlas() {
  const resolution = 96,
    layers = 11,
    pixels = new Uint8Array(resolution * resolution * 4 * layers);
  for (let type = 0; type < layers; type++) {
    for (let y = 0; y < resolution; y++)
      for (let x = 0; x < resolution; x++) {
        const u = x / resolution,
          v = y / resolution;
        const broad = grain(u, v, 4, 4, 33),
          fine = grain(u, v, 28, 28, 61);
        const fleck = hash(x, y, type + 1);
        let value = 0.5,
          rough = 0.9;
        switch (type) {
          case SURFACE.stone: {
            const stratum = grain(u, v, 3, 16, 18);
            const seam = Math.max(0, 0.13 - Math.abs(stratum - 0.45)) * 1.4;
            value = 0.13 + broad * 0.36 + stratum * 0.31 + fine * 0.21 - seam;
            rough = 0.74 + fine * 0.23;
            break;
          }
          case SURFACE.meadow: {
            const blades = grain(u, v, 36, 16, 29);
            const clover = grain(u, v, 13, 11, 37);
            value =
              0.05 +
              broad * 0.38 +
              blades * 0.35 +
              clover * 0.24 +
              (fleck > 0.97 ? 0.16 : 0);
            break;
          }
          case SURFACE.needle: {
            const leaves = grain(u, v, 14, 21, 53);
            value = 0.02 + broad * 0.4 + leaves * 0.49 + fine * 0.15;
            rough = 0.66 + leaves * 0.19;
            break;
          }
          case SURFACE.bark:
          case SURFACE.plank: {
            const warp =
              0.043 * Math.sin(v * 6.283185) + 0.024 * Math.sin(v * 12.56637);
            const fibers = grain(u + warp, v, 29, 4, 18);
            value = 0.09 + fibers * 0.56 + broad * 0.22 + fine * 0.12;
            if (type === SURFACE.plank) value = 0.16 + value * 0.68;
            rough = type === SURFACE.plank ? 0.77 : 0.95;
            break;
          }
          case SURFACE.soil:
          case SURFACE.sand: {
            value = 0.14 + broad * 0.37 + fine * 0.3 + fleck * 0.16;
            if (fine > 0.69 && type === SURFACE.soil) value += 0.13;
            rough = 0.93;
            break;
          }
          case SURFACE.snow: {
            value =
              0.38 + broad * 0.13 + fine * 0.1 + (fleck > 0.978 ? 0.15 : 0);
            rough = 0.53 + fine * 0.32;
            break;
          }
          case SURFACE.gem: {
            const facets = grain(u, v, 5, 3, 73);
            value = 0.3 + Math.floor(facets * 5) * 0.092;
            rough = 0.17 + facets * 0.13;
            break;
          }
          case SURFACE.copper:
            value = 0.32 + broad * 0.27 + fine * 0.11;
            rough = 0.4 + broad * 0.25;
            break;
          default:
            value = 0.5;
            rough = 1;
        }
        const index = ((type * resolution + y) * resolution + x) * 4;
        pixels[index] = THREE.MathUtils.clamp(value, 0, 1) * 255;
        pixels[index + 1] = rough * 255;
        pixels[index + 2] = broad * 255;
        pixels[index + 3] = 255;
      }
  }
  const atlas = new THREE.DataArrayTexture(
    pixels,
    resolution,
    resolution,
    layers,
  );
  atlas.wrapS = atlas.wrapT = THREE.RepeatWrapping;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.magFilter = THREE.NearestFilter;
  atlas.generateMipmaps = true;
  atlas.needsUpdate = true;
  atlas.name = "Wildreach material detail";
  return atlas;
}

export function createIslandMaterials() {
  const time = { value: 0 },
    atlas = makeSurfaceAtlas();
  const land = new THREE.MeshStandardMaterial({ roughness: 0.92 });
  land.onBeforeCompile = (shader) => {
    shader.uniforms.islandTime = time;
    shader.uniforms.surfaceAtlas = { value: atlas };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
      attribute float surfaceKind;
      uniform float islandTime;
      varying vec3 detailUV;
      varying float sideShade;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec3 surfacePoint=(instanceMatrix*vec4(position,1.0)).xyz;
        vec2 detailPlane=abs(normal.y)>.5?surfacePoint.xz:(abs(normal.x)>.5?surfacePoint.zy:surfacePoint.xy);
        detailUV=vec3(detailPlane*.66,surfaceKind);
        sideShade=1.0-0.075*(1.0-abs(normal.y))*(0.5-position.y);
        if(surfaceKind>1.5 && surfaceKind<2.5) {
          float gust=sin(surfacePoint.z*.35+islandTime*1.25)+.45*sin(surfacePoint.x*.77+islandTime*1.9);
          transformed.x+=.034*gust/max(.1,length(instanceMatrix[0].xyz));
          transformed.z+=.016*gust/max(.1,length(instanceMatrix[2].xyz));
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
      uniform highp sampler2DArray surfaceAtlas;
      varying vec3 detailUV;
      varying float sideShade;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 texel=texture(surfaceAtlas,detailUV).rgb;
        diffuseColor.rgb*=sideShade*(.69+.62*texel.r);
        diffuseColor.rgb*=vec3(1.0+(texel.b-.5)*.068,1.0,1.0-(texel.b-.5)*.065);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor=texel.g;`,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
        metalnessFactor=(detailUV.z>8.5 && detailUV.z<9.5) ? .22 : .0;`,
      );
  };
  const water = new THREE.MeshStandardMaterial({ roughness: 0.23 });
  water.onBeforeCompile = (shader) => {
    shader.uniforms.islandTime = time;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
      varying vec3 waterPosition; varying float upward;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        waterPosition=(instanceMatrix*vec4(position,1.0)).xyz;
        upward=normal.y;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
      uniform float islandTime;
      varying vec3 waterPosition; varying float upward;`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        vec2 sea=waterPosition.xz;
        float rippleA=dot(sea,vec2(3.1,.85))+islandTime*1.9;
        float rippleB=dot(sea,vec2(-1.15,2.7))-islandTime*1.45;
        float attenuation=1.0-smoothstep(14.0,72.0,length(vViewPosition));
        if(upward>.5){
          vec3 wave=normalize(vec3(-.063*cos(rippleA)+.028*cos(rippleB),1.0,.043*sin(rippleB)));
          normal=normalize(mix(normal,mat3(viewMatrix)*wave,attenuation));
          float crest=smoothstep(1.57,1.98,sin(rippleA)+cos(rippleB));
          diffuseColor.rgb+=vec3(.042,.075,.067)*crest*attenuation;
          float glancing=pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),3.0);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.39,.61,.68),glancing*.44);
        }`,
      );
  };
  const lava = new THREE.MeshBasicMaterial();
  lava.onBeforeCompile = (shader) => {
    shader.uniforms.flowTime = time;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 flowUV;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nflowUV=(instanceMatrix*vec4(position,1.)).xz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float flowTime; varying vec2 flowUV;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      vec2 cell=floor(flowUV*12.)/12.;
      float bands=sin(cell.y*2.3-flowTime*1.1+2.1*sin(cell.x*3.3+cell.y*.64));
      float crust=smoothstep(.38,.82,bands+.24*sin(cell.x*11.+cell.y*5.));
      diffuseColor.rgb=mix(vec3(1.,.34+.12*sin(cell.y-flowTime),.025),vec3(.14,.048,.033),crust);`,
      );
  };
  return {
    land,
    water,
    lava,
    update(seconds: number) {
      time.value = seconds;
    },
    dispose() {
      atlas.dispose();
      land.dispose();
      water.dispose();
      lava.dispose();
    },
  };
}
