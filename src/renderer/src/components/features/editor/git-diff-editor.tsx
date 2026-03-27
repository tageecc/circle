import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Editor, { loader } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import * as monaco from 'monaco-editor'
import * as Diff from 'diff'
import { useSettings } from '@/contexts/settings-context'
import { configureMonacoLanguages } from '@/config/monaco-languages'
import { registerMonacoThemes } from '@/config/monaco-themes'

loader.config({ monaco })

// 常量
const CONNECTOR_WIDTH = 48

interface DiffBlock {
  type: 'added' | 'removed'
  leftStart: number
  leftEnd?: number
  rightStart: number
  rightEnd?: number
}

// 合并后的 Diff 区间（用于滚动同步）
interface DiffRegion {
  leftStart: number
  leftEnd: number
  rightStart: number
  rightEnd: number
  leftIsGap: boolean // 左侧是缝隙
  rightIsGap: boolean // 右侧是缝隙
  type: 'modify' | 'removed' | 'added' // 区分三种类型
}

interface GitDiffEditorProps {
  original: string
  modified: string
  language?: string
  originalTitle?: string
  modifiedTitle?: string
  height?: string | number
  onApplyChange?: (newContent: string) => void // 应用变更回调
}

// 分割行
const splitLines = (text: string): string[] => {
  const lines = text.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines
}

// 计算差异块
const calculateDiffBlocks = (leftContent: string, rightContent: string): DiffBlock[] => {
  const diff = Diff.diffLines(leftContent, rightContent)
  const blocks: DiffBlock[] = []
  let leftLine = 1
  let rightLine = 1

  diff.forEach((part) => {
    const lines = splitLines(part.value)

    if (part.added) {
      blocks.push({
        type: 'added',
        leftStart: leftLine,
        rightStart: rightLine,
        rightEnd: rightLine + lines.length - 1
      })
      rightLine += lines.length
    } else if (part.removed) {
      blocks.push({
        type: 'removed',
        leftStart: leftLine,
        leftEnd: leftLine + lines.length - 1,
        rightStart: rightLine
      })
      leftLine += lines.length
    } else {
      leftLine += lines.length
      rightLine += lines.length
    }
  })

  return blocks
}

// 将 DiffBlocks 合并为 DiffRegions（合并 Modify 情况）
const calculateDiffRegions = (blocks: DiffBlock[]): DiffRegion[] => {
  const regions: DiffRegion[] = []

  for (let i = 0; i < blocks.length; i++) {
    const current = blocks[i]
    const next = blocks[i + 1]

    // 检测 Modify（removed + added 相邻）
    const isModify = current.type === 'removed' && next?.type === 'added'

    if (isModify) {
      regions.push({
        leftStart: current.leftStart,
        leftEnd: current.leftEnd!,
        rightStart: next.rightStart,
        rightEnd: next.rightEnd!,
        leftIsGap: false,
        rightIsGap: false,
        type: 'modify'
      })
      i++ // 跳过 next
    } else if (current.type === 'removed' && current.leftEnd) {
      // Pure Removed：左侧有内容，右侧是缝隙
      regions.push({
        leftStart: current.leftStart,
        leftEnd: current.leftEnd,
        rightStart: current.rightStart,
        rightEnd: current.rightStart,
        leftIsGap: false,
        rightIsGap: true,
        type: 'removed'
      })
    } else if (current.type === 'added' && current.rightEnd) {
      // Pure Added：右侧有内容，左侧是缝隙
      regions.push({
        leftStart: current.leftStart,
        leftEnd: current.leftStart,
        rightStart: current.rightStart,
        rightEnd: current.rightEnd,
        leftIsGap: true,
        rightIsGap: false,
        type: 'added'
      })
    }
  }

  return regions
}

