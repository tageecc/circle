import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Editor, { loader } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import * as monaco from 'monaco-editor'
import * as Diff from 'diff'
import { useSettings } from '@/contexts/settings-context'
import { configureMonacoLanguages } from '@/config/monaco-languages'
import { registerMonacoThemes } from '@/config/monaco-themes'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Check, X, AlertTriangle } from 'lucide-react'

loader.config({ monaco })

// 常量 - WebStorm 风格布局
const CURVE_WIDTH = 32 // 曲线连接区域宽度
const BUTTON_WIDTH = 36 // 按钮区域宽度
const BUTTON_BLOCK_MIN_HEIGHT = 20 // 按钮块最小高度

// HSL 颜色转 RGBA（用于连接线填充）
const hslToRgba = (hsl: string, alpha: number): string => {
  // CSS 变量可能是 "h s% l%" 或 "#hex" 格式
  const trimmed = hsl.trim()
  if (trimmed.startsWith('#')) {
    const h = trimmed.replace('#', '')
    const r = parseInt(h.substring(0, 2), 16)
    const g = parseInt(h.substring(2, 4), 16)
    const b = parseInt(h.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  // 处理 HSL 格式 "h s% l%"
  return `hsla(${trimmed.replace(/ /g, ', ')}, ${alpha})`
}

interface DiffRegion {
  id: string
  oursStartLine: number
  oursEndLine: number
  theirsStartLine: number
  theirsEndLine: number
  resultStartLine: number
  resultEndLine: number
  oursContent: string[]
  theirsContent: string[]
  baseContent: string[]
  // 变更来源：ours=只有OURS改了, theirs=只有THEIRS改了, both=两边都改了(冲突)
  source: 'ours' | 'theirs' | 'both'
}

interface GitMergeEditorProps {
  ours: string
  theirs: string
  base: string
  language?: string
  oursTitle?: string
  theirsTitle?: string
  resultTitle?: string
  height?: string | number
  onSave?: (resolvedContent: string) => void
  onCancel?: () => void
}

// Undo/Redo 状态快照（用于支持撤销恢复）
interface StateSnapshot {
  result: string
  appliedSides: Map<string, 'none' | 'left' | 'right' | 'both'>
  resolvedIds: Set<string>
  lineOffsets: Map<string, number>
}

// 分割行
const splitLines = (text: string): string[] => {
  if (!text) return []
  return text.split('\n')
}

// 计算实际行数（不包含末尾换行符产生的空行）
const getLineCount = (text: string): number => {
  if (!text) return 0
  // 按换行符分割后，如果最后一个是空字符串（末尾有换行），不计入行数
  const lines = text.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    return lines.length - 1
  }
  return lines.length
}

// 获取实际内容行（不包含末尾换行符产生的空行）
const getContentLines = (text: string): string[] => {
  if (!text) return []
  const lines = text.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    return lines.slice(0, -1)
  }
  return lines
}

// 提取单方变更
interface SingleChange {
  baseLine: number
  baseEndLine: number
  targetLine: number
  targetEndLine: number
  baseContent: string[]
  targetContent: string[]
}

// 从 diff 结果提取变更
const extractChangesFromDiff = (diff: Diff.Change[]): SingleChange[] => {
  const changes: SingleChange[] = []
  let baseLine = 1
  let targetLine = 1

  for (let i = 0; i < diff.length; i++) {
    const part = diff[i]
    const lineCount = getLineCount(part.value)
    const contentLines = getContentLines(part.value)

    if (part.removed) {
      const nextPart = diff[i + 1]
      if (nextPart?.added) {
        // Modify
        const nextLineCount = getLineCount(nextPart.value)
        const nextContentLines = getContentLines(nextPart.value)

        changes.push({
          baseLine,
          baseEndLine: baseLine + lineCount - 1,
          targetLine,
          targetEndLine: targetLine + nextLineCount - 1,
          baseContent: contentLines,
          targetContent: nextContentLines
        })

        baseLine += lineCount
        targetLine += nextLineCount
        i++
      } else {
        // Removed from target
        changes.push({
          baseLine,
          baseEndLine: baseLine + lineCount - 1,
          targetLine,
          targetEndLine: targetLine - 1,
          baseContent: contentLines,
          targetContent: []
        })
        baseLine += lineCount
      }
    } else if (part.added) {
      // Added in target
      changes.push({
        baseLine,
        baseEndLine: baseLine - 1,
        targetLine,
        targetEndLine: targetLine + lineCount - 1,
        baseContent: [],
        targetContent: contentLines
      })
      targetLine += lineCount
    } else {
      baseLine += lineCount
      targetLine += lineCount
    }
  }

  return changes
}

// 检查两个变更是否重叠（基于 BASE 的行号）
const changesOverlap = (c1: SingleChange, c2: SingleChange): boolean => {
  const start1 = c1.baseLine
  const end1 = Math.max(c1.baseLine, c1.baseEndLine)
  const start2 = c2.baseLine
  const end2 = Math.max(c2.baseLine, c2.baseEndLine)
  return start1 <= end2 && start2 <= end1
}

