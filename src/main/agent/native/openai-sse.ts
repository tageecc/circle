/**
 * Parse OpenAI-compatible chat.completions SSE stream into JSON chunks.
 */

export async function* parseOpenAIChatCompletionSSE(
  body: ReadableStream<Uint8Array> | null,
  abortSignal?: AbortSignal
): AsyncGenerator<Record<string, unknown>> {
  if (!body) {
    throw new Error('Response body is empty')
  }
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      if (abortSignal?.aborted) {
        throw new Error(abortSignal.reason || 'Aborted')
      }
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          yield JSON.parse(data) as Record<string, unknown>
        } catch {
          // ignore malformed line
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
