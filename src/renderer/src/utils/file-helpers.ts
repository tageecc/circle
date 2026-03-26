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
  c: 'c',
  cpp: 'cpp',
  go: 'go',
  java: 'java',
  rs: 'rust',
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

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'])
const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown'])

export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

export function getLanguageFromFileName(fileName: string): string {
  return LANGUAGE_MAP[getFileExtension(fileName)] || 'plaintext'
}

export function isImageFile(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(getFileExtension(fileName))
}

export function isMarkdownFile(fileName: string): boolean {
  return MARKDOWN_EXTENSIONS.has(getFileExtension(fileName))
}

function splitFilePath(path: string): { parent: string; basename: string } {
  if (!path) return { parent: '', basename: '' }
  const normalized = path.replace(/\\/g, '/')
  const i = normalized.lastIndexOf('/')
  if (i === -1) return { parent: '', basename: normalized }
  return {
    parent: i <= 0 ? '' : normalized.slice(0, i),
    basename: normalized.slice(i + 1)
  }
}

export function getFileNameFromPath(path: string): string {
  return splitFilePath(path).basename
}

export function getParentPath(path: string): string {
  return splitFilePath(path).parent
}
