import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Slider } from '../ui/slider'
import { Separator } from '../ui/separator'
import { Switch } from '../ui/switch'
import { ProviderSelect } from '../select/ProviderSelect'
import { ModelSelect } from '../select/ModelSelect'
import { AgentFormData } from '@/hooks/useAgent'
import { Brain } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface AgentModelConfigProps {
  agent: any
  editing: boolean
  formData: AgentFormData
  setFormData: (data: AgentFormData) => void
}

export function AgentModelConfig({ agent, editing, formData, setFormData }: AgentModelConfigProps) {
  const { t } = useTranslation('agent')

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('model.provider')}</Label>
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
        <Label>{t('model.model')}</Label>
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
        <Label>{t('model.apiKeyOptional')}</Label>
        {editing ? (
          <Input
            type="password"
            placeholder={t('model.apiKeyPlaceholder')}
            value={formData.apiKey || ''}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
          />
        ) : (
          <p className="text-sm">{agent.apiKey ? t('model.maskedKey') : t('model.useGlobal')}</p>
        )}
        <p className="text-xs text-muted-foreground">{t('model.apiKeyPerAgentHint')}</p>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{t('model.temperature')}</Label>
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
        <p className="text-xs text-muted-foreground">{t('model.temperatureRandomnessShort')}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{t('model.maxTokensLabel')}</Label>
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
        <p className="text-xs text-muted-foreground">{t('model.maxTokensGeneratedShort')}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{t('model.topP')}</Label>
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
        <p className="text-xs text-muted-foreground">{t('model.topPWithTemperatureHint')}</p>
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
                {t('model.enableReasoningShort')}
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
          {t('model.reasoningDescriptionAgent')}
        </p>

        {/* Thinking Budget 配置 */}
        {(editing ? formData.enableReasoning === 1 : agent.enableReasoning === 1) && (
          <div className="space-y-2 pl-12 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <Label htmlFor="thinking-budget" className="text-xs font-medium">
                {t('model.thinkingBudgetShort')}
              </Label>
              <span className="text-xs text-muted-foreground">
                {editing
                  ? formData.thinkingBudget || t('model.modelDefaultShort')
                  : agent.thinkingBudget || t('model.modelDefaultShort')}
              </span>
            </div>
            {editing ? (
              <Input
                id="thinking-budget"
                type="number"
                placeholder={t('model.placeholderModelDefault')}
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
                {agent.thinkingBudget || t('model.useModelDefaultLong')}
              </div>
            )}
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              {t('model.thinkingBudgetRangeHint')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
