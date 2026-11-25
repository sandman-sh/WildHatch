import * as THREE from "three";

const C = (hex: number) => new THREE.Color(hex);
const skyDay = C(0x8ccddd),
  horizonDay = C(0xe2e9cf);
const skyDusk = C(0x8787b0),
  horizonDusk = C(0xf4ba8a);
const skyNight = C(0x172c4b),
  horizonNight = C(0x677992);
const stormSky = C(0x738794),
  stormHorizon = C(0xa7b8bc);
const sunlight = C(0xffedc4),
  sunset = C(0xffbf83),
  moonlight = C(0xa3c2ff);
type Region = {
  tint: THREE.Color;
  floor: THREE.Color;
  motes: THREE.Color;
  count: number;
  size: number;
  drift: number;
};
const regions: Record<string, Region> = {
  "Emerald Forest": {
    tint: C(0xc1dcc0),
    floor: C(0xb7c2a3),
    motes: C(0xd2d788),
    count: 38,
    size: 0.07,
    drift: -0.18,
  },
  "Frozen Peaks": {
    tint: C(0xbacfdc),
    floor: C(0xa4bed1),
    motes: C(0xf1faff),
    count: 230,
    size: 0.084,
    drift: -1.25,
  },
  "Lava Realm": {
    tint: C(0xd1ada1),
    floor: C(0xaf8b81),
    motes: C(0xffa35b),
    count: 92,
    size: 0.066,
    drift: 0.89,
  },
  "Crystal Valley": {
    tint: C(0xc4b8d3),
    floor: C(0xb4a2ba),
    motes: C(0xeebdff),
    count: 60,
    size: 0.07,
    drift: 0.22,
  },
  "Ocean Frontier": {
    tint: C(0xb4dbd2),
    floor: C(0xbec2a4),
    motes: C(0xe4f4ed),
    count: 40,
    size: 0.047,
    drift: -0.1,
  },
};
const budgets: Record<string, number> = {
  Low: 0.2,
  Medium: 0.5,
  High: 0.83,
  Ultra: 1,
};
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const smooth = THREE.MathUtils.smoothstep;
const wrap = THREE.MathUtils.euclideanModulo;
const nightMote = C(0xe5f79a);
const snowHorizon = C(0xdce5e6);
const cycle = Math.PI * 2;

