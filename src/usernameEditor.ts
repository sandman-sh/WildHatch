import { readApiJson } from "./apiJson";
import { usernameHint, usernameMaxLength, validateUsername } from "./username";

export function mountUsernameEditor(
  parent: HTMLElement,
  name: string,
  onSaved?: (name: string) => void,
) {
  const form = document.createElement("form");
  form.className = "username-form";
  const label = document.createElement("label");
  label.textContent = "Username";
  const row = document.createElement("div");
  row.className = "username-value";
  const input = document.createElement("input");
  input.name = "username";
  input.autocomplete = "username";
  input.autocapitalize = "none";
  input.spellcheck = false;
  input.maxLength = usernameMaxLength;
  input.value = name;
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "primary";
  submit.textContent = "Save username";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = usernameHint;
  label.append(input);
  row.append(label, submit);
  form.append(row, status);
  parent.append(form);
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    const result = validateUsername(input.value);
    if ("error" in result) {
      status.textContent = result.error;
      input.focus();
      return;
    }
    submit.disabled = true;
    input.readOnly = true;
    status.textContent = "Saving username…";
    try {
      const response = await fetch("/api/profile/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: result.name }),
      });
      const saved = await readApiJson<{ name: string }>(
        response,
        "Could not save your username.",
      );
      input.value = saved.name;
      status.textContent = "Username saved.";
      if (form.isConnected) onSaved?.(saved.name);
    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : "Could not save your username.";
    } finally {
      submit.disabled = false;
      input.readOnly = false;
    }
  };
}
