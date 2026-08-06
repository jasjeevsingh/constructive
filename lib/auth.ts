export const AUTH_COOKIE = "constructive_auth";

export function checkPassword(input: string, expected: string | undefined): boolean {
  if (!expected) return false;
  if (!input) return false;
  return input === expected;
}
