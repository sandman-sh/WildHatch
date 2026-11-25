export const usernameMaxLength = 20;
export const usernameHint =
  "3–20 characters. Use letters, numbers, spaces, hyphens or underscores.";

export function validateUsername(
  value: unknown,
): { name: string } | { error: string } {
  const name =
    typeof value === "string" ? value.trim().replace(/ +/g, " ") : "";
  if (
    name.length < 3 ||
    name.length > usernameMaxLength ||
    !/^[a-z0-9][a-z0-9 _-]*$/i.test(name)
  )
    return { error: usernameHint };
  if (/^guest(?:[ _-]|$)/i.test(name))
    return {
      error: "Names beginning with Guest are reserved for guest players.",
    };
  return { name };
}
