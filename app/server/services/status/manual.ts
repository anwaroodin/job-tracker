/** A status the user picked counts as set by hand, so Gmail sync won't override it. */
export function setByHand(status: string, at = new Date().toISOString()) {
  return { status, manualStatusAt: at };
}
