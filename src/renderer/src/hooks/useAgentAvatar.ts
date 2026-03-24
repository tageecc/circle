import { useState, useEffect } from 'react'

export function useAgentAvatar(agent: any) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<string | null>(null)

  useEffect(() => {
    loadAvatar()
  }, [agent?.metadata?.avatar])

  const loadAvatar = async () => {
    if (agent?.metadata?.avatar) {
      // 判断是 URL 还是文件名
      if (
        agent.metadata.avatar.startsWith('http://') ||
        agent.metadata.avatar.startsWith('https://')
      ) {
        // 是 URL，直接使用
        setAvatarPreview(agent.metadata.avatar)
      } else {
        // 是文件名，加载为 Base64
        try {
          const base64 = await window.api.avatar.readAsBase64(agent.metadata.avatar)
          setAvatarPreview(base64)
        } catch (error) {
          console.error('Failed to load avatar:', error)
          setAvatarPreview(null)
        }
      }
    } else {
      setAvatarPreview(null)
    }
  }

  const selectAvatar = async () => {
    try {
      const filePath = await window.api.avatar.select()
      if (filePath) {
        setSelectedAvatarFile(filePath)
        // 读取文件为 Base64 用于预览
        const base64 = await window.api.avatar.readFileAsBase64(filePath)
        setAvatarPreview(base64)
      }
    } catch (error) {
      console.error('Failed to select avatar:', error)
      throw error
    }
  }

  const removeAvatar = async (agentId: string, onSuccess?: () => void) => {
    try {
      if (agent.metadata?.avatar) {
        await window.api.avatar.delete(agentId)
      }

      await window.api.agents.update(agentId, {
        metadata: {
          ...agent.metadata,
          avatar: null
        }
      })

      setAvatarPreview(null)
      setSelectedAvatarFile(null)
      onSuccess?.()
    } catch (error) {
      console.error('Failed to remove avatar:', error)
      throw error
    }
  }

  const saveAvatar = async (agentId: string): Promise<string | null> => {
    if (!selectedAvatarFile) return agent.metadata?.avatar || null

    try {
      const avatarFileName = await window.api.avatar.save(selectedAvatarFile, agentId)
      setSelectedAvatarFile(null)
      return avatarFileName
    } catch (error) {
      console.error('Failed to save avatar:', error)
      throw error
    }
  }

  const reset = () => {
    setSelectedAvatarFile(null)
    loadAvatar()
  }

  return {
    avatarPreview,
    selectedAvatarFile,
    selectAvatar,
    removeAvatar,
    saveAvatar,
    reset
  }
}
