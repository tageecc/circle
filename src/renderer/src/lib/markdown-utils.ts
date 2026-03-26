/**
 * Extracts a language id from a markdown code fence class (e.g. `language-typescript`).
 */
export function extractLanguage(className?: string): string {
  if (!className) return 'plaintext'
  const match = className.match(/language-([^\s"'>`]+)/)
  return match ? match[1] : 'plaintext'
}
