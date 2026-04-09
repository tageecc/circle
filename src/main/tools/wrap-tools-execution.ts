/**
 * Serialize exclusive (mutating / side-effect) tool execution to prevent conflicts.
 * parallel_safe tools are not wrapped — they can still run concurrently when the model batches them.
 */

import type { CircleToolSet } from '../types/circle-tool-set'
import type { ToolExecutionOptions } from '@ai-sdk/provider-utils'
import { getToolConcurrencyGroup } from './tool-policy'

class ExclusiveGate {
  private tail: Promise<unknown> = Promise.resolve()
  private pendingCount = 0

  run<T>(fn: () => Promise<T>, abortSignal?: AbortSignal): Promise<T> {
    this.pendingCount += 1
    const run = this.tail.then(() => {
      if (abortSignal?.aborted) {
        throw new Error('Exclusive tool execution cancelled before start.')
      }
      return fn()
    })
    this.tail = run.then(
      () => undefined,
      () => undefined
    )
    return run.finally(() => {
      this.pendingCount -= 1
    })
  }

  isIdle(): boolean {
    return this.pendingCount === 0
  }
}

const gates = new Map<string, ExclusiveGate>()

function getExclusiveGateKey(args: unknown[]): string {
  const options = args[args.length - 1] as ToolExecutionOptions | undefined
  const sessionId = (options?.experimental_context as { sessionId?: unknown } | undefined)?.sessionId

  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('Exclusive tool execution requires a valid session-scoped tool context.')
  }

  return sessionId
}

export function wrapToolsForExclusiveSerialization(tools: CircleToolSet): CircleToolSet {
  const out: CircleToolSet = { ...tools }
  for (const name of Object.keys(out)) {
    const t = out[name]
    if (!t || typeof t.execute !== 'function') continue
    if (getToolConcurrencyGroup(name) !== 'exclusive') continue
    const exec = t.execute.bind(t) as (...args: unknown[]) => Promise<unknown>
    out[name] = {
      ...t,
      execute: (...args: unknown[]) => {
        const gateKey = getExclusiveGateKey(args)
        const gate = gates.get(gateKey) ?? new ExclusiveGate()
        gates.set(gateKey, gate)
        const options = args[args.length - 1] as ToolExecutionOptions | undefined
        const abortSignal = (options?.experimental_context as { abortSignal?: AbortSignal } | undefined)
          ?.abortSignal
        return gate.run(() => exec(...args), abortSignal).finally(() => {
          if (gate.isIdle()) {
            gates.delete(gateKey)
          }
        })
      }
    }
  }
  return out
}
