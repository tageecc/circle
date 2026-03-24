import { useState, useCallback } from 'react'
import { PanelLayout, BottomPanelType } from '../types'

export function useLayoutManager() {
  const [panelLayout, setPanelLayout] = useState<PanelLayout>({
    fileTreeSize: 20,
    chatPanelSize: 20
  })
  const [expandedDirs, setExpandedDirs] = useState<string[]>([])
  const [showFileTree, setShowFileTree] = useState(true)
  const [showChatSidebar, setShowChatSidebar] = useState(true)
  const [bottomPanel, setBottomPanel] = useState<BottomPanelType>('problems')
  const [expandedLeftPanel, setExpandedLeftPanel] = useState<'explorer' | 'commit' | null>(
    'explorer'
  )

  const toggleFileTree = useCallback(() => {
    setShowFileTree((prev) => !prev)
  }, [])

  const toggleChatSidebar = useCallback(() => {
    setShowChatSidebar((prev) => !prev)
  }, [])

  const updatePanelLayout = useCallback(
    (sizes: number[], showFileTree: boolean, showChatSidebar: boolean) => {
      if (sizes.length >= 3 && showFileTree && showChatSidebar) {
        setPanelLayout({
          fileTreeSize: sizes[0],
          chatPanelSize: sizes[2]
        })
      } else if (sizes.length >= 2) {
        if (showFileTree) {
          setPanelLayout((prev) => ({ ...prev, fileTreeSize: sizes[0] }))
        } else if (showChatSidebar) {
          setPanelLayout((prev) => ({ ...prev, chatPanelSize: sizes[1] }))
        }
      }
    },
    []
  )

  const toggleLeftPanel = useCallback((panel: 'explorer' | 'commit') => {
    setExpandedLeftPanel((prev) => {
      // 互斥：如果点击的是当前展开的面板，切换到另一个面板
      if (prev === panel) {
        return panel === 'explorer' ? 'commit' : 'explorer'
      }
      return panel
    })
  }, [])

  return {
    panelLayout,
    expandedDirs,
    showFileTree,
    showChatSidebar,
    bottomPanel,
    expandedLeftPanel,
    setPanelLayout,
    setExpandedDirs,
    setBottomPanel,
    toggleLeftPanel,
    toggleFileTree,
    toggleChatSidebar,
    updatePanelLayout
  }
}
