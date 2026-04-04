import { AGENT_HARNESS } from '../../constants/service.constants'

/**
 * Combines user abort with a wall-clock timeout so streaming chat requests cannot hang forever.
 */
export function abortSignalForNativeChatFetch(parent?: AbortSignal): AbortSignal {
  const ms = AGENT_HARNESS.NATIVE_CHAT_FETCH_TIMEOUT_MS
  const T = AbortSignal as typeof AbortSignal & {
    timeout?: (m: number) => AbortSignal
    any?: (s: AbortSignal[]) => AbortSignal
  }
  const timed =
    typeof T.timeout === 'function'
      ? T.timeout(ms)
      : (() => {
          const c = new AbortController()
          setTimeout(() => c.abort(new Error('Native chat request timeout')), ms)
          return c.signal
        })()

  if (!parent) return timed
  if (parent.aborted) return parent

  if (typeof T.any === 'function') {
    return T.any([parent, timed])
  }

  const merged = new AbortController()
  const forward = (sig: AbortSignal): void => {
    if (merged.signal.aborted) return
    merged.abort(sig.reason)
  }
  parent.addEventListener('abort', () => forward(parent), { once: true })
  timed.addEventListener('abort', () => forward(timed), { once: true })
  return merged.signal
}