/** Time is elapsed simulation time in seconds. Effects are visual and never change authoritative state. */
export function setupAtmosphere(
  scene: THREE.Scene,
  sun: THREE.DirectionalLight,
  hemi: THREE.HemisphereLight,
) {
  const previousBackground = scene.background,
    previousFog = scene.fog;
  const initialSun = {
    color: sun.color.clone(),
    power: sun.intensity,
    position: sun.position.clone(),
    target: sun.target.position.clone(),
  };
  const initialHemi = {
    color: hemi.color.clone(),
    floor: hemi.groundColor.clone(),
    power: hemi.intensity,
  };
  const skyColor = skyDay.clone(),
    horizon = horizonDay.clone();
  const regionTint = regions["Emerald Forest"].tint.clone();
  const regionGround = regions["Emerald Forest"].floor.clone();
  const sunAxis = new THREE.Vector3(-0.55, 0.83, 0.34);
  const mist = new THREE.FogExp2(horizon, 0.011);
  scene.fog = mist;
  scene.background = horizon;

  const skyGeometry = new THREE.SphereGeometry(180, 30, 14);
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: skyColor },
      horizon: { value: horizon },
      lightAxis: { value: sunAxis },
      day: { value: 1 },
      cloudCover: { value: 0 },
    },
    vertexShader: `
      varying vec3 skyVector;
      void main() {
        skyVector = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: `
      uniform vec3 zenith, horizon, lightAxis;
      uniform float day, cloudCover;
      varying vec3 skyVector;
      void main() {
        vec3 dir=normalize(skyVector);
        float lift=pow(clamp(dir.y,0.0,1.0),0.63);
        vec3 color=mix(horizon,zenith,lift);
        float alignment=clamp(dot(dir,lightAxis),0.0,1.0);
        float halo=pow(alignment,74.0)*0.19+smoothstep(.9984,.9993,alignment)*.95;
        color+=mix(vec3(.50,.66,.92),vec3(1.0,.83,.54),day)*halo*(1.0-cloudCover*.8);
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.name = "Island sky";
  sky.renderOrder = -50;
  sky.frustumCulled = false;
  scene.add(sky);

  const limit = 240;
  const seeds = new Float32Array(limit * 3);
  let state = 0x614a27f9;
  for (let i = 0; i < seeds.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    seeds[i] = state / 4294967296;
  }
  function field(capacity: number) {
    const geo = new THREE.BufferGeometry();
    const pos = new THREE.BufferAttribute(
      new Float32Array(capacity * 3),
      3,
    ).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", pos);
    geo.setDrawRange(0, 0);
    return { geo, pos };
  }
  const moteField = field(limit),
    rainField = field(limit * 2);
  const moteMaterial = new THREE.PointsMaterial({
    color: regions["Emerald Forest"].motes,
    size: 0.07,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const rainMaterial = new THREE.LineBasicMaterial({
    color: 0xc9dde1,
    transparent: true,
    opacity: 0.54,
    depthWrite: false,
  });
  const motes = new THREE.Points(moteField.geo, moteMaterial);
  const rain = new THREE.LineSegments(rainField.geo, rainMaterial);
  motes.name = "Ambient particles";
  rain.name = "Rain";
  motes.frustumCulled = false;
  rain.frustumCulled = false;
  scene.add(rain, motes);
  let lastTime: number | undefined,
    air = 0.0,
    storm = 0.0,
    count = 38,
    drift = -0.18,
    liftOffset = 0,
    windOffset = 0;

  function update(
    time: number,
    playerPosition: THREE.Vector3,
    biomeName: string,
    qualityName: string,
  ) {
    const dt = lastTime === undefined ? 1 : clamp(time - lastTime, 0, 1);
    lastTime = time;
    const t = 1 - Math.exp(-dt * 1.55);
    const region = regions[biomeName] ?? regions["Emerald Forest"];
    const quality = budgets[qualityName] ?? budgets.High;
    const phase = (time * cycle) / 480 + 0.91,
      altitude = Math.sin(phase);
    const day = smooth(altitude, -0.12, 0.37);
    const dusk = 1 - smooth(Math.abs(altitude), 0.02, 0.44);
    // Showers alternate with open skies. A blizzard thickens snow at higher elevations.
    const front =
      0.68 * Math.sin(time * 0.029 - 1.65) +
      0.32 * Math.sin(time * 0.051 - 0.9);
    const wet =
      biomeName === "Ocean Frontier" || biomeName === "Emerald Forest";
    storm = mix(storm, wet ? smooth(front, 0.28, 0.83) : 0, t);
    air = mix(
      air,
      biomeName === "Frozen Peaks"
        ? 0.28 + 0.72 * smooth(front, -0.24, 0.85)
        : 0,
      t,
    );
    regionTint.lerp(region.tint, t);
    regionGround.lerp(region.floor, t);
    skyColor
      .copy(skyNight)
      .lerp(skyDay, day)
      .lerp(skyDusk, dusk * 0.58)
      .lerp(stormSky, storm * 0.72);
    horizon
      .copy(horizonNight)
      .lerp(horizonDay, day)
      .lerp(regionTint, day * 0.35)
      .lerp(horizonDusk, dusk * 0.76)
      .lerp(stormHorizon, storm * 0.72)
      .lerp(snowHorizon, air * 0.57);
    mist.color.copy(horizon);
    mist.density = 0.0105 + 0.003 * (1 - day) + 0.009 * storm + 0.012 * air;
    sky.position.copy(playerPosition);
    sunAxis
      .set(-Math.cos(phase) * 0.92, Math.abs(altitude) * 0.9 + 0.13, 0.33)
      .normalize();
    sun.position.copy(playerPosition).addScaledVector(sunAxis, 59);
    sun.target.position.copy(playerPosition);
    sun.color
      .copy(moonlight)
      .lerp(sunlight, day)
      .lerp(sunset, dusk * 0.78);
    sun.intensity = (0.47 + day * 1.8) * (1 - 0.51 * storm - 0.26 * air);
    hemi.color.copy(horizon).lerp(sunlight, day * 0.5);
    hemi.groundColor.copy(regionGround);
    // One gentle pulse per storm period keeps cloud illumination readable.
    const lightning =
      storm * smooth(Math.sin(time * 0.23 + 0.6), 0.995, 1) * 0.26;
    hemi.intensity = 1.02 + day * 0.98 + lightning;
    skyMaterial.uniforms.day.value = day;

    skyMaterial.uniforms.cloudCover.value = storm + 0.65 * air;

    drift = mix(drift, region.drift, t);
    liftOffset += dt * drift;
    windOffset += dt * (0.3 + air * 0.83);
    count = mix(count, region.count * (1 + air * 0.2), t);
    const moteCount = Math.min(limit, Math.round(count * quality));
    const rainCount = Math.round(quality * storm * limit);
    const forestNight = biomeName === "Emerald Forest" ? 1 - day : 0;
    moteMaterial.color.lerp(region.motes, t).lerp(nightMote, t * forestNight);
    moteMaterial.size = mix(
      moteMaterial.size,
      region.size + forestNight * 0.032,
      t,
    );
    moteMaterial.opacity = 0.66 + forestNight * 0.28;
    const area = 30,
      height = 14;
    for (let i = 0; i < moteCount; i++) {
      const j = i * 3,
        a = seeds[j],
        b = seeds[j + 1],
        c = seeds[j + 2];
      const sway = Math.sin(time * 0.67 + a * 24) * 0.63;
      const x =
        playerPosition.x +
        wrap(a * area + windOffset + sway - playerPosition.x, area) -
        area / 2;
      const y =
        playerPosition.y +
        wrap(b * height + liftOffset * (0.65 + c) - playerPosition.y, height) -
        2.4;
      const z =
        playerPosition.z +
        wrap(
          c * area +
            time * 0.15 +
            Math.sin(time * 0.32 + a * 18) * 0.65 -
            playerPosition.z,
          area,
        ) -
        area / 2;
      moteField.pos.setXYZ(i, x, y, z);
    }
    moteField.geo.setDrawRange(0, moteCount);
    moteField.pos.needsUpdate = true;
    rain.visible = rainCount > 0;
    if (rainCount) {
      for (let i = 0; i < rainCount; i++) {
        const j = i * 3;
        const x =
          playerPosition.x +
          wrap(seeds[j] * area + time * 2 - playerPosition.x, area) -
          area / 2;
        const y =
          playerPosition.y +
          wrap(
            seeds[j + 1] * height -
              time * (12 + seeds[j] * 2) -
              playerPosition.y,
            height,
          ) -
          2;
        const z =
          playerPosition.z +
          wrap(seeds[j + 2] * area - playerPosition.z, area) -
          area / 2;
        rainField.pos.setXYZ(i * 2, x, y, z);
        rainField.pos.setXYZ(i * 2 + 1, x - 0.09, y + 0.56, z);
      }
      rainField.pos.needsUpdate = true;
    }
    rainField.geo.setDrawRange(0, rainCount * 2);
    return { rain: storm, snow: air };
  }
  function dispose() {
    scene.remove(sky, rain, motes);
    skyGeometry.dispose();
    skyMaterial.dispose();
    moteField.geo.dispose();
    moteMaterial.dispose();
    rainField.geo.dispose();
    rainMaterial.dispose();
    scene.background = previousBackground;
    scene.fog = previousFog;
    sun.color.copy(initialSun.color);
    sun.intensity = initialSun.power;
    sun.position.copy(initialSun.position);
    sun.target.position.copy(initialSun.target);
    hemi.color.copy(initialHemi.color);
    hemi.groundColor.copy(initialHemi.floor);
    hemi.intensity = initialHemi.power;
  }
  return { update, dispose };
}
