export const AUTH_COOKIE = "constructive_auth";

export function checkPassword(input: string, expected: string | undefined): boolean {
  if (!expected) return false;
  if (!input) return false;
  return input === expected;
}

export async function sessionToken(secret: string): Promise<string> {
  const data = new TextEncoder().encode(`constructive:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