export function GitDiffEditor({
  original,
  modified,
  language = 'plaintext',
  originalTitle,
  modifiedTitle,
  height = '100%',
  onApplyChange
}: GitDiffEditorProps) {
  const { t } = useTranslation()
  const resolvedOriginalTitle = originalTitle ?? t('git.diff_original_head')
  const resolvedModifiedTitle = modifiedTitle ?? t('git.diff_working_tree')
  const { editorOptions: globalOptions } = useSettings()

  const [diffBlocks, setDiffBlocks] = useState<DiffBlock[]>([])
  const [editorsReady, setEditorsReady] = useState(false)
  const [theme, setTheme] = useState<'one-dark-pro' | 'one-light'>(() => {
    const isDark = document.documentElement.classList.contains('dark')
    return isDark ? 'one-dark-pro' : 'one-light'
  })
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)

  const leftEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const rightEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const leftDecorationsRef = useRef<string[]>([])
  const rightDecorationsRef = useRef<string[]>([])
  const svgContainerRef = useRef<HTMLDivElement | null>(null)
  const scrollListenersRef = useRef<{ dispose: () => void }[]>([])
  const isSyncingScrollRef = useRef(false)
  const rafIdRef = useRef<number | null>(null)

  const diffBlocksRef = useRef<DiffBlock[]>([])
  const diffRegionsRef = useRef<DiffRegion[]>([])
  const originalRef = useRef(original)
  const modifiedRef = useRef(modified)

  // 更新内容 refs
  useEffect(() => {
    originalRef.current = original
    modifiedRef.current = modified
  }, [original, modified])

  // 应用单个 diff 区块的变更（将右侧恢复为左侧的内容）
  const applyDiffBlock = useCallback(
    (lineNumber: number) => {
      if (!onApplyChange) return

      const blocks = diffBlocksRef.current
      const originalLines = splitLines(originalRef.current)
      const modifiedLines = splitLines(modifiedRef.current)

      // 找到点击行所在的 diff 区块
      let targetBlockIndex = -1
      let isModify = false

      const leftLineCount = originalLines.length

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]
        const nextBlock = blocks[i + 1]

        // 检测 Modify（removed + added 相邻）
        if (block.type === 'removed' && nextBlock?.type === 'added') {
          if (lineNumber >= block.leftStart && lineNumber <= (block.leftEnd || block.leftStart)) {
            targetBlockIndex = i
            isModify = true
            break
          }
          i++ // 跳过 nextBlock
        } else if (block.type === 'removed' && block.leftEnd) {
          if (lineNumber >= block.leftStart && lineNumber <= block.leftEnd) {
            targetBlockIndex = i
            break
          }
        } else if (block.type === 'added') {
          // Added 的 apply 按钮在左侧缝隙位置（leftStart）
          // 对于文件末尾的添加，leftStart 可能超出左侧文件行数，此时点击最后一行也应触发
          const isAtEnd = block.leftStart > leftLineCount && lineNumber === leftLineCount
          if (lineNumber === block.leftStart || isAtEnd) {
            targetBlockIndex = i
            break
          }
        }
      }

      if (targetBlockIndex === -1) return

      const block = blocks[targetBlockIndex]
      const nextBlock = blocks[targetBlockIndex + 1]

      let newLines = [...modifiedLines]

      if (isModify && nextBlock) {
        // Modify: 用原始内容替换修改的内容
        const originalContent = originalLines.slice(block.leftStart - 1, block.leftEnd)
        const rightStartIndex = nextBlock.rightStart - 1 // 0-based
        const deleteCount = nextBlock.rightEnd! - nextBlock.rightStart + 1 // 1-based 计算删除数量
        newLines.splice(rightStartIndex, deleteCount, ...originalContent)
      } else if (block.type === 'removed' && block.leftEnd) {
        // Pure Removed: 将删除的内容插入回去
        const originalContent = originalLines.slice(block.leftStart - 1, block.leftEnd)
        const insertPosition = block.rightStart - 1 // 0-based
        newLines.splice(insertPosition, 0, ...originalContent)
      } else if (block.type === 'added' && block.rightEnd) {
        // Pure Added: 删除新增的内容
        const rightStartIndex = block.rightStart - 1 // 0-based
        const deleteCount = block.rightEnd - block.rightStart + 1 // 1-based 计算删除数量
        newLines.splice(rightStartIndex, deleteCount)
      }

      // 保留原始文件末尾的换行符状态（与 HEAD 一致）
      let result = newLines.join('\n')
      if (originalRef.current.endsWith('\n') && !result.endsWith('\n')) {
        result += '\n'
      }

      onApplyChange(result)
    },
    [onApplyChange]
  )

  // 初始化 Monaco 语言配置
  useEffect(() => {
    configureMonacoLanguages()
  }, [])

  // 主题管理
  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark')
      setTheme(isDark ? 'one-dark-pro' : 'one-light')
    }

    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // 计算差异块和区间
  useEffect(() => {
    const blocks = calculateDiffBlocks(original, modified)
    setDiffBlocks(blocks)
    diffBlocksRef.current = blocks
    diffRegionsRef.current = calculateDiffRegions(blocks)
  }, [original, modified])

  // 更新连接线
  const updateConnections = useCallback(() => {
    const container = svgContainerRef.current
    const leftEditor = leftEditorRef.current
    const rightEditor = rightEditorRef.current

    if (!container || !leftEditor || !rightEditor) return

    const regions = diffRegionsRef.current
    const leftScrollTop = leftEditor.getScrollTop()
    const rightScrollTop = rightEditor.getScrollTop()

    // 获取 CSS 变量并转换为 rgba
    const styles = getComputedStyle(document.documentElement)
    const hexToRgba = (hex: string, alpha: number) => {
      const h = hex.replace('#', '')
      const r = parseInt(h.substring(0, 2), 16)
      const g = parseInt(h.substring(2, 4), 16)
      const b = parseInt(h.substring(4, 6), 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }

    const primaryColor = styles.getPropertyValue('--primary').trim()
    const mutedFgColor = styles.getPropertyValue('--muted-foreground').trim()
    const chart2Color = styles.getPropertyValue('--chart-2').trim()

    // 根据类型获取颜色（使用 CSS 变量转换）
    const getFillColor = (type: 'modify' | 'removed' | 'added') => {
      switch (type) {
        case 'modify':
          return hexToRgba(primaryColor, 0.2)
        case 'removed':
          return hexToRgba(mutedFgColor, 0.25)
        case 'added':
          return hexToRgba(chart2Color, 0.28)
      }
    }

    let svg = container.querySelector('svg')
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('class', 'absolute inset-0 w-full h-full pointer-events-none')
      container.appendChild(svg)
    }

    svg.innerHTML = ''

    const GAP_LINE_HEIGHT = 2 // 缝隙线高度，与 CSS border-top 一致

    for (const region of regions) {
      const leftTop = leftEditor.getTopForLineNumber(region.leftStart) - leftScrollTop
      // 如果左侧是缝隙，给2像素高度以匹配编辑器中的 border-top
      const leftBottom = region.leftIsGap
        ? leftTop + GAP_LINE_HEIGHT
        : leftEditor.getTopForLineNumber(region.leftEnd + 1) - leftScrollTop

      const rightTop = rightEditor.getTopForLineNumber(region.rightStart) - rightScrollTop
      // 如果右侧是缝隙，给2像素高度以匹配编辑器中的 border-top
      const rightBottom = region.rightIsGap
        ? rightTop + GAP_LINE_HEIGHT
        : rightEditor.getTopForLineNumber(region.rightEnd + 1) - rightScrollTop

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      const midX = CONNECTOR_WIDTH / 2
      const d = `
        M 0,${leftTop}
        C ${midX},${leftTop} ${midX},${rightTop} ${CONNECTOR_WIDTH},${rightTop}
        L ${CONNECTOR_WIDTH},${rightBottom}
        C ${midX},${rightBottom} ${midX},${leftBottom} 0,${leftBottom}
        Z
      `

      path.setAttribute('d', d)
      path.setAttribute('fill', getFillColor(region.type))
      path.setAttribute('stroke', 'none')
      svg.appendChild(path)
    }
  }, [])

  // 滚动同步
  const handleScrollSync = useCallback(
    (sourceEditor: editor.IStandaloneCodeEditor, isLeft: boolean) => {
      const targetEditor = isLeft ? rightEditorRef.current : leftEditorRef.current
      if (!targetEditor || isSyncingScrollRef.current) return

      const scrollTop = sourceEditor.getScrollTop()
      const regions = diffRegionsRef.current
      const lineHeight = sourceEditor.getOption(monaco.editor.EditorOption.lineHeight)

      let sourceAccum = 0
      let targetAccum = 0
      let currentSourceLine = 1
      let targetScrollTop = scrollTop

      for (const region of regions) {
        const regionSourceStart = isLeft ? region.leftStart : region.rightStart
        const regionSourceEnd = isLeft ? region.leftEnd : region.rightEnd
        const regionTargetStart = isLeft ? region.rightStart : region.leftStart
        const regionTargetEnd = isLeft ? region.rightEnd : region.leftEnd

        // 正常区域（Region 之前）
        const normalLines = regionSourceStart - currentSourceLine
        const normalHeight = normalLines * lineHeight

        if (scrollTop < sourceAccum + normalHeight) {
          // 在正常区域内
          const delta = scrollTop - sourceAccum
          targetScrollTop = targetAccum + delta
          break
        }

        sourceAccum += normalHeight
        targetAccum += normalHeight
        currentSourceLine = regionSourceStart

        // Diff Region
        // 如果是缝隙，高度为0
        const sourceIsGap = isLeft ? region.leftIsGap : region.rightIsGap
        const targetIsGap = isLeft ? region.rightIsGap : region.leftIsGap

        const sourceRegionLines = sourceIsGap ? 0 : regionSourceEnd - regionSourceStart + 1
        const targetRegionLines = targetIsGap ? 0 : regionTargetEnd - regionTargetStart + 1
        const sourceRegionHeight = sourceRegionLines * lineHeight
        const targetRegionHeight = targetRegionLines * lineHeight

        if (scrollTop < sourceAccum + sourceRegionHeight) {
          // 在 Diff Region 内
          const progress = (scrollTop - sourceAccum) / sourceRegionHeight
          targetScrollTop = targetAccum + progress * targetRegionHeight
          break
        }

        sourceAccum += sourceRegionHeight
        targetAccum += targetRegionHeight
        currentSourceLine = regionSourceEnd + 1

        // 如果是最后一个 region，处理剩余部分
        if (region === regions[regions.length - 1]) {
          const delta = scrollTop - sourceAccum
          targetScrollTop = targetAccum + delta
        }
      }

      // 如果没有 regions，直接 1:1 同步
      if (regions.length === 0) {
        targetScrollTop = scrollTop
      }

      isSyncingScrollRef.current = true
      targetEditor.setScrollTop(targetScrollTop)

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }
      rafIdRef.current = requestAnimationFrame(() => {
        updateConnections()
        isSyncingScrollRef.current = false
      })
    },
    [updateConnections]
  )

  // 编辑器挂载前注册主题
  const handleBeforeMount = useCallback(
    (monacoInstance: typeof monaco) => {
      registerMonacoThemes(monacoInstance)
      monacoInstance.editor.setTheme(theme)
    },
    [theme]
  )

  // 编辑器挂载
  const handleEditorMount = useCallback(
    (editor: editor.IStandaloneCodeEditor, isLeft: boolean) => {
      if (isLeft) {
        leftEditorRef.current = editor
      } else {
        rightEditorRef.current = editor
      }

      if (leftEditorRef.current && rightEditorRef.current) {
        setEditorsReady(true)
        requestAnimationFrame(updateConnections)
      }

      const scrollDisposable = editor.onDidScrollChange(() => {
        handleScrollSync(editor, isLeft)
      })
      scrollListenersRef.current.push(scrollDisposable)

      // 左侧编辑器：监听 glyph margin 点击和 hover（Apply 按钮）
      if (isLeft && onApplyChange) {
        // 点击事件
        const mouseDownDisposable = editor.onMouseDown((e) => {
          if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
            const lineNumber = e.target.position?.lineNumber
            if (lineNumber) {
              applyDiffBlock(lineNumber)
            }
          }
        })
        scrollListenersRef.current.push(mouseDownDisposable)

        // Hover 事件（显示 tooltip）
        const mouseMoveDisposable = editor.onMouseMove((e) => {
          if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
            const element = e.target.element
            if (element?.classList.contains('git-diff-apply-btn')) {
              const rect = element.getBoundingClientRect()
              setTooltip({ x: rect.right + 8, y: rect.top + rect.height / 2 })
              return
            }
          }
          setTooltip(null)
        })
        scrollListenersRef.current.push(mouseMoveDisposable)

        // 离开编辑器时隐藏 tooltip
        const mouseLeaveDisposable = editor.onMouseLeave(() => {
          setTooltip(null)
        })
        scrollListenersRef.current.push(mouseLeaveDisposable)
      }
    },
    [handleScrollSync, updateConnections, onApplyChange, applyDiffBlock]
  )

  // 清理
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }
      scrollListenersRef.current.forEach((disposable) => disposable?.dispose())
      scrollListenersRef.current = []

      if (leftEditorRef.current && leftDecorationsRef.current.length > 0) {
        try {
          leftEditorRef.current.deltaDecorations(leftDecorationsRef.current, [])
        } catch {}
      }
      if (rightEditorRef.current && rightDecorationsRef.current.length > 0) {
        try {
          rightEditorRef.current.deltaDecorations(rightDecorationsRef.current, [])
        } catch {}
      }

      leftEditorRef.current = null
      rightEditorRef.current = null
      leftDecorationsRef.current = []
      rightDecorationsRef.current = []
    }
  }, [])

  // 应用 diff 装饰器
  useEffect(() => {
    if (!editorsReady || !leftEditorRef.current || !rightEditorRef.current) return

    const leftDecorations: editor.IModelDeltaDecoration[] = []
    const rightDecorations: editor.IModelDeltaDecoration[] = []

    // 使用 diffBlocks 但需要判断是 Modify、Pure Removed 还是 Pure Added
    for (let i = 0; i < diffBlocks.length; i++) {
      const block = diffBlocks[i]
      const nextBlock = diffBlocks[i + 1]

      // 检测 Modify（removed + added 相邻）
      const isModify = block.type === 'removed' && nextBlock?.type === 'added'

      if (isModify) {
        // Modify: 左右都用同一个色系（蓝色）
        if (block.leftEnd) {
          for (let j = block.leftStart; j <= block.leftEnd; j++) {
            leftDecorations.push({
              range: new monaco.Range(j, 1, j, 1),
              options: {
                isWholeLine: true,
                className: 'git-diff-line-modified',
                marginClassName: 'git-diff-gutter-modified',
                // 在 diff 区块起始行显示 Apply 按钮
                glyphMarginClassName:
                  j === block.leftStart && onApplyChange ? 'git-diff-apply-btn' : undefined
              }
            })
          }
        }
        if (nextBlock.rightEnd) {
          for (let j = nextBlock.rightStart; j <= nextBlock.rightEnd; j++) {
            rightDecorations.push({
              range: new monaco.Range(j, 1, j, 1),
              options: {
                isWholeLine: true,
                className: 'git-diff-line-modified',
                marginClassName: 'git-diff-gutter-modified'
              }
            })
          }
        }
        i++ // 跳过 nextBlock
      } else if (block.type === 'removed' && block.leftEnd) {
        // Pure Removed: 灰色（左侧有代码，右侧是缝隙）
        for (let j = block.leftStart; j <= block.leftEnd; j++) {
          leftDecorations.push({
            range: new monaco.Range(j, 1, j, 1),
            options: {
              isWholeLine: true,
              className: 'git-diff-line-removed',
              marginClassName: 'git-diff-gutter-removed',
              // 在 diff 区块起始行显示 Apply 按钮
              glyphMarginClassName:
                j === block.leftStart && onApplyChange ? 'git-diff-apply-btn' : undefined
            }
          })
        }
        // 右侧缝隙位置添加线标记（内容区域 + 行号区域）
        rightDecorations.push({
          range: new monaco.Range(block.rightStart, 1, block.rightStart, 1),
          options: {
            isWholeLine: true,
            className: 'git-diff-gap-line-removed',
            marginClassName: 'git-diff-gap-gutter-removed'
          }
        })
      } else if (block.type === 'added' && block.rightEnd) {
        // Pure Added: 绿色（左侧是缝隙，右侧有代码）
        for (let j = block.rightStart; j <= block.rightEnd; j++) {
          rightDecorations.push({
            range: new monaco.Range(j, 1, j, 1),
            options: {
              isWholeLine: true,
              className: 'git-diff-line-added',
              marginClassName: 'git-diff-gutter-added'
            }
          })
        }
        // 左侧缝隙位置添加线标记 + Apply 按钮
        leftDecorations.push({
          range: new monaco.Range(block.leftStart, 1, block.leftStart, 1),
          options: {
            isWholeLine: true,
            className: 'git-diff-gap-line-added',
            marginClassName: 'git-diff-gap-gutter-added',
            glyphMarginClassName: onApplyChange ? 'git-diff-apply-btn' : undefined
          }
        })
      }
    }

    leftDecorationsRef.current = leftEditorRef.current.deltaDecorations(
      leftDecorationsRef.current,
      leftDecorations
    )
    rightDecorationsRef.current = rightEditorRef.current.deltaDecorations(
      rightDecorationsRef.current,
      rightDecorations
    )

    requestAnimationFrame(updateConnections)
  }, [diffBlocks, editorsReady, updateConnections, onApplyChange])

  // 编辑器配置
  const editorOptions = useMemo(
    () => ({
      readOnly: true,
      fontSize: globalOptions?.fontSize || 13,
      scrollBeyondLastLine: false,
      minimap: { enabled: false },
      lineNumbers: 'on' as const,
      folding: false,
      lineDecorationsWidth: 5,
      lineNumbersMinChars: 3,
      renderLineHighlight: 'none' as const,
      wordWrap: 'off' as const,
      automaticLayout: true,
      smoothScrolling: false, // 禁用平滑滚动以避免延迟
      renderWhitespace: 'none' as const,
      renderControlCharacters: false
    }),
    [globalOptions?.fontSize]
  )

  const leftEditorOptions = useMemo(
    () => ({
      ...editorOptions,
      glyphMargin: !!onApplyChange, // 有回调时启用 glyph margin
      scrollbar: {
        vertical: 'hidden' as const,
        horizontal: 'hidden' as const,
        useShadows: false
      }
    }),
    [editorOptions, onApplyChange]
  )

  const rightEditorOptions = useMemo(
    () => ({
      ...editorOptions,
      glyphMargin: false,
      scrollbar: {
        vertical: 'visible' as const,
        horizontal: 'visible' as const,
        useShadows: false,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
      }
    }),
    [editorOptions]
  )

  return (
    <div className="git-diff-editor flex flex-col h-full w-full" style={{ height }}>
      {/* 标题栏 */}
      <div className="flex border-b border-border shrink-0">
        <div className="flex-1 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-muted/30">
          {resolvedOriginalTitle}
        </div>
        <div className="bg-muted/50 shrink-0" style={{ width: CONNECTOR_WIDTH }} />
        <div className="flex-1 px-3 py-2 text-xs font-medium text-green-600 dark:text-green-400 bg-muted/30">
          {resolvedModifiedTitle}
        </div>
      </div>

      {/* 编辑器区域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧编辑器 */}
        <div className="flex-1 h-full overflow-hidden">
          <Editor
            value={original}
            language={language}
            theme={theme}
            beforeMount={handleBeforeMount}
            onMount={(editor) => handleEditorMount(editor, true)}
            options={leftEditorOptions}
          />
        </div>

        {/* 中间连接区域 */}
        <div
          ref={svgContainerRef}
          className="relative bg-muted/30 shrink-0"
          style={{ width: CONNECTOR_WIDTH }}
        />

        {/* 右侧编辑器 */}
        <div className="flex-1 h-full overflow-hidden">
          <Editor
            value={modified}
            language={language}
            theme={theme}
            beforeMount={handleBeforeMount}
            onMount={(editor) => handleEditorMount(editor, false)}
            options={rightEditorOptions}
          />
        </div>
      </div>

      {/* Diff 样式 - 使用 CSS 变量和 color-mix，符合项目规范 */}
      <style>{`
        .git-diff-editor .monaco-editor {
          /* 修改的行 - 使用 primary 蓝色 */
          & .git-diff-line-modified,
          & .git-diff-gutter-modified {
            background-color: color-mix(in srgb, var(--primary) 20%, transparent) !important;
          }
          
          /* 纯删除的行 - 使用 muted 灰色 */
          & .git-diff-line-removed,
          & .git-diff-gutter-removed {
            background-color: color-mix(in srgb, var(--muted-foreground) 25%, transparent) !important;
          }
          
          /* 纯新增的行 - 使用 chart-2 绿色 */
          & .git-diff-line-added,
          & .git-diff-gutter-added {
            background-color: color-mix(in srgb, var(--chart-2) 28%, transparent) !important;
          }
          
          /* 缝隙标记线 - 透明度与背景色一致 */
          & .git-diff-gap-line-removed,
          & .git-diff-gap-gutter-removed {
            border-top: 2px solid color-mix(in srgb, var(--muted-foreground) 25%, transparent) !important;
          }
          & .git-diff-gap-line-added,
          & .git-diff-gap-gutter-added {
            border-top: 2px solid color-mix(in srgb, var(--chart-2) 28%, transparent) !important;
          }
          
          /* Apply 按钮 - WebStorm 风格的 >> */
          & .git-diff-apply-btn {
            cursor: pointer !important;
            &::before {
              content: '»' !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              width: 100% !important;
              height: 100% !important;
              font-size: 18px !important;
              font-weight: bold !important;
              color: var(--primary) !important;
              text-shadow: 0 0 1px var(--primary) !important;
              transition: opacity 0.15s, transform 0.15s, text-shadow 0.15s !important;
            }
            &:hover::before {
              transform: scale(1.15) !important;
              text-shadow: 0 0 4px var(--primary) !important;
            }
          }
        }
      `}</style>

      {/* Revert Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2.5 py-1.5 text-xs font-medium bg-popover text-popover-foreground border border-border rounded-md shadow-md whitespace-nowrap"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translateY(-50%)'
          }}
        >
          <div>{t('git.diff_revert_title')}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{t('git.diff_revert_hint')}</div>
        </div>
      )}
    </div>
  )
}
