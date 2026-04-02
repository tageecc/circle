/**
 * Structured harness events for debugging and production metrics (no PII in payloads).
 * Aligns with Claude Code-style observability: one JSON line per notable step.
 */

export function logHarnessEvent(
  name: string,
  payload: Record<string, string | number | boolean | null | undefined>
): void {
  const line = JSON.stringify({ ts: Date.now(), harness: name, ...payload })
  console.log(`[Harness] ${line}`)
}
