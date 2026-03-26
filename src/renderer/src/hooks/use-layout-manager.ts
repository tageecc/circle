import { useState, useCallback, useEffect, useRef } from 'react'
import { PanelLayout } from '@/types/ide'
import { useWorkspaceUIStore } from '@/stores/workspace-ui.store'

export type LeftTabType =
  | 'explorer'
  | 'search'
  | 'changes'
  | 'history'
  | 'compare'
  | 'mcp'
  | 'skills'

// 默认值
const DEFAULTS: { panelLayout: PanelLayout } = {
  panelLayout: { fileTreeSize: 20, chatPanelSize: 20 }
}

/**
 * 布局管理 Hook - 简化版
 *
 * 职责：
 * 1. 管理面板尺寸状态（panelLayout）
 * 2. 加载和保存布局配置
 * 3. 只保存尺寸，不做任何自动折叠
 *
 * 优化：
 * - ✅ 单例调用（只在 ide.tsx 中调用一次）
 * - ✅ expandedDirs 已移至 Zustand store
 * - ✅ 使用防抖保存，避免频繁写入
 * - ✅ 使用 hasInitializedRef 防止重复加载
 */
export function useLayoutManager(): {
  panelLayout: PanelLayout
  isLayoutReady: boolean
  updatePanelLayout: (sizes: number[]) => void
} {
  const [panelLayout, setPanelLayout] = useState<PanelLayout>(DEFAULTS.panelLayout)
  const [isLayoutReady, setIsLayoutReady] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 保存上一次的 panelLayout，避免重复保存
  const lastSavedLayoutRef = useRef<PanelLayout | null>(null)
  // 标记是否正在加载，避免覆盖用户操作
  const isLoadingRef = useRef(true)
  // 标记是否已经初始化过，防止重复加载
  const hasInitializedRef = useRef(false)

  // ✅ 加载布局状态（只执行一次）
  useEffect(() => {
    // 如果已经初始化过，直接跳过
    if (hasInitializedRef.current) {
      return
    }

    hasInitializedRef.current = true

    window.api.config
      .getLayoutState()
      .then((saved) => {
        if (saved) {
          // 加载到 Zustand
          useWorkspaceUIStore.setState({
            showFileTree: saved.showFileTree ?? true,
            showChatSidebar: saved.showChatSidebar ?? true,
            bottomPanel: saved.bottomPanel ?? null,
            activeLeftTab: (saved.activeLeftTab ?? 'explorer') as LeftTabType
          })

          // 加载到本地状态，并验证尺寸合法性
          if (saved.panelLayout) {
            const layout = {
              fileTreeSize: Math.min(Math.max(saved.panelLayout.fileTreeSize || 20, 15), 40),
              chatPanelSize: Math.min(Math.max(saved.panelLayout.chatPanelSize || 20, 20), 40)
            }
            setPanelLayout(layout)
            lastSavedLayoutRef.current = layout
          }
        }
        setIsLayoutReady(true)
        // 延迟解除加载锁，确保初始渲染完成
        setTimeout(() => {
          isLoadingRef.current = false
        }, 100)
      })
      .catch(() => {
        setIsLayoutReady(true)
        isLoadingRef.current = false
      })
  }, [])

  // ✅ 监听 panelLayout 变化，触发保存（使用 ref 避免依赖循环）
  useEffect(() => {
    // 跳过加载期间和未准备好的状态
    if (!isLayoutReady || isLoadingRef.current) {
      return
    }

    // 检查是否真的有变化（避免微小的浮点数差异导致无限循环）
    const hasChanged =
      !lastSavedLayoutRef.current ||
      Math.abs(panelLayout.fileTreeSize - lastSavedLayoutRef.current.fileTreeSize) > 0.5 ||
      Math.abs(panelLayout.chatPanelSize - lastSavedLayoutRef.current.chatPanelSize) > 0.5

    if (!hasChanged) {
      return
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const { showFileTree, showChatSidebar, bottomPanel, activeLeftTab } =
        useWorkspaceUIStore.getState()

      lastSavedLayoutRef.current = panelLayout

      window.api.config
        .setLayoutState({
          showFileTree,
          showChatSidebar,
          bottomPanel,
          activeLeftTab: activeLeftTab === 'compare' ? 'explorer' : activeLeftTab,
          panelLayout
        })
        .catch(() => {})
    }, 500)
  }, [isLayoutReady, panelLayout])

  // ✅ 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // 简化版：只保存布局尺寸，不做任何自动折叠
  const updatePanelLayout = useCallback((sizes: number[]) => {
    if (sizes.length === 0) return

    // 立即获取当前的面板显示状态，避免状态不同步
    const { showFileTree, showChatSidebar } = useWorkspaceUIStore.getState()

    // 根据当前面板数量保存对应的尺寸
    setPanelLayout((prev) => {
      const newLayout = { ...prev }

      // 如果有3个面板：[fileTree, editor, chat]
      if (sizes.length >= 3) {
        if (showFileTree && Math.abs(prev.fileTreeSize - sizes[0]) > 0.5) {
          newLayout.fileTreeSize = sizes[0]
        }
        if (showChatSidebar && Math.abs(prev.chatPanelSize - sizes[2]) > 0.5) {
          newLayout.chatPanelSize = sizes[2]
        }
      }
      // 如果有2个面板，需要判断是哪两个
      else if (sizes.length === 2) {
        if (showFileTree && !showChatSidebar) {
          // 只有左侧面板：[fileTree, editor]
          if (Math.abs(prev.fileTreeSize - sizes[0]) > 0.5) {
            newLayout.fileTreeSize = sizes[0]
          }
        } else if (!showFileTree && showChatSidebar) {
          // 只有右侧面板：[editor, chat]
          if (Math.abs(prev.chatPanelSize - sizes[1]) > 0.5) {
            newLayout.chatPanelSize = sizes[1]
          }
        }
      }

      // 只在有变化时返回新对象
      if (
        newLayout.fileTreeSize === prev.fileTreeSize &&
        newLayout.chatPanelSize === prev.chatPanelSize
      ) {
        return prev
      }
      return newLayout
    })
  }, [])

  return {
    panelLayout,
    isLayoutReady,
    updatePanelLayout
  }
}
