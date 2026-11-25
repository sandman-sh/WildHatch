import * as T from "three";
import { makeBeastFigure, animateModel, type BeastFigure } from "./models";
import { gameAudio } from "./audio";
export const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let inspectionRenderer: T.WebGLRenderer | undefined;
export function mountCreatureStage(
  content: HTMLElement,
  beasts: BeastFigure[],
  action: string,
  previousForm?: BeastFigure,
  move?: { actor: number; name: string; damage: number },
) {
  const r = (inspectionRenderer ??= new T.WebGLRenderer({
    antialias: true,
    alpha: true,
  }));
  const canvas = r.domElement;
  canvas.className = "preview";
  const stage = document.createElement("div");
  stage.className = "beast-stage";
  stage.append(canvas);
  const hitLabel = document.createElement("span");
  const impactPosition = new T.Vector3();
  if (action === "duel" && move) {
    hitLabel.className = "duel-impact";
    hitLabel.textContent = move.damage ? "−" + move.damage : "Guard";
    hitLabel.setAttribute("aria-hidden", "true");
    stage.append(hitLabel);
  }
  content.append(stage);
  r.setPixelRatio(Math.min(1.5, devicePixelRatio));
  r.setSize(canvas.clientWidth, 180, false);
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight(0xfff6dc, 0x9fa988, 2.3));
  const light = new T.DirectionalLight(0xffefd4, 2);
  light.position.set(-4, 7, 5);
  scene.add(light);
  const models = beasts.map((b, i) => {
    const m = makeBeastFigure(b);
    m.position.x = (i - (beasts.length - 1) / 2) * 2.8;
    scene.add(m);
    return m;
  });
  const bounds = new T.Box3().setFromObject(scene),
    center = bounds.getCenter(new T.Vector3()),
    size = bounds.getSize(new T.Vector3());
  const plinthMaterial = new T.MeshStandardMaterial({
    color: action === "duel" ? 0x596660 : 0x567965,
    flatShading: true,
  });
  const plinth = new T.Mesh(
    new T.CylinderGeometry(1, 1.05, 0.12, 8),
    plinthMaterial,
  );
  plinth.scale.set(
    Math.max(0.8, size.x * 0.7),
    1,
    Math.max(0.8, size.z * 0.66),
  );
  plinth.position.set(center.x, bounds.min.y - 0.065, center.z);
  scene.add(plinth);
  if (action === "duel") {
    const rim = new T.Mesh(
      new T.RingGeometry(0.78, 0.81, 8, 1, Math.PI / 8),
      new T.MeshBasicMaterial({ color: 0xdcb679 }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.copy(plinth.position);
    rim.position.y += 0.062;
    rim.scale.set(plinth.scale.x, plinth.scale.z, 1);
    scene.add(rim);
  }
  const changing =
    !reducedMotion.matches && ["hatch", "evolve"].includes(action);
  const transitionMaterial = new T.MeshStandardMaterial({
    color: 0xe7dca8,
    emissive: 0x534425,
    flatShading: true,
  });
  let shell: T.Object3D | undefined;
  if (changing) {
    shell =
      action === "evolve" && previousForm
        ? makeBeastFigure(previousForm)
        : new T.Mesh(new T.SphereGeometry(0.48, 8, 5), transitionMaterial);
    if (action === "hatch") {
      shell.scale.y = 1.25;
      shell.position.y = 0.58;
    }
    scene.add(shell);
  }
  const cam = new T.PerspectiveCamera(35, canvas.clientWidth / 180, 0.1, 100);
  let radius = 1;
  function sizePreview() {
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    if (!width || !height) return;
    r.setSize(width, height, false);
    cam.aspect = width / height;
    cam.updateProjectionMatrix();
    radius = Math.max(size.y, size.z * 0.7, size.x / cam.aspect) * 2 + 0.6;
  }
  sizePreview();
  const observer = new ResizeObserver(sizePreview);
  observer.observe(canvas);
  let yaw = 2.75,
    last = 0,
    handle = 0,
    drag = false;
  canvas.onpointerdown = (e) => {
    drag = true;
    last = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove = (e) => {
    if (drag) {
      yaw += (e.clientX - last) * 0.012;
      last = e.clientX;
    }
  };
  canvas.onlostpointercapture = () => (drag = false);
  const start = performance.now();
  let cracked = false;
  let hatched = false;
  function draw() {
    const t = (performance.now() - start) / 1000;
    if (shell) {
      if (!cracked && t >= 0.34) {
        cracked = true;
        gameAudio.play("eggCrack");
      }
      if (!hatched && t >= 0.58) {
        hatched = true;
        gameAudio.play("hatch");
      }
      shell.visible = t < 0.58;
      models[0].visible = !shell.visible;
      shell.rotation.z = Math.sin(t * 38) * 0.08;
      light.intensity = 2 + 4 * Math.exp(-((t - 0.58) ** 2) / 0.025);
    }
    models.forEach((m, i) => {
      m.rotation.y = beasts.length === 2 ? (i ? 1 : -1) * 1.24 : 0;
      const lastMove = move && t < 0.85;
      const attacking = lastMove && move.actor === i;
      const duelPose =
        !lastMove || move.name === "Guard"
          ? "idle"
          : attacking
            ? "attack"
            : "hit";
      if (
        action === "duel" &&
        lastMove &&
        move.name !== "Guard" &&
        !reducedMotion.matches
      ) {
        const lunge = Math.sin(Math.PI * Math.min(1, t / 0.5));
        const side = i === 0 ? 1 : -1;
        m.position.x =
          (i - 0.5) * 2.8 + side * lunge * (attacking ? 0.44 : -0.13);
      }
      animateModel(
        m,
        t,
        0,
        action === "duel" ? duelPose : changing ? "victory" : action,
      );
    });
    cam.position.set(
      Math.sin(yaw) * radius,
      center.y + radius * 0.27,
      Math.cos(yaw) * radius,
    );
    cam.lookAt(center);
    r.render(scene, cam);
    if (hitLabel.parentElement && move) {
      if (t > 1.2) hitLabel.remove();
      else {
        const target = models[move.damage ? 1 - move.actor : move.actor];
        impactPosition.copy(target.position);
        impactPosition.y += size.y * 0.9;
        impactPosition.project(cam);
        hitLabel.style.left = (impactPosition.x + 1) * 50 + "%";
        hitLabel.style.top = (1 - impactPosition.y) * 50 + "%";
      }
    }
    handle = requestAnimationFrame(draw);
  }
  draw();
  return () => {
    observer.disconnect();
    cancelAnimationFrame(handle);
    scene.traverse((o) => {
      if (o instanceof T.Mesh) o.geometry.dispose();
      if (o instanceof T.Mesh && o.material instanceof T.MeshBasicMaterial)
        o.material.dispose();
    });
    plinthMaterial.dispose();
    transitionMaterial.dispose();
    canvas.onpointerdown =
      canvas.onpointermove =
      canvas.onlostpointercapture =
        null;
  };
}
