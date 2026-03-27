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

interface UserRule {
  id: string
  content: string
  createdAt: number
  updatedAt: number
}

export function UserRulesSettingsContent() {
  const { t } = useTranslation()
  const [rules, setRules] = useState<UserRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [content, setContent] = useState('')

  const loadRules = async () => {
    try {
      setIsLoading(true)
      const data = await window.api.userRule.getAll()
      setRules(data)
    } catch (error) {
      console.error('Failed to load user rules:', error)
      toast.error(t('user_rules.load_failed'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadRules()
  }, [])

  const handleCreate = async () => {
    if (!content.trim()) {
      toast.error(t('user_rules.empty_content'))
      return
    }

    try {
      await window.api.userRule.create(content.trim())
      toast.success(t('user_rules.create_success'))
      setContent('')
      setIsCreating(false)
      await loadRules()
    } catch (error) {
      console.error('Failed to create user rule:', error)
      toast.error(t('user_rules.create_failed'))
    }
  }

  const handleUpdate = async (ruleId: string) => {
    if (!content.trim()) {
      toast.error(t('user_rules.empty_content'))
      return
    }

    try {
      await window.api.userRule.update(ruleId, content.trim())
      toast.success(t('user_rules.update_success'))
      setEditingId(null)
      setContent('')
      await loadRules()
    } catch (error) {
      console.error('Failed to update user rule:', error)
      toast.error(t('user_rules.update_failed'))
    }
  }

  const handleDelete = async (ruleId: string) => {
    try {
      await window.api.userRule.delete(ruleId)
      toast.success(t('user_rules.delete_success'))
      await loadRules()
    } catch (error) {
      console.error('Failed to delete user rule:', error)
      toast.error(t('user_rules.delete_failed'))
    }
  }

  const startEdit = (rule: UserRule) => {
    setEditingId(rule.id)
    setContent(rule.content)
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
        <div className="text-sm text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">User Rules</h3>
        {!isCreating && !editingId && (
          <Button onClick={startCreate} variant="ghost" size="sm" className="h-7 gap-1">
            <Plus className="w-3.5 h-3.5" />
            添加
          </Button>
        )}
      </div>

      {/* 创建新规则表单 */}
      {isCreating && (
        <InputGroup>
          <InputGroupTextarea
            placeholder={t('user_rules.placeholder')}
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

      <div className="space-y-1.5">
        {/* 规则列表 */}
        {rules.length === 0 && !isCreating ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">暂无规则</p>
          </div>
        ) : (
          rules.map((rule) => (
            <div
              key={rule.id}
              className="group rounded-lg border bg-card p-2.5 hover:bg-accent/50 transition-colors"
            >
              {editingId === rule.id ? (
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
                      onClick={() => handleUpdate(rule.id)}
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
                    {rule.content}
                  </p>
                  <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      onClick={() => startEdit(rule)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(rule.id)}
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
