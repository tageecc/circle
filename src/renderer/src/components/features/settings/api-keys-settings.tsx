import { useState, useEffect } from 'react'
import { Eye, EyeOff, Check, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/sonner'
import { useTranslation } from 'react-i18next'

interface ProviderConfig {
  id: string
  name: string
  descriptionKey: string
  placeholder: string
  docUrl: string
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'dashscope',
    name: 'Alibaba (DashScope)',
    descriptionKey: 'api_providers.dashscope_desc',
    placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docUrl: 'https://help.aliyun.com/zh/model-studio/getting-started/first-api-call'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    descriptionKey: 'api_providers.openai_desc',
    placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docUrl: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    descriptionKey: 'api_providers.anthropic_desc',
    placeholder: 'sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docUrl: 'https://console.anthropic.com/settings/keys'
  },
  {
    id: 'google',
    name: 'Google',
    descriptionKey: 'api_providers.google_desc',
    placeholder: 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docUrl: 'https://aistudio.google.com/app/apikey'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    descriptionKey: 'api_providers.deepseek_desc',
    placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docUrl: 'https://platform.deepseek.com/api_keys'
  },
  {
    id: 'voyage',
    name: 'Voyage AI',
    descriptionKey: 'api_providers.voyageai_desc',
    placeholder: 'pa-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docUrl: 'https://dash.voyageai.com/api-keys'
  }
]

export function ApiKeysSettings() {
  const { t } = useTranslation()
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [vectorSearchEnabled, setVectorSearchEnabled] = useState(false)
  const [embeddingProvider, setEmbeddingProvider] = useState('openai-small')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const keys = await window.api.config.getApiKeys()
      setApiKeys(keys || {})

      const serviceSettings = await window.api.config.getServiceSettings()
      setVectorSearchEnabled(serviceSettings.vectorSearchEnabled ?? false)
      setEmbeddingProvider(serviceSettings.embeddingProvider ?? 'openai-small')
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast.error(t('ai_config.load_failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (provider: string, value: string) => {
    setSaving(provider)
    try {
      if (value.trim()) {
        await window.api.config.setApiKey(provider, value.trim())
        const providerName = PROVIDERS.find((p) => p.id === provider)?.name || provider
        toast.success(t('ai_config.api_key_saved', { provider: providerName }))
      } else {
        await window.api.config.deleteApiKey(provider)
        const providerName = PROVIDERS.find((p) => p.id === provider)?.name || provider
        toast.success(t('ai_config.api_key_deleted', { provider: providerName }))
      }
      await loadSettings()
    } catch (error) {
      console.error('Failed to save API key:', error)
      toast.error(t('ai_config.save_failed'))
    } finally {
      setSaving(null)
    }
  }

  const toggleVisibility = (provider: string) => {
    setVisibleKeys((prev) => ({ ...prev, [provider]: !prev[provider] }))
  }

  const maskApiKey = (key: string) => {
    if (!key) return ''
    if (key.length <= 8) return '••••••••'
    return key.slice(0, 4) + '••••••••' + key.slice(-4)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">{t('ai_config.loading')}</div>
      </div>
    )
  }

  const handleVectorSearchToggle = async (checked: boolean) => {
    setVectorSearchEnabled(checked)
    try {
      await window.api.config.setServiceSettings({
        vectorSearchEnabled: checked
      })
      toast.success(checked ? t('ai_config.vector_search_enabled') : t('ai_config.vector_search_disabled'))
    } catch (error) {
      console.error('Failed to save vector search setting:', error)
      toast.error(t('ai_config.save_failed'))
    }
  }

  const handleEmbeddingProviderChange = async (value: string) => {
    setEmbeddingProvider(value)
    try {
      await window.api.config.setServiceSettings({
        embeddingProvider: value
      })
      toast.success(t('ai_config.embedding_provider_updated'))
    } catch (error) {
      console.error('Failed to save embedding provider:', error)
      toast.error(t('ai_config.save_failed'))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">AI 配置</h3>
        <p className="text-sm text-muted-foreground mt-1">
          配置 API Keys 和向量搜索，以使用 AI 服务
        </p>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map((provider) => {
          const currentValue = apiKeys[provider.id] || ''
          const isVisible = visibleKeys[provider.id]
          const isSaving = saving === provider.id
          const hasKey = !!currentValue

          return (
            <Card key={provider.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {provider.name}
                      {hasKey && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                          <Check className="size-3" />
                          已配置
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">{t(provider.descriptionKey)}</CardDescription>
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs"
                    onClick={() => window.open(provider.docUrl, '_blank')}
                  >
                    获取 API Key
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor={`apikey-${provider.id}`}>API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id={`apikey-${provider.id}`}
                        type={isVisible || !hasKey ? 'text' : 'password'}
                        placeholder={provider.placeholder}
                        value={isVisible || !hasKey ? currentValue : maskApiKey(currentValue)}
                        onChange={(e) => {
                          setApiKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))
                        }}
                        onFocus={() => {
                          if (!isVisible && hasKey) {
                            setVisibleKeys((prev) => ({ ...prev, [provider.id]: true }))
                          }
                        }}
                        className="pr-10"
                      />
                      {hasKey && (
                        <button
                          type="button"
                          onClick={() => toggleVisibility(provider.id)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      )}
                    </div>
                    <Button
                      onClick={() => handleSave(provider.id, apiKeys[provider.id] || '')}
                      disabled={isSaving}
                      size="sm"
                    >
                      {isSaving ? t('common.saving') : t('common.save')}
                    </Button>
                    {hasKey && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setApiKeys((prev) => ({ ...prev, [provider.id]: '' }))
                          handleSave(provider.id, '')
                        }}
                        disabled={isSaving}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {!hasKey && (
                  <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                    <AlertCircle className="size-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="text-muted-foreground">
                      未配置 API Key，将无法使用 {provider.name} 的模型
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-medium mb-4">向量语义搜索</h3>
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">启用向量搜索</CardTitle>
                <CardDescription className="mt-1">
                  使用 AI Embeddings 实现代码语义搜索（理解含义，不仅匹配关键词）
                </CardDescription>
              </div>
              <Switch
                checked={vectorSearchEnabled}
                onCheckedChange={handleVectorSearchToggle}
              />
            </div>
          </CardHeader>
          
          {vectorSearchEnabled && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Embedding Provider</Label>
                <Select value={embeddingProvider} onValueChange={handleEmbeddingProviderChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai-small">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">OpenAI Small</span>
                        <span className="text-xs text-muted-foreground">1536 维，$0.02/1M tokens（推荐）</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="openai-large">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">OpenAI Large</span>
                        <span className="text-xs text-muted-foreground">3072 维，$0.13/1M tokens（更精确）</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="voyage-code">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Voyage AI Code</span>
                        <span className="text-xs text-muted-foreground">1536 维，$0.10/1M tokens（代码优化）</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="qwen-embed">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Qwen Embedding</span>
                        <span className="text-xs text-muted-foreground">1024 维，¥0.7/1M tokens（中文友好）</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p>• 需配置对应 provider 的 API Key（见上方）</p>
                <p>• 切换 provider 时会自动重建索引</p>
                <p>• 关闭开关后仍可搜索（使用文本匹配）</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-2 text-sm">
            <p className="font-medium">安全提示</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>API Key 将加密存储在本地，不会上传到任何服务器</li>
              <li>请妥善保管您的 API Key，不要分享给他人</li>
              <li>如果 API Key 泄露，请立即在对应平台重新生成</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
