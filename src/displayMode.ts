const touchDisplay = matchMedia("(pointer: coarse)");
export const portraitGame = matchMedia(
  "(pointer: coarse) and (orientation: portrait)",
);
const rotate = document.querySelector<HTMLDialogElement>("#rotate-device")!;
let expeditionActive = false;

export async function enterGameDisplay() {
  try {
    if (!document.fullscreenElement && document.fullscreenEnabled)
      await document.documentElement.requestFullscreen({
        navigationUI: "hide",
      });
  } catch {
    // Embedded browsers can restrict fullscreen independently of orientation.
  }
  if (touchDisplay.matches) {
    const orientation = screen.orientation as
      | (ScreenOrientation & { lock?: (mode: "landscape") => Promise<void> })
      | undefined;
    try {
      await orientation?.lock?.("landscape");
    } catch {
      // The rotation prompt follows the actual viewport when locking is unavailable.
    }
  }
}

export function syncRotationPrompt(raise = false) {
  if (expeditionActive && portraitGame.matches) {
    if (raise && rotate.open) rotate.close();
    if (!rotate.open) rotate.showModal();
  } else if (rotate.open) rotate.close();
}

export function setExpeditionDisplay(active: boolean) {
  expeditionActive = active;
  syncRotationPrompt();
}

rotate.addEventListener("cancel", (event) => event.preventDefault());
portraitGame.addEventListener("change", () => syncRotationPrompt());
