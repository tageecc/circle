import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import { useTranslation } from 'react-i18next'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea
} from '@/components/ui/input-group'

interface Memory {
  id: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export function MemoriesSettingsContent() {
  const { t } = useTranslation()
  const [memories, setMemories] = useState<Memory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [content, setContent] = useState('')

  const loadMemories = async () => {
    try {
      setIsLoading(true)
      const data = await window.api.memory.getAll()
      setMemories(data)
    } catch (error) {
      console.error('Failed to load memories:', error)
      toast.error(t('memories.load_failed'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMemories()
  }, [])

  const handleCreate = async () => {
    if (!content.trim()) {
      toast.error(t('memories.empty_content'))
      return
    }

    try {
      await window.api.memory.create(content)
      toast.success(t('memories.create_success'))
      setContent('')
      setIsCreating(false)
      await loadMemories()
    } catch (error) {
      console.error('Failed to create memory:', error)
      toast.error(t('memories.create_failed'))
    }
  }

  const handleUpdate = async (id: string) => {
    if (!content.trim()) {
      toast.error(t('memories.empty_content'))
      return
    }

    try {
      await window.api.memory.update(id, content)
      toast.success(t('memories.update_success'))
      setEditingId(null)
      setContent('')
      await loadMemories()
    } catch (error) {
      console.error('Failed to update memory:', error)
      toast.error(t('memories.update_failed'))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await window.api.memory.delete(id)
      toast.success(t('memories.delete_success'))
      await loadMemories()
    } catch (error) {
      console.error('Failed to delete memory:', error)
      toast.error(t('memories.delete_failed'))
    }
  }

  const startEdit = (memory: Memory) => {
    setEditingId(memory.id)
    setContent(memory.content)
    setIsCreating(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setIsCreating(false)
    setContent('')
  }

  const startCreate = () => {
    setIsCreating(true)
    setEditingId(null)
    setContent('')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted-foreground">{t('memories.loading')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{t('memories.title')}</h3>
        {!isCreating && !editingId && (
          <Button onClick={startCreate} variant="ghost" size="sm" className="h-7 gap-1">
            <Plus className="w-3.5 h-3.5" />
            {t('memories.add')}
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        {/* 创建新记忆表单 */}
        {isCreating && (
          <InputGroup>
            <InputGroupTextarea
              placeholder={t('memories.placeholder')}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              autoFocus
              className="text-sm"
            />
            <InputGroupAddon align="block-end">
              <InputGroupButton
                onClick={cancelEdit}
                variant="ghost"
                size="icon-xs"
                className="ml-auto"
                aria-label={t('common.cancel')}
              >
                <X />
              </InputGroupButton>
              <InputGroupButton
                onClick={handleCreate}
                variant="default"
                size="icon-xs"
                aria-label={t('common.save')}
              >
                <Check />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        )}

        {/* 记忆列表 */}
        {memories.length === 0 && !isCreating ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">{t('memories.empty_state')}</p>
          </div>
        ) : (
          memories.map((memory) => (
            <div
              key={memory.id}
              className="group rounded-lg border bg-card p-2.5 hover:bg-accent/50 transition-colors"
            >
              {editingId === memory.id ? (
                <InputGroup>
                  <InputGroupTextarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={3}
                    autoFocus
                    className="text-sm"
                  />
                  <InputGroupAddon align="block-end">
                    <InputGroupButton
                      onClick={cancelEdit}
                      variant="ghost"
                      size="icon-xs"
                      className="ml-auto"
                      aria-label={t('common.cancel')}
                    >
                      <X />
                    </InputGroupButton>
                    <InputGroupButton
                      onClick={() => handleUpdate(memory.id)}
                      variant="default"
                      size="icon-xs"
                      aria-label={t('common.save')}
                    >
                      <Check />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              ) : (
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm leading-normal whitespace-pre-wrap">
                    {memory.content}
                  </p>
                  <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      onClick={() => startEdit(memory)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(memory.id)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