// 三方合并：比较 OURS vs BASE 和 THEIRS vs BASE
const calculateDiffRegions = (
  oursContent: string,
  theirsContent: string,
  baseContent: string
): DiffRegion[] => {
  // 如果没有 base，回退到简单的二方比较
  if (!baseContent) {
    return calculateTwoWayDiff(oursContent, theirsContent)
  }

  // 计算 OURS 相对于 BASE 的变更
  const oursDiff = Diff.diffLines(baseContent, oursContent)
  const oursChanges = extractChangesFromDiff(oursDiff)

  // 计算 THEIRS 相对于 BASE 的变更
  const theirsDiff = Diff.diffLines(baseContent, theirsContent)
  const theirsChanges = extractChangesFromDiff(theirsDiff)

  const regions: DiffRegion[] = []
  let regionId = 0

  const processedOurs = new Set<number>()
  const processedTheirs = new Set<number>()

  // 先找出冲突（两边都在同一位置有变更）
  for (let i = 0; i < oursChanges.length; i++) {
    const oursChange = oursChanges[i]

    for (let j = 0; j < theirsChanges.length; j++) {
      if (processedTheirs.has(j)) continue

      const theirsChange = theirsChanges[j]

      if (changesOverlap(oursChange, theirsChange)) {
        // 冲突：两边都改了同一区域
        processedOurs.add(i)
        processedTheirs.add(j)

        regions.push({
          id: `region-${regionId++}`,
          oursStartLine: oursChange.targetLine,
          oursEndLine: Math.max(oursChange.targetLine, oursChange.targetEndLine),
          theirsStartLine: theirsChange.targetLine,
          theirsEndLine: Math.max(theirsChange.targetLine, theirsChange.targetEndLine),
          resultStartLine: oursChange.baseLine, // Result 初始是 BASE
          resultEndLine: Math.max(oursChange.baseLine, oursChange.baseEndLine),
          oursContent: oursChange.targetContent,
          theirsContent: theirsChange.targetContent,
          baseContent: oursChange.baseContent,
          source: 'both'
        })
      }
    }
  }

  // 处理只有 OURS 改了的区域
  for (let i = 0; i < oursChanges.length; i++) {
    if (processedOurs.has(i)) continue

    const change = oursChanges[i]
    regions.push({
      id: `region-${regionId++}`,
      oursStartLine: change.targetLine,
      oursEndLine: Math.max(change.targetLine, change.targetEndLine),
      theirsStartLine: change.baseLine, // THEIRS 没改，位置同 BASE
      theirsEndLine: Math.max(change.baseLine, change.baseEndLine),
      resultStartLine: change.baseLine, // Result 初始是 BASE
      resultEndLine: Math.max(change.baseLine, change.baseEndLine),
      oursContent: change.targetContent,
      theirsContent: change.baseContent, // THEIRS 内容同 BASE
      baseContent: change.baseContent,
      source: 'ours'
    })
  }

  // 处理只有 THEIRS 改了的区域
  for (let j = 0; j < theirsChanges.length; j++) {
    if (processedTheirs.has(j)) continue

    const change = theirsChanges[j]
    regions.push({
      id: `region-${regionId++}`,
      oursStartLine: change.baseLine, // OURS 没改，位置同 BASE
      oursEndLine: Math.max(change.baseLine, change.baseEndLine),
      theirsStartLine: change.targetLine,
      theirsEndLine: Math.max(change.targetLine, change.targetEndLine),
      resultStartLine: change.baseLine, // Result 初始是 BASE
      resultEndLine: Math.max(change.baseLine, change.baseEndLine),
      oursContent: change.baseContent, // OURS 内容同 BASE
      theirsContent: change.targetContent,
      baseContent: change.baseContent,
      source: 'theirs'
    })
  }

  // 按 resultStartLine 排序
  regions.sort((a, b) => a.resultStartLine - b.resultStartLine)

  return regions
}

// 简单的二方 diff（当没有 base 时使用）
const calculateTwoWayDiff = (oursContent: string, theirsContent: string): DiffRegion[] => {
  const diff = Diff.diffLines(oursContent, theirsContent)
  const regions: DiffRegion[] = []

  let oursLine = 1
  let theirsLine = 1
  let regionId = 0

  for (let i = 0; i < diff.length; i++) {
    const part = diff[i]
    const contentLines = getContentLines(part.value)
    const lineCount = getLineCount(part.value)

    if (part.removed) {
      const nextPart = diff[i + 1]
      if (nextPart?.added) {
        const nextContentLines = getContentLines(nextPart.value)
        const nextLineCount = getLineCount(nextPart.value)

        regions.push({
          id: `region-${regionId++}`,
          oursStartLine: oursLine,
          oursEndLine: oursLine + lineCount - 1,
          theirsStartLine: theirsLine,
          theirsEndLine: theirsLine + nextLineCount - 1,
          resultStartLine: oursLine,
          resultEndLine: oursLine + lineCount - 1,
          oursContent: contentLines,
          theirsContent: nextContentLines,
          baseContent: [],
          source: 'both'
        })

        oursLine += lineCount
        theirsLine += nextLineCount
        i++
      } else {
        regions.push({
          id: `region-${regionId++}`,
          oursStartLine: oursLine,
          oursEndLine: oursLine + lineCount - 1,
          theirsStartLine: theirsLine,
          theirsEndLine: theirsLine - 1,
          resultStartLine: oursLine,
          resultEndLine: oursLine + lineCount - 1,
          oursContent: contentLines,
          theirsContent: [],
          baseContent: [],
          source: 'both'
        })
        oursLine += lineCount
      }
    } else if (part.added) {
      regions.push({
        id: `region-${regionId++}`,
        oursStartLine: oursLine,
        oursEndLine: oursLine - 1,
        theirsStartLine: theirsLine,
        theirsEndLine: theirsLine + lineCount - 1,
        resultStartLine: oursLine,
        resultEndLine: oursLine - 1,
        oursContent: [],
        theirsContent: contentLines,
        baseContent: [],
        source: 'both'
      })
      theirsLine += lineCount
    } else {
      oursLine += lineCount
      theirsLine += lineCount
    }
  }

  return regions
}

