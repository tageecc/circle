/**
 * 将工具返回的路径规范为绝对路径（便于撤销时读写磁盘）。
 */
export function resolvePathInWorkspace(filePath: string, workspaceRoot: string | null): string {
  if (!filePath) return filePath
  if (!workspaceRoot) return filePath
  const fp = filePath.replace(/\\/g, '/')
  const root = workspaceRoot.replace(/\\/g, '/').replace(/\/$/, '')
  if (fp.startsWith(root + '/') || fp === root) return filePath
  if (/^[a-zA-Z]:\//.test(fp) || fp.startsWith('/')) return filePath
  const tail = fp.replace(/^\//, '')
  return `${root}/${tail}`
}

/**
 * 从工具执行结果解析「撤销全部」所需的基线快照（本会话内首次修改前的内容）。
 */
export function getUndoBaselineFromToolResult(
  toolName: string,
  r: Record<string, unknown> | undefined
): { baselineSnapshot: string | null; fileCreatedBySession: boolean } {
  if (!r) return { baselineSnapshot: null, fileCreatedBySession: false }

  if (toolName === 'edit_file') {
    const existed = r.fileExists !== false
    const oldContent = typeof r.oldContent === 'string' ? r.oldContent : ''
    return {
      baselineSnapshot: oldContent,
      fileCreatedBySession: !existed
    }
  }

  if (toolName === 'write') {
    const had = r.hadExistingFile === true
    const prev = typeof r.previousContent === 'string' ? r.previousContent : ''
    return {
      baselineSnapshot: had ? prev : '',
      fileCreatedBySession: !had
    }
  }

  if (toolName === 'search_replace') {
    const before = typeof r.contentBefore === 'string' ? r.contentBefore : null
    return {
      baselineSnapshot: before,
      fileCreatedBySession: false
    }
  }

  return { baselineSnapshot: null, fileCreatedBySession: false }
}
