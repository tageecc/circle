const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescriptreact',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascriptreact',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'json',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  py: 'python',
  md: 'markdown',
  markdown: 'markdown',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
  xml: 'xml',
  txt: 'plaintext'
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']
const MARKDOWN_EXTENSIONS = ['md', 'markdown']

export function getLanguageFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  return LANGUAGE_MAP[ext || ''] || 'plaintext'
}

export function isImageFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext || '')
}

export function isMarkdownFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase()
  return MARKDOWN_EXTENSIONS.includes(ext || '')
}

export function getFileNameFromPath(path: string): string {
  return path.split('/').pop() || ''
}

export function getParentPath(path: string): string {
  return path.split('/').slice(0, -1).join('/')
}
