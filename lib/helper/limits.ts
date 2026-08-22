/** Bounds on a helper chat request — keeps prompt cost and payload memory in check. */
export const MAX_HELPER_TURNS = 40;
export const MAX_HELPER_TURN_LENGTH = 2000;

/**
 * Client-side mirror of the server's caps (`app/api/helper/route.ts`'s
 * `BodySchema`). Checking before the request goes out means a student never
 * hits a 400 that a generic "try again" message makes look retriable when
 * it never will be — retrying an over-cap send just fails identically.
 * Returns a message to show instead of sending, or null if the send is fine.
 */
export function helperSendGuard(priorTurnCount: number, text: string): string | null {
  if (text.length > MAX_HELPER_TURN_LENGTH) {
    return "That message is too long — try trimming it and sending again.";
  }
  if (priorTurnCount + 1 > MAX_HELPER_TURNS) {
    return "This conversation has gotten long enough that the helper can't keep going. Start a new one to keep going.";
  }
  return null;
}
