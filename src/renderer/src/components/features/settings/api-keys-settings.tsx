import { useState, useEffect } from 'react'
import { Eye, EyeOff, Check, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/sonner'

interface ProviderConfig {
  id: string
  name: string
  description: string
  placeholder: string
  docUrl: string
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'dashscope',
    name: 'Alibaba (DashScope)',
    description: '阿里云百炼 API Key',
    placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docUrl: 'https://help.aliyun.com/zh/model-studio/getting-started/first-api-call'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI API Key',
    placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docUrl: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Anthropic API Key',
    placeholder: 'sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docUrl: 'https://console.anthropic.com/settings/keys'
  },
  {
    id: 'google',
    name: 'Google',
    description: 'Google AI Studio API Key',
    placeholder: 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docUrl: 'https://aistudio.google.com/app/apikey'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek API Key',
    placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docUrl: 'https://platform.deepseek.com/api_keys'
  },
  {
    id: 'voyage',
    name: 'Voyage AI',
    description: 'Voyage AI API Key (for code embeddings)',
    placeholder: 'pa-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docUrl: 'https://dash.voyageai.com/api-keys'
  }
]

export function ApiKeysSettings() {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // 加载 API Keys
  useEffect(() => {
    loadApiKeys()
  }, [])

  const loadApiKeys = async () => {
    try {
      const keys = await window.api.config.getApiKeys()
      setApiKeys(keys || {})
    } catch (error) {
      console.error('Failed to load API keys:', error)
      toast.error('加载 API Keys 失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (provider: string, value: string) => {
    setSaving(provider)
    try {
      if (value.trim()) {
        await window.api.config.setApiKey(provider, value.trim())
        toast.success(`${PROVIDERS.find((p) => p.id === provider)?.name} API Key 已保存`)
      } else {
        await window.api.config.deleteApiKey(provider)
        toast.success(`${PROVIDERS.find((p) => p.id === provider)?.name} API Key 已删除`)
      }
      await loadApiKeys()
    } catch (error) {
      console.error('Failed to save API key:', error)
      toast.error('保存失败')
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
        <div className="text-sm text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">API Keys 配置</h3>
        <p className="text-sm text-muted-foreground mt-1">
          配置各个模型提供商的 API Key，以使用对应的模型服务
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
                    <CardDescription className="mt-1">{provider.description}</CardDescription>
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
                        type={isVisible ? 'text' : 'password'}
                        placeholder={provider.placeholder}
                        value={isVisible ? currentValue : maskApiKey(currentValue)}
                        onChange={(e) => {
                          if (isVisible) {
                            setApiKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))
                          }
                        }}
                        onFocus={() => {
                          if (!isVisible && hasKey) {
                            setVisibleKeys((prev) => ({ ...prev, [provider.id]: true }))
                          }
                        }}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => toggleVisibility(provider.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <Button
                      onClick={() => handleSave(provider.id, apiKeys[provider.id] || '')}
                      disabled={isSaving}
                      size="sm"
                    >
                      {isSaving ? '保存中...' : '保存'}
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
