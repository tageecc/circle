import { getFileExtension } from '../utils/file-helpers'

import {
  FileText,
  FileJson,
  FileCode,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  Database,
  Settings,
  Package,
  Lock,
  FileType,
  type LucideIcon
} from 'lucide-react'

interface FileIconConfig {
  icon: LucideIcon
  color: string
}

const fileIconMap: Record<string, FileIconConfig> = {
  // JavaScript/TypeScript
  js: { icon: FileCode, color: 'text-yellow-500' },
  jsx: { icon: FileCode, color: 'text-yellow-500' },
  ts: { icon: FileCode, color: 'text-blue-500' },
  tsx: { icon: FileCode, color: 'text-blue-500' },
  mjs: { icon: FileCode, color: 'text-yellow-500' },
  cjs: { icon: FileCode, color: 'text-yellow-500' },

  // Web
  html: { icon: FileCode, color: 'text-orange-500' },
  css: { icon: FileCode, color: 'text-blue-400' },
  scss: { icon: FileCode, color: 'text-pink-500' },
  sass: { icon: FileCode, color: 'text-pink-500' },
  less: { icon: FileCode, color: 'text-blue-600' },

  // Markup/Config
  json: { icon: FileJson, color: 'text-yellow-600' },
  xml: { icon: FileCode, color: 'text-orange-600' },
  yaml: { icon: Settings, color: 'text-purple-500' },
  yml: { icon: Settings, color: 'text-purple-500' },
  toml: { icon: Settings, color: 'text-orange-500' },
  ini: { icon: Settings, color: 'text-gray-500' },
  env: { icon: Lock, color: 'text-yellow-500' },

  // Documents
  md: { icon: FileText, color: 'text-blue-500' },
  mdx: { icon: FileText, color: 'text-blue-500' },
  txt: { icon: FileText, color: 'text-gray-500' },
  pdf: { icon: FileText, color: 'text-red-500' },
  doc: { icon: FileText, color: 'text-blue-600' },
  docx: { icon: FileText, color: 'text-blue-600' },

  // Images
  png: { icon: FileImage, color: 'text-green-500' },
  jpg: { icon: FileImage, color: 'text-green-500' },
  jpeg: { icon: FileImage, color: 'text-green-500' },
  gif: { icon: FileImage, color: 'text-green-500' },
  svg: { icon: FileImage, color: 'text-orange-500' },
  webp: { icon: FileImage, color: 'text-green-500' },
  ico: { icon: FileImage, color: 'text-blue-500' },

  // Video
  mp4: { icon: FileVideo, color: 'text-purple-500' },
  avi: { icon: FileVideo, color: 'text-purple-500' },
  mov: { icon: FileVideo, color: 'text-purple-500' },
  webm: { icon: FileVideo, color: 'text-purple-500' },

  // Audio
  mp3: { icon: FileAudio, color: 'text-pink-500' },
  wav: { icon: FileAudio, color: 'text-pink-500' },
  ogg: { icon: FileAudio, color: 'text-pink-500' },
  flac: { icon: FileAudio, color: 'text-pink-500' },

  // Archives
  zip: { icon: FileArchive, color: 'text-yellow-600' },
  rar: { icon: FileArchive, color: 'text-yellow-600' },
  tar: { icon: FileArchive, color: 'text-yellow-600' },
  gz: { icon: FileArchive, color: 'text-yellow-600' },
  '7z': { icon: FileArchive, color: 'text-yellow-600' },

  // Database
  sql: { icon: Database, color: 'text-orange-500' },
  db: { icon: Database, color: 'text-orange-500' },
  sqlite: { icon: Database, color: 'text-orange-500' },

  // Package/Build
  'package.json': { icon: Package, color: 'text-red-500' },
  'package-lock.json': { icon: Lock, color: 'text-red-500' },
  'yarn.lock': { icon: Lock, color: 'text-blue-500' },
  'pnpm-lock.yaml': { icon: Lock, color: 'text-orange-500' },
  npmrc: { icon: Settings, color: 'text-red-500' },

  // Programming Languages
  py: { icon: FileCode, color: 'text-blue-500' },
  java: { icon: FileCode, color: 'text-red-500' },
  cpp: { icon: FileCode, color: 'text-blue-600' },
  c: { icon: FileCode, color: 'text-blue-600' },
  cs: { icon: FileCode, color: 'text-purple-600' },
  go: { icon: FileCode, color: 'text-cyan-500' },
  rs: { icon: FileCode, color: 'text-orange-600' },
  php: { icon: FileCode, color: 'text-purple-500' },
  rb: { icon: FileCode, color: 'text-red-600' },
  swift: { icon: FileCode, color: 'text-orange-500' },
  kt: { icon: FileCode, color: 'text-purple-500' },

  // Shell
  sh: { icon: FileCode, color: 'text-green-600' },
  bash: { icon: FileCode, color: 'text-green-600' },
  zsh: { icon: FileCode, color: 'text-green-600' },

  // Git
  gitignore: { icon: Settings, color: 'text-gray-500' },
  gitattributes: { icon: Settings, color: 'text-gray-500' }
}

export function getFileIcon(filename: string): FileIconConfig {
  const fullNameMatch = fileIconMap[filename.toLowerCase()]
  if (fullNameMatch) return fullNameMatch

  const ext = getFileExtension(filename)
  if (ext && fileIconMap[ext]) {
    return fileIconMap[ext]
  }

  return { icon: FileType, color: 'text-muted-foreground' }
}
