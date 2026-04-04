/**
 * Serialize exclusive (mutating / side-effect) tool execution to prevent conflicts.
 * parallel_safe tools are not wrapped — they can still run concurrently when the model batches them.
 */

import type { CircleToolSet } from '../types/circle-tool-set'
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

export function wrapToolsForExclusiveSerialization(tools: CircleToolSet): CircleToolSet {
  const out: CircleToolSet = { ...tools }
  for (const name of Object.keys(out)) {
    const t = out[name]
    if (!t || typeof t.execute !== 'function') continue
    if (getToolConcurrencyGroup(name) !== 'exclusive') continue
    const exec = t.execute.bind(t) as (...args: unknown[]) => Promise<unknown>
    out[name] = {
      ...t,
      execute: (...args: unknown[]) => gate.run(() => exec(...args))
    }
  }
  return out
}
