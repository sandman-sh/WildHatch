/** Safely parse an HTTP response body as JSON without throwing SyntaxError on plain-text or HTML server errors. */
export async function parseJsonBody(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Parse a JSON API response, throwing an Error with the server's message or fallbackError on failure. */
export async function readApiJson<T = any>(
  response: Response,
  fallbackError: string,
): Promise<T> {
  const data = await parseJsonBody(response);
  if (!response.ok || data === undefined) {
    throw Error(
      typeof data?.error === "string" && data.error ? data.error : fallbackError,
    );
  }
  return data as T;
}
