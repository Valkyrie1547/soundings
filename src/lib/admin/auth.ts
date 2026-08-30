/**
 * The admin gate. One shared token (`ADMIN_TOKEN`) opens it:
 * `/admin?token=<value>` sets an httpOnly cookie, and every later request
 * shows the cookie. Without a valid cookie, the admin paths answer 404,
 * not 401, so the route does not advertise itself. When `ADMIN_TOKEN` is
 * not set, the gate never opens.
 *
 * The proxy runs at the edge, so this module uses no node imports.
 */

export const ADMIN_COOKIE = "soundings_admin";

/**
 * Compares two strings in constant time over the given value's length.
 * A plain `===` returns early on the first different character, which
 * leaks how much of a guess is correct.
 */
export function tokensEqual(given: string, expected: string): boolean {
  let diff = given.length ^ expected.length;
  for (let i = 0; i < given.length; i += 1) {
    diff |= given.charCodeAt(i) ^ (expected.charCodeAt(i % expected.length) || 0);
  }
  return diff === 0;
}

/** True when the value proves admin access. False always when the token is not configured. */
export function isAdminToken(value: string | undefined | null): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || !value) return false;
  return tokensEqual(value, expected);
}
