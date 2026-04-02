/**
 * Serialize exclusive (mutating / side-effect) tool execution (Claude Code runTools serial path parity).
 * parallel_safe tools are not wrapped — they can still run concurrently when the model batches them.
 */

import { getToolConcurrencyGroup } from './tool-policy'

class ExclusiveGate {
  private tail: Promise<unknown> = Promise.resolve()

  run<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(() => fn())
    this.tail = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }
}

const gate = new ExclusiveGate()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapToolsForExclusiveSerialization(tools: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [name, t] of Object.entries(tools)) {
    if (!t || typeof t.execute !== 'function') {
      out[name] = t
      continue
    }
    if (getToolConcurrencyGroup(name) !== 'exclusive') {
      out[name] = t
      continue
    }
    const exec = t.execute.bind(t) as (...args: unknown[]) => Promise<unknown>
    out[name] = {
      ...t,
      execute: (...args: unknown[]) => gate.run(() => exec(...args))
    }
  }
  return out
}
