import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import { Bot, Upload, Trash } from 'lucide-react'
import { AgentFormData } from '@/hooks/useAgent'

interface AgentBasicInfoProps {
  agent: any
  editing: boolean
  formData: AgentFormData
  setFormData: (data: AgentFormData) => void
  avatarPreview: string | null
  onSelectAvatar: () => void
  onRemoveAvatar: () => void
}

export function AgentBasicInfo({
  agent,
  editing,
  formData,
  setFormData,
  avatarPreview,
  onSelectAvatar,
  onRemoveAvatar
}: AgentBasicInfoProps) {
  return (
    <div className="space-y-4">
      {editing && (
        <>
          <div className="space-y-2">
            <Label>头像</Label>
            <div className="flex items-center gap-3">
              <Avatar className="size-16">
                {avatarPreview ? <AvatarImage src={avatarPreview} alt={agent.name} /> : null}
                <AvatarFallback className="bg-primary">
                  <Bot className="size-8 text-primary-foreground" />
                </AvatarFallback>
              </Avatar>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={onSelectAvatar} className="gap-2">
                  <Upload className="size-3" />
                  上传头像
                </Button>
                {avatarPreview && (
                  <Button size="sm" variant="outline" onClick={onRemoveAvatar} className="gap-2">
                    <Trash className="size-3" />
                    删除
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              支持 JPG、PNG、GIF、WebP、SVG 格式，大小不超过 5MB
            </p>
          </div>
          <Separator />
        </>
      )}

      <div className="space-y-2">
        <Label>名称</Label>
        {editing ? (
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        ) : (
          <p className="text-sm">{agent.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>描述</Label>
        {editing ? (
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="min-h-[80px]"
          />
        ) : (
          <p className="text-sm text-muted-foreground">{agent.description || '暂无描述'}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>系统指令</Label>
        {editing ? (
          <Textarea
            value={formData.instructions}
            onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
            className="min-h-[200px] font-mono text-xs"
            placeholder="你是一个有用的 AI 助手..."
          />
        ) : (
          <div className="rounded-md border border-border bg-muted/50 p-3">
            <p className="whitespace-pre-wrap text-xs font-mono">
              {agent.instructions || '暂无系统指令'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