export function GitMergeEditor({
  ours,
  theirs,
  base,
  language = 'plaintext',
  oursTitle = 'Changes from HEAD',
  theirsTitle = 'Changes from incoming',
  resultTitle = 'Result',
  // 标题样式同 WebStorm：左侧显示当前分支变更，中间显示结果，右侧显示传入分支变更
  height = '100%',
  onSave,
  onCancel
}: GitMergeEditorProps) {
  const { editorOptions: globalOptions } = useSettings()

  // 计算初始 regions（使用三方合并）
  const initialRegions = useMemo(
    () => calculateDiffRegions(ours, theirs, base),
    [ours, theirs, base]
  )

  // 状态 - Result 初始化为 BASE（WebStorm 风格）
  const [result, setResult] = useState(base || ours)
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())
  // 追踪每个 region 已应用的方向：none=未应用, left=已应用左侧, right=已应用右侧, both=两侧都应用了
  const [appliedSides, setAppliedSides] = useState<Map<string, 'none' | 'left' | 'right' | 'both'>>(
    new Map()
  )
  const [editorsReady, setEditorsReady] = useState(0)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // 状态快照历史
  const historyRef = useRef<StateSnapshot[]>([
    // 初始状态快照
    {
      result: base || ours,
      appliedSides: new Map(),
      resolvedIds: new Set(),
      lineOffsets: new Map()
    }
  ])
  const [theme, setTheme] = useState<'one-dark-pro' | 'one-light'>(() => {
    const isDark = document.documentElement.classList.contains('dark')
    return isDark ? 'one-dark-pro' : 'one-light'
  })

  // 未解决的 regions
  const unresolvedRegions = useMemo(
    () => initialRegions.filter((r) => !resolvedIds.has(r.id)),
    [initialRegions, resolvedIds]
  )

  // 编辑器 refs
  const leftEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const centerEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const rightEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const leftDecorationsRef = useRef<string[]>([])
  const centerDecorationsRef = useRef<string[]>([])
  const rightDecorationsRef = useRef<string[]>([])
  // 曲线连接区域
  const leftCurveRef = useRef<HTMLDivElement | null>(null)
  const rightCurveRef = useRef<HTMLDivElement | null>(null)
  // 按钮区域
  const leftButtonsRef = useRef<HTMLDivElement | null>(null)
  const rightButtonsRef = useRef<HTMLDivElement | null>(null)
  const scrollListenersRef = useRef<{ dispose: () => void }[]>([])
  const isSyncingScrollRef = useRef(false)
  const rafIdRef = useRef<number | null>(null)

  // Result 行偏移追踪（用于计算 Result 中的实际行号）
  const lineOffsetsRef = useRef<Map<string, number>>(new Map())

  // 用于避免闭包陷阱的 refs
  const unresolvedRegionsRef = useRef(unresolvedRegions)
  const appliedSidesRef = useRef(appliedSides)
  const getResultLineForRegionRef = useRef<(region: DiffRegion) => number>(() => 0)
  const acceptLeftRef = useRef<(region: DiffRegion) => void>(() => {})
  const acceptRightRef = useRef<(region: DiffRegion) => void>(() => {})

  const allEditorsReady = editorsReady >= 3

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

  // 计算 Result 中某个 region 的实际起始行
  const getResultLineForRegion = useCallback(
    (region: DiffRegion): number => {
      let offset = 0
      for (const r of initialRegions) {
        if (r.id === region.id) break
        // 检查是否有偏移记录（包括部分应用和完全解决的情况）
        const storedOffset = lineOffsetsRef.current.get(r.id)
        if (storedOffset !== undefined) {
          offset += storedOffset
        }
      }
      // Result 初始是 BASE，使用 resultStartLine（BASE 的行号）
      return region.resultStartLine + offset
    },
    [initialRegions]
  )

  // 同步更新 refs
  useEffect(() => {
    unresolvedRegionsRef.current = unresolvedRegions
  }, [unresolvedRegions])

  useEffect(() => {
    appliedSidesRef.current = appliedSides
  }, [appliedSides])

  useEffect(() => {
    getResultLineForRegionRef.current = getResultLineForRegion
  }, [getResultLineForRegion])

  // Redo 栈
  const redoStackRef = useRef<StateSnapshot[]>([])

  // 当切换冲突文件时重置所有状态（但保留 editorsReady，因为编辑器不会重新挂载）
  useEffect(() => {
    const initialContent = base || ours
    setResult(initialContent)
    setResolvedIds(new Set())
    setAppliedSides(new Map())
    lineOffsetsRef.current = new Map()
    historyRef.current = [
      {
        result: initialContent,
        appliedSides: new Map(),
        resolvedIds: new Set(),
        lineOffsets: new Map()
      }
    ]
    redoStackRef.current = []

    // 清理连接线和按钮区域
    if (leftCurveRef.current) leftCurveRef.current.innerHTML = ''
    if (rightCurveRef.current) rightCurveRef.current.innerHTML = ''
    if (leftButtonsRef.current) leftButtonsRef.current.innerHTML = ''
    if (rightButtonsRef.current) rightButtonsRef.current.innerHTML = ''
  }, [ours, theirs, base])

  // 保存当前状态快照（在应用操作前调用）
  const saveSnapshot = useCallback(() => {
    historyRef.current.push({
      result,
      appliedSides: new Map(appliedSides),
      resolvedIds: new Set(resolvedIds),
      lineOffsets: new Map(lineOffsetsRef.current)
    })
    // 新操作会清空 redo 栈
    redoStackRef.current = []
  }, [result, appliedSides, resolvedIds])

  // 接受左侧（OURS）- 将 OURS 内容应用到 Result
  const acceptLeft = useCallback(
    (region: DiffRegion) => {
      // 保存快照（用于 Undo 恢复）
      saveSnapshot()

      const startLine = getResultLineForRegionRef.current(region)
      const currentApplied = appliedSides.get(region.id) || 'none'

      setResult((prevResult) => {
        const resultLines = splitLines(prevResult)

        if (currentApplied === 'right') {
          // 右侧已应用，追加左侧内容到后面
          const currentOffset = lineOffsetsRef.current.get(region.id) || 0
          resultLines.splice(startLine - 1 + region.theirsContent.length, 0, ...region.oursContent)

          const newOffset = currentOffset + region.oursContent.length
          lineOffsetsRef.current.set(region.id, newOffset)
        } else {
          // 首次应用或替换
          const deleteCount = region.baseContent.length
          const insertContent = region.oursContent
          resultLines.splice(startLine - 1, deleteCount, ...insertContent)

          const offset = insertContent.length - deleteCount
          lineOffsetsRef.current.set(region.id, offset)
        }

        return resultLines.join('\n')
      })

      setAppliedSides((prev) => {
        const newMap = new Map(prev)
        if (currentApplied === 'right') {
          newMap.set(region.id, 'both')
          setResolvedIds((prev) => new Set([...prev, region.id]))
        } else {
          newMap.set(region.id, 'left')
        }
        return newMap
      })
    },
    [appliedSides, saveSnapshot]
  )

  // 接受右侧（THEIRS）- 将 THEIRS 内容应用到 Result
  const acceptRight = useCallback(
    (region: DiffRegion) => {
      // 保存快照（用于 Undo 恢复）
      saveSnapshot()

      const startLine = getResultLineForRegionRef.current(region)
      const currentApplied = appliedSides.get(region.id) || 'none'

      setResult((prevResult) => {
        const resultLines = splitLines(prevResult)

        if (currentApplied === 'left') {
          // 左侧已应用，追加右侧内容到后面
          resultLines.splice(startLine - 1 + region.oursContent.length, 0, ...region.theirsContent)

          const currentOffset = lineOffsetsRef.current.get(region.id) || 0
          const newOffset = currentOffset + region.theirsContent.length
          lineOffsetsRef.current.set(region.id, newOffset)
        } else {
          // 首次应用或替换
          const deleteCount = region.baseContent.length
          const insertContent = region.theirsContent
          resultLines.splice(startLine - 1, deleteCount, ...insertContent)

          const offset = insertContent.length - deleteCount
          lineOffsetsRef.current.set(region.id, offset)
        }

        return resultLines.join('\n')
      })

      setAppliedSides((prev) => {
        const newMap = new Map(prev)
        if (currentApplied === 'left') {
          newMap.set(region.id, 'both')
          setResolvedIds((prev) => new Set([...prev, region.id]))
        } else {
          newMap.set(region.id, 'right')
        }
        return newMap
      })
    },
    [appliedSides, saveSnapshot]
  )

  // 忽略左侧（OURS）的更改 - 保持 BASE 内容不变
  const ignoreLeft = useCallback(
    (region: DiffRegion) => {
      saveSnapshot()

      const currentApplied = appliedSides.get(region.id) || 'none'
      const shouldResolve = currentApplied === 'right' || region.source === 'ours'

      setAppliedSides((prev) => {
        const newMap = new Map(prev)
        newMap.set(region.id, currentApplied === 'right' ? 'both' : 'left')
        return newMap
      })

      if (shouldResolve) {
        setResolvedIds((prev) => new Set([...prev, region.id]))
        // 忽略操作不改变 Result 内容，offset 为 0
        lineOffsetsRef.current.set(region.id, 0)
      }
    },
    [appliedSides, saveSnapshot]
  )

  // 忽略右侧（THEIRS）的更改 - 保持 BASE 内容不变
  const ignoreRight = useCallback(
    (region: DiffRegion) => {
      saveSnapshot()

      const currentApplied = appliedSides.get(region.id) || 'none'
      const shouldResolve = currentApplied === 'left' || region.source === 'theirs'

      setAppliedSides((prev) => {
        const newMap = new Map(prev)
        newMap.set(region.id, currentApplied === 'left' ? 'both' : 'right')
        return newMap
      })

      if (shouldResolve) {
        setResolvedIds((prev) => new Set([...prev, region.id]))
        // 忽略操作不改变 Result 内容，offset 为 0
        lineOffsetsRef.current.set(region.id, 0)
      }
    },
    [appliedSides, saveSnapshot]
  )

  const ignoreLeftRef = useRef<(region: DiffRegion) => void>(() => {})
  const ignoreRightRef = useRef<(region: DiffRegion) => void>(() => {})

  // 同步更新 accept refs
  useEffect(() => {
    acceptLeftRef.current = acceptLeft
  }, [acceptLeft])

  useEffect(() => {
    acceptRightRef.current = acceptRight
  }, [acceptRight])

  useEffect(() => {
    ignoreLeftRef.current = ignoreLeft
  }, [ignoreLeft])

  useEffect(() => {
    ignoreRightRef.current = ignoreRight
  }, [ignoreRight])

  // 更新连接线和按钮（WebStorm 风格：曲线和按钮分离）
  const updateConnections = useCallback(() => {
    const leftEditor = leftEditorRef.current
    const centerEditor = centerEditorRef.current
    const rightEditor = rightEditorRef.current

    if (!leftEditor || !centerEditor || !rightEditor) return

    // 使用 ref 获取最新数据
    const regions = unresolvedRegionsRef.current
    const getResultLine = getResultLineForRegionRef.current
    const appliedMap = appliedSidesRef.current

    const leftScrollTop = leftEditor.getScrollTop()
    const centerScrollTop = centerEditor.getScrollTop()
    const rightScrollTop = rightEditor.getScrollTop()

    // 获取颜色
    const styles = getComputedStyle(document.documentElement)
    const primaryColor = styles.getPropertyValue('--primary').trim()
    const chart2Color = styles.getPropertyValue('--chart-2').trim()
    const destructiveColor = styles.getPropertyValue('--destructive').trim()

    const GAP_LINE_HEIGHT = 2

    // ===== 左侧曲线区域 =====
    if (leftCurveRef.current) {
      leftCurveRef.current.innerHTML = ''
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('class', 'absolute inset-0 w-full h-full pointer-events-none')
      leftCurveRef.current.appendChild(svg)

      for (const region of regions) {
        if (region.source !== 'ours' && region.source !== 'both') continue
        const applied = appliedMap.get(region.id) || 'none'
        if (applied === 'left') continue

        const resultLine = getResultLine(region)
        const leftLineCount = region.oursContent.length
        const centerLineCount = region.baseContent.length

        // 左侧位置（OURS）
        const leftTop = leftEditor.getTopForLineNumber(region.oursStartLine) - leftScrollTop
        const leftBottom =
          leftLineCount === 0
            ? leftTop + GAP_LINE_HEIGHT
            : leftEditor.getTopForLineNumber(region.oursEndLine + 1) - leftScrollTop

        // 按钮区域位置（与 Result 对齐）
        const centerTop = centerEditor.getTopForLineNumber(resultLine) - centerScrollTop
        const centerBottom =
          centerLineCount === 0
            ? centerTop + GAP_LINE_HEIGHT
            : centerEditor.getTopForLineNumber(resultLine + centerLineCount) - centerScrollTop

        // 绘制曲线（从左边到右边）
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        const midX = CURVE_WIDTH / 2
        const d = `
          M 0,${leftTop}
          C ${midX},${leftTop} ${midX},${centerTop} ${CURVE_WIDTH},${centerTop}
          L ${CURVE_WIDTH},${centerBottom}
          C ${midX},${centerBottom} ${midX},${leftBottom} 0,${leftBottom}
          Z
        `
        path.setAttribute('d', d)
        const fillColor = region.source === 'both' ? destructiveColor : primaryColor
        path.setAttribute('fill', hslToRgba(fillColor, 0.2))
        path.setAttribute('stroke', 'none')
        svg.appendChild(path)
      }
    }

    // ===== 左侧按钮区域 =====
    if (leftButtonsRef.current) {
      leftButtonsRef.current.innerHTML = ''

      for (const region of regions) {
        if (region.source !== 'ours' && region.source !== 'both') continue
        const applied = appliedMap.get(region.id) || 'none'
        if (applied === 'left') continue

        const resultLine = getResultLine(region)
        const centerLineCount = region.baseContent.length
        const isGap = centerLineCount === 0

        // 按钮区域位置（与 Result 对齐）
        const centerTop = centerEditor.getTopForLineNumber(resultLine) - centerScrollTop
        const centerBottom = isGap
          ? centerTop + GAP_LINE_HEIGHT
          : centerEditor.getTopForLineNumber(resultLine + centerLineCount) - centerScrollTop

        const blockHeight = Math.abs(centerBottom - centerTop)
        const fillColor = region.source === 'both' ? destructiveColor : primaryColor
        const actualHeight = isGap
          ? BUTTON_BLOCK_MIN_HEIGHT
          : Math.max(blockHeight - 1, BUTTON_BLOCK_MIN_HEIGHT)

        // 创建按钮容器
        const btnContainer = document.createElement('div')
        btnContainer.className = 'merge-btn-container'
        btnContainer.style.cssText = `
          position: absolute;
          left: 0;
          right: 0;
          top: ${centerTop}px;
          height: ${actualHeight}px;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 2px;
          background: ${isGap ? 'transparent' : hslToRgba(fillColor, 0.2)};
          border-top: ${isGap ? `2px solid ${hslToRgba(fillColor, 0.4)}` : 'transparent'};
        `

        // X 按钮（忽略）
        const ignoreBtn = document.createElement('button')
        ignoreBtn.className = 'merge-action-btn merge-action-ignore'
        ignoreBtn.innerHTML = '×'
        ignoreBtn.title = '忽略左侧更改'
        ignoreBtn.onclick = () => ignoreLeftRef.current(region)
        btnContainer.appendChild(ignoreBtn)

        // >> 按钮（应用）
        const acceptBtn = document.createElement('button')
        acceptBtn.className = 'merge-action-btn merge-action-accept-left'
        acceptBtn.innerHTML = '»'
        acceptBtn.title = applied === 'right' ? '追加左侧更改' : '应用左侧更改'
        if (applied === 'right') acceptBtn.classList.add('append')
        acceptBtn.onclick = () => acceptLeftRef.current(region)
        btnContainer.appendChild(acceptBtn)

        leftButtonsRef.current.appendChild(btnContainer)
      }
    }

    // ===== 右侧按钮区域 =====
    if (rightButtonsRef.current) {
      rightButtonsRef.current.innerHTML = ''

      for (const region of regions) {
        if (region.source !== 'theirs' && region.source !== 'both') continue
        const applied = appliedMap.get(region.id) || 'none'
        if (applied === 'right') continue

        const resultLine = getResultLine(region)
        const centerLineCount = region.baseContent.length
        const isGap = centerLineCount === 0

        // 按钮区域位置（与 Result 对齐）
        const centerTop = centerEditor.getTopForLineNumber(resultLine) - centerScrollTop
        const centerBottom = isGap
          ? centerTop + GAP_LINE_HEIGHT
          : centerEditor.getTopForLineNumber(resultLine + centerLineCount) - centerScrollTop

        const blockHeight = Math.abs(centerBottom - centerTop)
        const fillColor = region.source === 'both' ? destructiveColor : chart2Color
        const actualHeight = isGap
          ? BUTTON_BLOCK_MIN_HEIGHT
          : Math.max(blockHeight, BUTTON_BLOCK_MIN_HEIGHT)

        // 创建按钮容器
        const btnContainer = document.createElement('div')
        btnContainer.className = 'merge-btn-container'
        btnContainer.style.cssText = `
          position: absolute;
          left: 0;
          right: 0;
          top: ${centerTop}px;
          height: ${actualHeight}px;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 2px;
          background: ${isGap ? 'transparent' : hslToRgba(fillColor, 0.2)};
          border-top: ${isGap ? `2px solid ${hslToRgba(fillColor, 0.4)}` : 'transparent'};
        `

        // << 按钮（应用）
        const acceptBtn = document.createElement('button')
        acceptBtn.className = 'merge-action-btn merge-action-accept-right'
        acceptBtn.innerHTML = '«'
        acceptBtn.title = applied === 'left' ? '追加右侧更改' : '应用右侧更改'
        if (applied === 'left') acceptBtn.classList.add('append')
        acceptBtn.onclick = () => acceptRightRef.current(region)
        btnContainer.appendChild(acceptBtn)

        // X 按钮（忽略）
        const ignoreBtn = document.createElement('button')
        ignoreBtn.className = 'merge-action-btn merge-action-ignore'
        ignoreBtn.innerHTML = '×'
        ignoreBtn.title = '忽略右侧更改'
        ignoreBtn.onclick = () => ignoreRightRef.current(region)
        btnContainer.appendChild(ignoreBtn)

        rightButtonsRef.current.appendChild(btnContainer)
      }
    }

    // ===== 右侧曲线区域 =====
    if (rightCurveRef.current) {
      rightCurveRef.current.innerHTML = ''
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('class', 'absolute inset-0 w-full h-full pointer-events-none')
      rightCurveRef.current.appendChild(svg)

      for (const region of regions) {
        if (region.source !== 'theirs' && region.source !== 'both') continue
        const applied = appliedMap.get(region.id) || 'none'
        if (applied === 'right') continue

        const resultLine = getResultLine(region)
        const centerLineCount = region.baseContent.length
        const rightLineCount = region.theirsContent.length

        // 按钮区域位置（与 Result 对齐）
        const centerTop = centerEditor.getTopForLineNumber(resultLine) - centerScrollTop
        const centerBottom =
          centerLineCount === 0
            ? centerTop + GAP_LINE_HEIGHT
            : centerEditor.getTopForLineNumber(resultLine + centerLineCount) - centerScrollTop

        // 右侧位置（THEIRS）
        const rightTop = rightEditor.getTopForLineNumber(region.theirsStartLine) - rightScrollTop
        const rightBottom =
          rightLineCount === 0
            ? rightTop + GAP_LINE_HEIGHT
            : rightEditor.getTopForLineNumber(region.theirsEndLine + 1) - rightScrollTop

        // 绘制曲线（从左边到右边）
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        const midX = CURVE_WIDTH / 2
        const d = `
          M 0,${centerTop}
          C ${midX},${centerTop} ${midX},${rightTop} ${CURVE_WIDTH},${rightTop}
          L ${CURVE_WIDTH},${rightBottom}
          C ${midX},${rightBottom} ${midX},${centerBottom} 0,${centerBottom}
          Z
        `
        path.setAttribute('d', d)
        const fillColor = region.source === 'both' ? destructiveColor : chart2Color
        path.setAttribute('fill', hslToRgba(fillColor, 0.2))
        path.setAttribute('stroke', 'none')
        svg.appendChild(path)
      }
    }
  }, [])

  // 滚动同步（不依赖任何状态，使用稳定的函数引用）
  const handleScrollSync = useCallback(
    (sourceEditor: editor.IStandaloneCodeEditor, source: 'left' | 'center' | 'right') => {
      if (isSyncingScrollRef.current) return

      const scrollTop = sourceEditor.getScrollTop()
      const scrollLeft = sourceEditor.getScrollLeft()

      isSyncingScrollRef.current = true

      if (source !== 'left' && leftEditorRef.current) {
        leftEditorRef.current.setScrollTop(scrollTop)
        leftEditorRef.current.setScrollLeft(scrollLeft)
      }
      if (source !== 'center' && centerEditorRef.current) {
        centerEditorRef.current.setScrollTop(scrollTop)
        centerEditorRef.current.setScrollLeft(scrollLeft)
      }
      if (source !== 'right' && rightEditorRef.current) {
        rightEditorRef.current.setScrollTop(scrollTop)
        rightEditorRef.current.setScrollLeft(scrollLeft)
      }

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
    (editorInstance: editor.IStandaloneCodeEditor, position: 'left' | 'center' | 'right') => {
      if (position === 'left') {
        leftEditorRef.current = editorInstance
      } else if (position === 'center') {
        centerEditorRef.current = editorInstance
      } else {
        rightEditorRef.current = editorInstance
      }

      setEditorsReady((prev) => prev + 1)

      const scrollDisposable = editorInstance.onDidScrollChange(() => {
        handleScrollSync(editorInstance, position)
      })
      scrollListenersRef.current.push(scrollDisposable)
    },
    [handleScrollSync]
  )

  // 用于跳过自己触发的内容变化
  const isRestoringRef = useRef(false)

  // 监听 Result 内容变化，匹配快照恢复 UI 状态（与 Monaco 原生 Undo 集成）
  const handleResultChange = useCallback((newResult: string) => {
    // 如果是我们自己触发的变化，跳过
    if (isRestoringRef.current) return

    // 查找匹配的历史快照
    const snapshotIndex = historyRef.current.findIndex((s) => s.result === newResult)

    if (snapshotIndex !== -1 && snapshotIndex < historyRef.current.length - 1) {
      // 找到了之前的快照，说明用户按了 Cmd+Z
      const snapshot = historyRef.current[snapshotIndex]

      // 将撤销的快照移到 redo 栈
      const undoneSnapshots = historyRef.current.slice(snapshotIndex + 1)
      redoStackRef.current.push(...undoneSnapshots)

      // 截断历史栈
      historyRef.current = historyRef.current.slice(0, snapshotIndex + 1)

      // 恢复 UI 状态
      setAppliedSides(new Map(snapshot.appliedSides))
      setResolvedIds(new Set(snapshot.resolvedIds))
      lineOffsetsRef.current = new Map(snapshot.lineOffsets)
    } else {
      // 检查是否匹配 redo 栈中的快照
      const redoIndex = redoStackRef.current.findIndex((s) => s.result === newResult)
      if (redoIndex !== -1) {
        // 用户按了 Cmd+Shift+Z (Redo)
        const redoneSnapshots = redoStackRef.current.splice(0, redoIndex + 1)
        historyRef.current.push(...redoneSnapshots)

        const snapshot = redoneSnapshots[redoneSnapshots.length - 1]
        setAppliedSides(new Map(snapshot.appliedSides))
        setResolvedIds(new Set(snapshot.resolvedIds))
        lineOffsetsRef.current = new Map(snapshot.lineOffsets)
      }
      // 否则是用户手动编辑，不影响 UI 状态
    }
  }, [])

  // 恢复到指定快照（用于 ignore 操作的 undo）
  const restoreSnapshot = useCallback((snapshot: StateSnapshot) => {
    isRestoringRef.current = true

    setResult(snapshot.result)
    setAppliedSides(new Map(snapshot.appliedSides))
    setResolvedIds(new Set(snapshot.resolvedIds))
    lineOffsetsRef.current = new Map(snapshot.lineOffsets)

    // Editor 是受控组件，setResult 会自动更新编辑器内容
    // 延迟重置标志（等待 onChange 完成）
    requestAnimationFrame(() => {
      isRestoringRef.current = false
    })
  }, [])

  // 只对 ignore 操作（不改变内容的操作）拦截键盘
  useEffect(() => {
    if (!allEditorsReady) return

    // 检查最后一个操作是否是 ignore（内容没变）
    const isIgnoreOperation = (snap1: StateSnapshot, snap2: StateSnapshot) => {
      return snap1.result === snap2.result
    }

    const handleKeyDown = (e: monaco.IKeyboardEvent) => {
      const isUndo = (e.metaKey || e.ctrlKey) && e.keyCode === monaco.KeyCode.KeyZ && !e.shiftKey
      const isRedo = (e.metaKey || e.ctrlKey) && e.keyCode === monaco.KeyCode.KeyZ && e.shiftKey

      if (isUndo && historyRef.current.length > 1) {
        const current = historyRef.current[historyRef.current.length - 1]
        const previous = historyRef.current[historyRef.current.length - 2]

        // 只有当内容没变时才拦截（ignore 操作，Monaco 无法追踪）
        if (isIgnoreOperation(current, previous)) {
          e.preventDefault()
          e.stopPropagation()

          historyRef.current.pop()
          redoStackRef.current.push(current)
          restoreSnapshot(previous)
        }
      } else if (isRedo && redoStackRef.current.length > 0) {
        const next = redoStackRef.current[redoStackRef.current.length - 1]
        const current = historyRef.current[historyRef.current.length - 1]

        // 只有当内容没变时才拦截
        if (isIgnoreOperation(next, current)) {
          e.preventDefault()
          e.stopPropagation()

          redoStackRef.current.pop()
          historyRef.current.push(next)
          restoreSnapshot(next)
        }
      }
    }

    // 为每个编辑器添加键盘监听
    const disposables: { dispose: () => void }[] = []

    ;[leftEditorRef.current, centerEditorRef.current, rightEditorRef.current].forEach((editor) => {
      if (editor) {
        disposables.push(editor.onKeyDown(handleKeyDown))
      }
    })

    return () => disposables.forEach((d) => d.dispose())
  }, [allEditorsReady, restoreSnapshot])

  // 清理
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }
      scrollListenersRef.current.forEach((d) => d?.dispose())
      scrollListenersRef.current = []

      leftEditorRef.current = null
      centerEditorRef.current = null
      rightEditorRef.current = null
    }
  }, [])

  // 应用装饰器（仅高亮，按钮移到连接区域）
  useEffect(() => {
    if (!allEditorsReady) return

    // 左侧装饰 - 只高亮，不显示按钮
    if (leftEditorRef.current) {
      const decorations: editor.IModelDeltaDecoration[] = []

      for (const region of unresolvedRegions) {
        // 只有 OURS 改了或者冲突时才高亮左侧
        if (region.source === 'ours' || region.source === 'both') {
          const colorSuffix = region.source === 'both' ? 'conflict' : 'ours'
          const applied = appliedSides.get(region.id) || 'none'

          // 如果左侧已应用，不显示高亮
          if (applied === 'left') continue

          if (region.oursContent.length > 0) {
            for (let line = region.oursStartLine; line <= region.oursEndLine; line++) {
              decorations.push({
                range: new monaco.Range(line, 1, line, 1),
                options: {
                  isWholeLine: true,
                  className: `git-merge-line-${colorSuffix}`,
                  marginClassName: `git-merge-gutter-${colorSuffix}`
                }
              })
            }
          } else {
            decorations.push({
              range: new monaco.Range(region.oursStartLine, 1, region.oursStartLine, 1),
              options: {
                isWholeLine: true,
                className: `git-merge-gap-${colorSuffix}`,
                marginClassName: `git-merge-gap-gutter-${colorSuffix}`
              }
            })
          }
        }
      }

      leftDecorationsRef.current = leftEditorRef.current.deltaDecorations(
        leftDecorationsRef.current,
        decorations
      )
    }

    // 中间装饰（Result）- 根据 source 和 appliedSides 使用不同颜色
    if (centerEditorRef.current) {
      const decorations: editor.IModelDeltaDecoration[] = []

      for (const region of unresolvedRegions) {
        const applied = appliedSides.get(region.id) || 'none'

        // 非冲突 region：应用后不再高亮
        if (region.source === 'ours' && applied === 'left') continue
        if (region.source === 'theirs' && applied === 'right') continue

        const resultLine = getResultLineForRegion(region)
        const lineCount = region.baseContent.length
        const colorSuffix = region.source === 'both' ? 'conflict' : region.source

        if (lineCount > 0) {
          for (let i = 0; i < lineCount; i++) {
            decorations.push({
              range: new monaco.Range(resultLine + i, 1, resultLine + i, 1),
              options: {
                isWholeLine: true,
                className: `git-merge-line-result-${colorSuffix}`,
                marginClassName: `git-merge-gutter-result-${colorSuffix}`
              }
            })
          }
        } else {
          decorations.push({
            range: new monaco.Range(resultLine, 1, resultLine, 1),
            options: {
              isWholeLine: true,
              className: `git-merge-gap-result-${colorSuffix}`,
              marginClassName: `git-merge-gap-result-${colorSuffix}`
            }
          })
        }
      }

      centerDecorationsRef.current = centerEditorRef.current.deltaDecorations(
        centerDecorationsRef.current,
        decorations
      )
    }

    // 右侧装饰 - 只高亮，不显示按钮
    if (rightEditorRef.current) {
      const decorations: editor.IModelDeltaDecoration[] = []

      for (const region of unresolvedRegions) {
        // 只有 THEIRS 改了或者冲突时才高亮右侧
        if (region.source === 'theirs' || region.source === 'both') {
          const colorSuffix = region.source === 'both' ? 'conflict' : 'theirs'
          const applied = appliedSides.get(region.id) || 'none'

          // 如果右侧已应用，不显示高亮
          if (applied === 'right') continue

          if (region.theirsContent.length > 0) {
            for (let line = region.theirsStartLine; line <= region.theirsEndLine; line++) {
              decorations.push({
                range: new monaco.Range(line, 1, line, 1),
                options: {
                  isWholeLine: true,
                  className: `git-merge-line-${colorSuffix}`,
                  marginClassName: `git-merge-gutter-${colorSuffix}`
                }
              })
            }
          } else {
            decorations.push({
              range: new monaco.Range(region.theirsStartLine, 1, region.theirsStartLine, 1),
              options: {
                isWholeLine: true,
                className: `git-merge-gap-${colorSuffix}`,
                marginClassName: `git-merge-gap-gutter-${colorSuffix}`
              }
            })
          }
        }
      }

      rightDecorationsRef.current = rightEditorRef.current.deltaDecorations(
        rightDecorationsRef.current,
        decorations
      )
    }

    requestAnimationFrame(updateConnections)
  }, [unresolvedRegions, allEditorsReady, updateConnections, getResultLineForRegion, appliedSides])

  // 编辑器配置
  const baseOptions = useMemo(
    () => ({
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
      smoothScrolling: false,
      renderWhitespace: 'none' as const,
      renderControlCharacters: false
    }),
    [globalOptions?.fontSize]
  )

  const sideEditorOptions = useMemo(
    () => ({
      ...baseOptions,
      readOnly: true,
      glyphMargin: false,
      scrollbar: {
        vertical: 'hidden' as const,
        horizontal: 'hidden' as const,
        useShadows: false
      }
    }),
    [baseOptions]
  )

  const centerEditorOptions = useMemo(
    () => ({
      ...baseOptions,
      readOnly: false,
      glyphMargin: false,
      scrollbar: {
        vertical: 'visible' as const,
        horizontal: 'visible' as const,
        useShadows: false,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
      }
    }),
    [baseOptions]
  )

  // 统计
  const totalDiffs = initialRegions.length
  const resolvedCount = resolvedIds.size
  const allResolved = resolvedCount === totalDiffs

  return (
    <div className="git-merge-editor flex flex-col h-full w-full" style={{ height }}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {totalDiffs - resolvedCount} of {totalDiffs} changes remaining
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // 只有当 Result 内容有实际改动时才需要确认
              if (result !== (base || ours)) {
                setShowCancelConfirm(true)
              } else {
                onCancel?.()
              }
            }}
            className="h-7"
          >
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => onSave?.(result)}
            disabled={!allResolved}
            className="h-7"
          >
            <Check className="w-4 h-4 mr-1" />
            Apply
          </Button>
        </div>
      </div>

      {/* 取消确认对话框 */}
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              放弃合并编辑？
            </DialogTitle>
            <DialogDescription>
              你已经对合并结果进行了编辑。关闭后这些更改将会丢失，冲突文件将保持原状。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>
              继续编辑
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowCancelConfirm(false)
                onCancel?.()
              }}
            >
              放弃更改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 标题栏 */}
      <div className="flex border-b border-border shrink-0">
        <div className="flex-1 px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 text-center truncate">
          {oursTitle}
        </div>
        <div className="bg-muted/50 shrink-0" style={{ width: CURVE_WIDTH + BUTTON_WIDTH }} />
        <div className="flex-1 px-3 py-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-500/5 text-center truncate">
          {resultTitle}
        </div>
        <div className="bg-muted/50 shrink-0" style={{ width: CURVE_WIDTH + BUTTON_WIDTH }} />
        <div className="flex-1 px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 bg-green-500/5 text-center truncate">
          {theirsTitle}
        </div>
      </div>

      {/* 编辑器区域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧编辑器 (OURS) */}
        <div className="flex-1 h-full overflow-hidden">
          <Editor
            value={ours}
            language={language}
            theme={theme}
            beforeMount={handleBeforeMount}
            onMount={(e) => handleEditorMount(e, 'left')}
            options={sideEditorOptions}
          />
        </div>

        {/* 左侧曲线区域 */}
        <div
          ref={leftCurveRef}
          className="relative bg-muted/30 shrink-0 overflow-hidden"
          style={{ width: CURVE_WIDTH }}
        />

        {/* 左侧按钮区域 */}
        <div
          ref={leftButtonsRef}
          className="relative bg-muted/20 shrink-0 overflow-hidden"
          style={{ width: BUTTON_WIDTH }}
        />

        {/* 中间编辑器 (Result) */}
        <div className="flex-1 h-full overflow-hidden">
          <Editor
            value={result}
            language={language}
            theme={theme}
            beforeMount={handleBeforeMount}
            onMount={(e) => handleEditorMount(e, 'center')}
            onChange={(value) => {
              const newValue = value || ''
              setResult(newValue)
              handleResultChange(newValue)
            }}
            options={centerEditorOptions}
          />
        </div>

        {/* 右侧按钮区域 */}
        <div
          ref={rightButtonsRef}
          className="relative bg-muted/20 shrink-0 overflow-hidden"
          style={{ width: BUTTON_WIDTH }}
        />

        {/* 右侧曲线区域 */}
        <div
          ref={rightCurveRef}
          className="relative bg-muted/30 shrink-0 overflow-hidden"
          style={{ width: CURVE_WIDTH }}
        />

        {/* 右侧编辑器 (THEIRS) */}
        <div className="flex-1 h-full overflow-hidden">
          <Editor
            value={theirs}
            language={language}
            theme={theme}
            beforeMount={handleBeforeMount}
            onMount={(e) => handleEditorMount(e, 'right')}
            options={sideEditorOptions}
          />
        </div>
      </div>

      {/* Merge 样式 */}
      <style>{`
        .git-merge-editor .monaco-editor {
          /* OURS - 蓝色 (只有当前分支改了) */
          & .git-merge-line-ours,
          & .git-merge-gutter-ours {
            background-color: color-mix(in srgb, var(--primary) 18%, transparent) !important;
          }
          & .git-merge-gap-ours,
          & .git-merge-gap-gutter-ours {
            border-top: 2px solid color-mix(in srgb, var(--primary) 40%, transparent) !important;
          }
          
          /* THEIRS - 绿色 (只有传入分支改了) */
          & .git-merge-line-theirs,
          & .git-merge-gutter-theirs {
            background-color: color-mix(in srgb, var(--chart-2) 22%, transparent) !important;
          }
          & .git-merge-gap-theirs,
          & .git-merge-gap-gutter-theirs {
            border-top: 2px solid color-mix(in srgb, var(--chart-2) 45%, transparent) !important;
          }
          
          /* CONFLICT - 红色 (两边都改了 - 冲突) */
          & .git-merge-line-conflict,
          & .git-merge-gutter-conflict {
            background-color: color-mix(in srgb, var(--destructive) 20%, transparent) !important;
          }
          & .git-merge-gap-conflict,
          & .git-merge-gap-gutter-conflict {
            border-top: 2px solid color-mix(in srgb, var(--destructive) 45%, transparent) !important;
          }
          
          /* Result OURS - 蓝色 */
          & .git-merge-line-result-ours,
          & .git-merge-gutter-result-ours {
            background-color: color-mix(in srgb, var(--primary) 15%, transparent) !important;
          }
          & .git-merge-gap-result-ours {
            border-top: 2px solid color-mix(in srgb, var(--primary) 35%, transparent) !important;
          }
          
          /* Result THEIRS - 绿色 */
          & .git-merge-line-result-theirs,
          & .git-merge-gutter-result-theirs {
            background-color: color-mix(in srgb, var(--chart-2) 18%, transparent) !important;
          }
          & .git-merge-gap-result-theirs {
            border-top: 2px solid color-mix(in srgb, var(--chart-2) 40%, transparent) !important;
          }
          
          /* Result CONFLICT - 红色 */
          & .git-merge-line-result-conflict,
          & .git-merge-gutter-result-conflict {
            background-color: color-mix(in srgb, var(--destructive) 15%, transparent) !important;
          }
          & .git-merge-gap-result-conflict {
            border-top: 2px solid color-mix(in srgb, var(--destructive) 35%, transparent) !important;
          }
        }
        
        /* 按钮区域基础样式 */
        .merge-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 2px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.12s ease;
          background: transparent;
          width: 16px;
          height: 16px;
          padding: 0;
          line-height: 1;
        }
        
        .merge-action-btn:hover {
          background: hsl(var(--muted) / 0.6);
        }
        
        /* Accept Left (>>) */
        .merge-action-accept-left {
          color: hsl(var(--primary));
        }
        .merge-action-accept-left:hover {
          color: hsl(var(--primary));
          transform: scale(1.2);
        }
        .merge-action-accept-left.append {
          transform: rotate(45deg);
        }
        .merge-action-accept-left.append:hover {
          transform: rotate(45deg) scale(1.2);
        }
        
        /* Accept Right (<<) */
        .merge-action-accept-right {
          color: hsl(var(--chart-2));
        }
        .merge-action-accept-right:hover {
          color: hsl(var(--chart-2));
          transform: scale(1.2);
        }
        .merge-action-accept-right.append {
          transform: rotate(-45deg);
        }
        .merge-action-accept-right.append:hover {
          transform: rotate(-45deg) scale(1.2);
        }
        
        /* Ignore (X) */
        .merge-action-ignore {
          color: hsl(var(--muted-foreground) / 0.7);
          font-size: 15px;
        }
        .merge-action-ignore:hover {
          color: hsl(var(--destructive));
          transform: scale(1.2);
        }
      `}</style>
    </div>
  )
}
