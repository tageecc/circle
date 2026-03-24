import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Slider } from '../ui/slider'
import { Separator } from '../ui/separator'
import { Switch } from '../ui/switch'
import { ProviderSelect } from '../select/ProviderSelect'
import { ModelSelect } from '../select/ModelSelect'
import { AgentFormData } from '@/hooks/useAgent'
import { Brain } from 'lucide-react'

interface AgentModelConfigProps {
  agent: any
  editing: boolean
  formData: AgentFormData
  setFormData: (data: AgentFormData) => void
}

export function AgentModelConfig({ agent, editing, formData, setFormData }: AgentModelConfigProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>模型提供商</Label>
        {editing ? (
          <ProviderSelect
            value={formData.provider}
            onChange={(value) => setFormData({ ...formData, provider: value })}
          />
        ) : (
          <p className="text-sm">{agent.provider}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>模型</Label>
        {editing ? (
          <ModelSelect
            provider={formData.provider}
            value={formData.model}
            onChange={(value) => setFormData({ ...formData, model: value })}
          />
        ) : (
          <p className="text-sm">{agent.model}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>API Key（可选）</Label>
        {editing ? (
          <Input
            type="password"
            placeholder="留空则使用全局环境变量"
            value={formData.apiKey || ''}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
          />
        ) : (
          <p className="text-sm">{agent.apiKey ? '••••••••' : '使用全局配置'}</p>
        )}
        <p className="text-xs text-muted-foreground">
          为此 Agent 单独配置 API Key，留空则使用环境变量中的全局配置
        </p>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Temperature</Label>
          <span className="text-sm text-muted-foreground">{formData.temperature}</span>
        </div>
        {editing ? (
          <Slider
            value={[formData.temperature]}
            onValueChange={([value]) => setFormData({ ...formData, temperature: value })}
            min={0}
            max={2}
            step={0.1}
            className="w-full"
          />
        ) : (
          <div className="text-sm text-muted-foreground">{agent.temperature}</div>
        )}
        <p className="text-xs text-muted-foreground">
          控制输出的随机性。较高的值会使输出更随机，较低的值会使其更确定。
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Max Tokens</Label>
          <span className="text-sm text-muted-foreground">{formData.maxTokens}</span>
        </div>
        {editing ? (
          <Input
            type="number"
            value={formData.maxTokens}
            onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
            min={1}
            max={8192}
          />
        ) : (
          <div className="text-sm text-muted-foreground">{agent.maxTokens}</div>
        )}
        <p className="text-xs text-muted-foreground">生成的最大 token 数量。</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Top P</Label>
          <span className="text-sm text-muted-foreground">{formData.topP}</span>
        </div>
        {editing ? (
          <Slider
            value={[formData.topP]}
            onValueChange={([value]) => setFormData({ ...formData, topP: value })}
            min={0}
            max={1}
            step={0.05}
            className="w-full"
          />
        ) : (
          <div className="text-sm text-muted-foreground">{agent.topP}</div>
        )}
        <p className="text-xs text-muted-foreground">
          控制采样的多样性。建议与 temperature 二选一调整。
        </p>
      </div>

      <Separator />

      {/* Reasoning 开关和配置 */}
      <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-4 transition-colors hover:border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <Label htmlFor="enable-reasoning" className="text-sm font-medium cursor-pointer">
                启用思考模式
              </Label>
            </div>
          </div>
          {editing ? (
            <Switch
              id="enable-reasoning"
              checked={formData.enableReasoning === 1}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, enableReasoning: checked ? 1 : 0 })
              }
            />
          ) : (
            <Switch id="enable-reasoning" checked={agent.enableReasoning === 1} disabled />
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed pl-12">
          启用后，Agent 会展示详细的推理思考过程。此功能需要模型支持（如 Qwen3、qwen-plus 等）。
        </p>

        {/* Thinking Budget 配置 */}
        {(editing ? formData.enableReasoning === 1 : agent.enableReasoning === 1) && (
          <div className="space-y-2 pl-12 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <Label htmlFor="thinking-budget" className="text-xs font-medium">
                思考长度限制
              </Label>
              <span className="text-xs text-muted-foreground">
                {editing
                  ? formData.thinkingBudget || '模型默认'
                  : agent.thinkingBudget || '模型默认'}
              </span>
            </div>
            {editing ? (
              <Input
                id="thinking-budget"
                type="number"
                placeholder="留空使用模型默认值"
                value={formData.thinkingBudget || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    thinkingBudget: e.target.value ? parseInt(e.target.value) : undefined
                  })
                }
                min={512}
                max={32768}
                className="h-8 text-xs"
              />
            ) : (
              <div className="text-xs text-muted-foreground">
                {agent.thinkingBudget || '使用模型默认值'}
              </div>
            )}
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              限制思考过程的最大 token 数量。留空则使用模型的默认最大思维链长度。建议范围：512-32768
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
