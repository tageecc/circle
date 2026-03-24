import { useState, useEffect } from 'react'

export interface AgentFormData {
  name: string
  description: string
  model: string
  provider: string
  apiKey?: string
  instructions: string
  temperature: number
  maxTokens: number
  topP: number
  enableReasoning?: number
  thinkingBudget?: number
}

export function useAgent(agentId?: string) {
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState<AgentFormData>({
    name: '',
    description: '',
    model: '',
    provider: '',
    apiKey: '',
    instructions: '',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1,
    enableReasoning: 0,
    thinkingBudget: undefined
  })

  useEffect(() => {
    if (agentId) {
      loadAgent()
    }
  }, [agentId])

  const loadAgent = async () => {
    if (!agentId) return

    setLoading(true)
    try {
      const data = await window.api.agents.getById(agentId)
      setAgent(data)
      setFormData({
        name: data.name || '',
        description: data.description || '',
        model: data.model || '',
        provider: data.provider || '',
        apiKey: data.apiKey || '',
        instructions: data.instructions || '',
        temperature: data.temperature || 0.7,
        maxTokens: data.maxTokens || 2048,
        topP: data.topP || 1,
        enableReasoning: data.enableReasoning || 0,
        thinkingBudget: data.thinkingBudget
      })
    } catch (error) {
      console.error('Failed to load agent:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateAgent = async (updates: Partial<any>) => {
    if (!agentId) return false

    try {
      await window.api.agents.update(agentId, updates)
      await loadAgent()
      return true
    } catch (error) {
      console.error('Failed to update agent:', error)
      return false
    }
  }

  const resetForm = () => {
    if (agent) {
      setFormData({
        name: agent.name || '',
        description: agent.description || '',
        model: agent.model || '',
        provider: agent.provider || '',
        apiKey: agent.apiKey || '',
        instructions: agent.instructions || '',
        temperature: agent.temperature || 0.7,
        maxTokens: agent.maxTokens || 2048,
        topP: agent.topP || 1,
        enableReasoning: agent.enableReasoning || 0,
        thinkingBudget: agent.thinkingBudget
      })
    }
  }

  return {
    agent,
    loading,
    editing,
    setEditing,
    formData,
    setFormData,
    loadAgent,
    updateAgent,
    resetForm
  }
}
