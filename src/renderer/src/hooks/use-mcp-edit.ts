import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import { parseConfigJson } from '@/utils/mcp-helpers'
import { useMCPStore } from '@/stores/mcp.store'

/**
 * MCP 服务器编辑逻辑的自定义 Hook
 */
export function useMCPEdit(onSuccess?: () => Promise<void>) {
  const { t } = useTranslation()
  const [openEditDialog, setOpenEditDialog] = useState(false)
  const [configJson, setConfigJson] = useState('')
  const { batchAddServers } = useMCPStore()

  const handleEditServer = async (serverId: string) => {
    try {
      const servers = await window.api.mcp.getAllServers()
      const server = servers.find((s: any) => s.id === serverId)
      if (!server) {
        toast.error(t('mcp.service_not_exist'))
        return
      }

      setConfigJson(JSON.stringify(server.configJson, null, 2))
      setOpenEditDialog(true)
    } catch (error) {
      console.error('获取服务配置失败:', error)
      toast.error(t('mcp.fetch_config_failed'))
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
      toast.error(t('mcp.config_empty'))
      return
    }

    const parseResult = parseConfigJson(configJson)
    if (!parseResult) {
      toast.error(t('mcp.invalid_config_json'))
      return
    }

    // 多个服务器：批量添加（而非更新）
    if ('servers' in parseResult) {
      const { successCount, failCount } = await batchAddServers(parseResult.servers)
      if (successCount > 0) {
        toast.success(
          failCount > 0
            ? t('mcp.batch_add_partial', { success: successCount, fail: failCount })
            : t('mcp.batch_add_success', { count: successCount })
        )
        setOpenEditDialog(false)
        setConfigJson('')
        if (onSuccess) {
          await onSuccess()
        }
      } else {
        toast.error(t('mcp.add_all_failed'))
      }
      return
    }

    // 单个服务器：更新当前服务器
    const { config } = parseResult
    try {
      const servers = await window.api.mcp.getAllServers()
      const server = servers.find((s: any) => s.id === serverId)
      if (!server) {
        toast.error(t('mcp.service_not_exist'))
        return
      }

      await window.api.mcp.updateServer(serverId, server.name, config)
      toast.success(t('mcp.config_updated'))
      setOpenEditDialog(false)
      setConfigJson('')

      if (onSuccess) {
        await onSuccess()
      }
    } catch (error) {
      console.error('更新配置失败:', error)
      toast.error(
        t('mcp.update_failed_message', {
          message: error instanceof Error ? error.message : String(error)
        })
      )
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
