import * as T from "three";
import { makeExplorer, animateModel } from "./models";
import { rangerFor, rangers, selectedRanger } from "./rangers";
import { loadExplorer } from "./voxelExplorer";

export function pickExplorer() {
  const dialog = document.querySelector<HTMLDialogElement>("#ranger-picker")!;
  if (dialog.open) return;
  dialog.showModal();
  const canvas = dialog.querySelector<HTMLCanvasElement>("canvas")!;
  const list = dialog.querySelector<HTMLElement>("#roster")!;
  const search = dialog.querySelector<HTMLInputElement>("#explorer-search")!;
  const status = dialog.querySelector<HTMLElement>("#explorer-status")!;
  search.value = "";
  list.replaceChildren();
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(32, 1, 0.1, 15);
  let renderer: T.WebGLRenderer | undefined;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  } catch {
    canvas.hidden = true;
  }
  scene.add(new T.HemisphereLight(0xfff0cf, 0x90afa0, 2.4));
  const sun = new T.DirectionalLight(0xffe5be, 2.2);
  sun.position.set(-2, 3, -3);
  scene.add(sun);
  camera.position.set(1.45, 1.55, -3.9);
  camera.lookAt(0, 1.05, 0);
  let model: T.Group,
    frame = 0;
  function clear() {
    if (!model) return;
    scene.remove(model);
    model.traverse((o) => {
      if (o instanceof T.Mesh) o.geometry.dispose();
    });
  }
  let sequence = 0;
  async function show(index: number) {
    const ticket = ++sequence;
    const ranger = rangerFor(index);
    status.textContent = "Loading " + ranger.name + "…";
    try {
      await loadExplorer(index);
    } catch {
      if (ticket === sequence && dialog.open)
        status.textContent =
          "Preview unavailable. Select the explorer to retry.";
      return;
    }
    if (ticket !== sequence || !dialog.open) return;
    clear();
    model = makeExplorer(index);
    scene.add(model);
    localStorage.setItem("beasts.ranger", String(index));
    status.textContent = ranger.name + " selected";
    list
      .querySelectorAll<HTMLButtonElement>("[data-ranger]")
      .forEach((el) =>
        el.setAttribute(
          "aria-pressed",
          String(Number(el.dataset.ranger) === ranger.id),
        ),
      );
  }
  for (const r of rangers) {
    const b = document.createElement("button");
    b.textContent = r.name;
    b.dataset.ranger = String(r.id);
    const portrait = document.createElement("img");
    portrait.className = "roster-portrait desktop-only";
    portrait.alt = "";
    portrait.loading = "lazy";
    portrait.width = 32;
    portrait.height = 32;
    portrait.src = "/ranger-portraits/" + r.id + ".webp";
    b.prepend(portrait);
    b.setAttribute("aria-pressed", "false");
    b.onclick = () => void show(r.id);
    list.append(b);
  }
  search.oninput = () => {
    const query = search.value.trim().toLowerCase();
    let matches = 0;
    for (const button of list.querySelectorAll("button")) {
      button.hidden = !button.textContent.toLowerCase().includes(query);
      if (!button.hidden) matches++;
    }
    list.scrollTop = 0;
    status.textContent = matches
      ? matches + (matches === 1 ? " explorer" : " explorers")
      : "No matching explorers";
  };
  void show(selectedRanger());
  list
    .querySelector('[data-ranger="' + selectedRanger() + '"]')
    ?.scrollIntoView({ block: "nearest" });
  function draw(now: number) {
    if (!renderer) return;
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (w && h) {
      if (
        canvas.width !== Math.round(w * renderer.getPixelRatio()) ||
        canvas.height !== Math.round(h * renderer.getPixelRatio())
      )
        renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (model) {
        animateModel(model, now / 1000, 0.18);
        model.rotation.y = 0.22 * Math.sin(now * 0.0007);
      }
      renderer.render(scene, camera);
    }
    frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);
  dialog.querySelector<HTMLButtonElement>("#ranger-done")!.onclick = () =>
    dialog.close();
  dialog.addEventListener(
    "close",
    () => {
      sequence++;
      cancelAnimationFrame(frame);
      clear();
      renderer?.dispose();
      renderer?.forceContextLoss();
      canvas.replaceWith(canvas.cloneNode());
    },
    { once: true },
  );
}
