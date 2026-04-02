/**
 * Large payload indirection for IPC (Phase F — Claude Code tool result budget / ref parity).
 */

import { randomUUID } from 'crypto'

const store = new Map<string, { json: string; createdAt: number }>()
const TTL_MS = 1000 * 60 * 30

function gc(): void {
  const now = Date.now()
  for (const [k, v] of store) {
    if (now - v.createdAt > TTL_MS) store.delete(k)
  }
}

export function storeStreamPayload(json: string): string {
  gc()
  const ref = `pl_${randomUUID()}`
  store.set(ref, { json, createdAt: Date.now() })
  return ref
}

export function getStreamPayload(ref: string): string | undefined {
  gc()
  return store.get(ref)?.json
}

export const STREAM_PAYLOAD_THRESHOLD_CHARS = 120_000

export function shouldUsePayloadRef(serialized: string): boolean {
  return serialized.length >= STREAM_PAYLOAD_THRESHOLD_CHARS
}
