/**
 * 从 className 中提取编程语言
 * @param className - 例如 "language-typescript"
 * @returns 语言名称，默认 "plaintext"
 */
export function extractLanguage(className?: string): string {
  if (!className) return 'plaintext'
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : 'plaintext'
}
