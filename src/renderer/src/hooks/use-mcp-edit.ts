import { useState } from 'react'
import { toast } from '@/components/ui/sonner'
import { parseConfigJson } from '@/utils/mcp-helpers'
import { useMCPStore } from '@/stores/mcp.store'

/**
 * MCP 服务器编辑逻辑的自定义 Hook
 */
export function useMCPEdit(onSuccess?: () => Promise<void>) {
  const [openEditDialog, setOpenEditDialog] = useState(false)
  const [configJson, setConfigJson] = useState('')
  const { batchAddServers } = useMCPStore()

  const handleEditServer = async (serverId: string) => {
    try {
      const servers = await window.api.mcp.getAllServers()
      const server = servers.find((s: any) => s.id === serverId)
      if (!server) {
        toast.error('服务不存在')
        return
      }

      setConfigJson(JSON.stringify(server.configJson, null, 2))
      setOpenEditDialog(true)
    } catch (error) {
      console.error('获取服务配置失败:', error)
      toast.error('获取服务配置失败')
    }
  }

  // 统一的粘贴处理：只负责验证和显示，不执行添加操作
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text')
    const result = parseConfigJson(pastedText)
    if (result) {
      e.preventDefault()
      // 保持原格式，确保重新解析时能正确识别服务器名称
      setConfigJson(pastedText)
    }
  }

  const handleUpdateServer = async (serverId: string) => {
    if (!configJson.trim()) {
      toast.error('配置不能为空')
      return
    }

    const parseResult = parseConfigJson(configJson)
    if (!parseResult) {
      toast.error('配置格式错误，请检查 JSON 格式')
      return
    }

    // 多个服务器：批量添加（而非更新）
    if ('servers' in parseResult) {
      const { successCount, failCount } = await batchAddServers(parseResult.servers)
      if (successCount > 0) {
        toast.success(
          `已添加 ${successCount} 个服务器${failCount > 0 ? `，${failCount} 个失败` : ''}`
        )
        setOpenEditDialog(false)
        setConfigJson('')
        if (onSuccess) {
          await onSuccess()
        }
      } else {
        toast.error('所有服务器添加失败')
      }
      return
    }

    // 单个服务器：更新当前服务器
    const { config } = parseResult
    try {
      const servers = await window.api.mcp.getAllServers()
      const server = servers.find((s: any) => s.id === serverId)
      if (!server) {
        toast.error('服务不存在')
        return
      }

      await window.api.mcp.updateServer(serverId, server.name, config)
      toast.success('配置已更新')
      setOpenEditDialog(false)
      setConfigJson('')

      if (onSuccess) {
        await onSuccess()
      }
    } catch (error) {
      console.error('更新配置失败:', error)
      toast.error(`更新失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleCloseDialog = () => {
    setOpenEditDialog(false)
    setConfigJson('')
  }

  return {
    openEditDialog,
    setOpenEditDialog,
    configJson,
    setConfigJson,
    handleEditServer,
    handlePaste,
    handleUpdateServer,
    handleCloseDialog
  }
}
