import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ExternalLink, KeyRound, SearchCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/sonner'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { getProvider } from '@/constants/providers'
import { getModelsByProvider } from '@/constants/models'
import { eventBus } from '@/lib/event-bus'
import { CHAT_MODEL_PROVIDERS } from '@/lib/chat-models'
import { getProviderLogoAsset } from '@/lib/provider-logos'
import { useTranslation } from 'react-i18next'
import {
  EMBEDDING_PROVIDER_CONFIGS,
  getEmbeddingProviderConfig,
  providerRequiresApiKey,
  providerSupportsBaseURL
} from '../../../../../shared/provider-config'
import { ProviderSelect } from './provider-select'

interface ProviderCredential {
  providerId: string
  apiKey: string
  baseURL: string | null
  createdAt: Date
  updatedAt: Date
}

const EXTRA_PROVIDER_METADATA: Record<string, { name: string; keyUrl?: string; baseURL?: string }> =
  {
    voyage: {
      name: 'Voyage AI',
      keyUrl: 'https://dash.voyageai.com/api-keys'
    }
  }

export function ModelsSettingsContent() {
  const { t } = useTranslation()
  const [providerCredentials, setProviderCredentials] = useState<
    Record<string, ProviderCredential>
  >({})
  const [vectorSearchEnabled, setVectorSearchEnabled] = useState(false)
  const [embeddingProvider, setEmbeddingProvider] = useState('openai-small')
  const [isLoading, setIsLoading] = useState(true)
  const [isCredentialDialogOpen, setIsCredentialDialogOpen] = useState(false)
  const [credentialProviderId, setCredentialProviderId] = useState('')
  const [credentialApiKey, setCredentialApiKey] = useState('')
  const [credentialBaseURL, setCredentialBaseURL] = useState('')

  const loadState = async () => {
    try {
      const [credentialsData, vectorSettings] = await Promise.all([
        window.api.modelConfig.listProviderCredentials(),
        window.api.modelConfig.getVectorSearchSettings()
      ])

      setProviderCredentials(
        Object.fromEntries(credentialsData.map((credential) => [credential.providerId, credential]))
      )
      setVectorSearchEnabled(vectorSettings.vectorSearchEnabled)
      setEmbeddingProvider(vectorSettings.embeddingProvider)
    } catch (error) {
      console.error('Failed to load model settings:', error)
      toast.error(t('models_settings.load_failed'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadState()
  }, [])

  const getProviderMeta = (providerId: string) => {
    return getProvider(providerId) ?? EXTRA_PROVIDER_METADATA[providerId] ?? null
  }

  const openCredentialDialog = (providerId: string) => {
    const providerMeta = getProviderMeta(providerId)
    const existingCredential = providerCredentials[providerId]

    setCredentialProviderId(providerId)
    setCredentialApiKey(existingCredential?.apiKey ?? '')
    setCredentialBaseURL(existingCredential?.baseURL ?? providerMeta?.baseURL ?? '')
    setIsCredentialDialogOpen(true)
  }

  const closeCredentialDialog = () => {
    setIsCredentialDialogOpen(false)
    setCredentialProviderId('')
    setCredentialApiKey('')
    setCredentialBaseURL('')
  }

  const isProviderConfigured = (providerId: string) => {
    const credential = providerCredentials[providerId]
    if (!credential) {
      return false
    }

    if (providerRequiresApiKey(providerId)) {
      return Boolean(credential.apiKey?.trim())
    }

    if (providerSupportsBaseURL(providerId)) {
      return Boolean(credential.baseURL?.trim() || getProviderMeta(providerId)?.baseURL)
    }

    return true
  }

  const handleSaveCredential = async () => {
    if (!credentialProviderId) {
      return
    }

    if (providerRequiresApiKey(credentialProviderId) && !credentialApiKey.trim()) {
      toast.error(t('models_settings.enter_api_key'))
      return
    }

    if (
      providerSupportsBaseURL(credentialProviderId) &&
      !providerRequiresApiKey(credentialProviderId)
    ) {
      if (!credentialBaseURL.trim()) {
        toast.error(t('models_settings.enter_base_url'))
        return
      }
    }

    try {
      await window.api.modelConfig.setProviderCredential({
        providerId: credentialProviderId,
        apiKey: credentialApiKey.trim(),
        baseURL: providerSupportsBaseURL(credentialProviderId)
          ? credentialBaseURL.trim() || undefined
          : undefined
      })

      toast.success(
        t('models_settings.provider_credentials_saved', {
          provider: getProviderMeta(credentialProviderId)?.name || credentialProviderId
        })
      )

      closeCredentialDialog()
      await loadState()
      eventBus.emit('models-updated')
    } catch (error) {
      console.error('Failed to save provider credentials:', error)
      toast.error(t('models_settings.save_failed'))
    }
  }

  const handleDeleteCredential = async () => {
    if (!credentialProviderId || !providerCredentials[credentialProviderId]) {
      closeCredentialDialog()
      return
    }

    const deletingActiveEmbeddingProvider =
      vectorSearchEnabled &&
      currentEmbeddingConfig &&
      currentEmbeddingConfig.providerId === credentialProviderId

    if (deletingActiveEmbeddingProvider) {
      toast.error(t('models_settings.embedding_provider_in_use'))
      return
    }

    try {
      await window.api.modelConfig.deleteProviderCredential(credentialProviderId)
      toast.success(
        t('models_settings.provider_credentials_deleted', {
          provider: getProviderMeta(credentialProviderId)?.name || credentialProviderId
        })
      )
      closeCredentialDialog()
      await loadState()
      eventBus.emit('models-updated')
    } catch (error) {
      console.error('Failed to delete provider credentials:', error)
      toast.error(t('models_settings.save_failed'))
    }
  }

  const currentEmbeddingConfig = getEmbeddingProviderConfig(embeddingProvider)
  const embeddingProviderConfigured = currentEmbeddingConfig
    ? isProviderConfigured(currentEmbeddingConfig.providerId)
    : false

  const handleVectorSearchToggle = async (checked: boolean) => {
    if (checked && currentEmbeddingConfig && !embeddingProviderConfigured) {
      toast.error(t('models_settings.embedding_credentials_required'))
      openCredentialDialog(currentEmbeddingConfig.providerId)
      return
    }

    setVectorSearchEnabled(checked)
    try {
      await window.api.modelConfig.setVectorSearchSettings({
        vectorSearchEnabled: checked,
        embeddingProvider
      })
      toast.success(
        checked
          ? t('models_settings.vector_search_enabled')
          : t('models_settings.vector_search_disabled')
      )
    } catch (error) {
      console.error('Failed to save vector search settings:', error)
      toast.error(t('models_settings.save_failed'))
      setVectorSearchEnabled(!checked)
    }
  }

  const handleEmbeddingProviderChange = async (value: string) => {
    const nextEmbeddingConfig = getEmbeddingProviderConfig(value)
    const nextProviderConfigured = nextEmbeddingConfig
      ? isProviderConfigured(nextEmbeddingConfig.providerId)
      : false

    if (vectorSearchEnabled && nextEmbeddingConfig && !nextProviderConfigured) {
      toast.error(t('models_settings.embedding_credentials_required'))
      openCredentialDialog(nextEmbeddingConfig.providerId)
      return
    }

    setEmbeddingProvider(value)
    try {
      await window.api.modelConfig.setVectorSearchSettings({
        vectorSearchEnabled,
        embeddingProvider: value
      })
      toast.success(t('models_settings.embedding_provider_updated'))
    } catch (error) {
      console.error('Failed to save embedding provider:', error)
      toast.error(t('models_settings.save_failed'))
    }
  }

  const chatProviderCatalog = useMemo(() => {
    return CHAT_MODEL_PROVIDERS.map((provider) => {
      const added = Boolean(providerCredentials[provider.id])

      return {
        provider,
        added,
        modelCount: getModelsByProvider(provider.id).length
      }
    })
  }, [providerCredentials])

  const configuredChatProviders = useMemo(
    () => chatProviderCatalog.filter(({ added }) => added),
    [chatProviderCatalog]
  )

  const availableProviderOptions = useMemo(
    () =>
      chatProviderCatalog
        .filter(({ added }) => !added)
        .map(({ provider, modelCount }) => ({
          value: provider.id,
          label: provider.name,
          models: modelCount
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [chatProviderCatalog]
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
      </div>
    )
  }

  const credentialProviderMeta = credentialProviderId ? getProviderMeta(credentialProviderId) : null
  const credentialProviderRequiresApiKey = credentialProviderId
    ? providerRequiresApiKey(credentialProviderId)
    : true
  const credentialProviderSupportsBaseURL = credentialProviderId
    ? providerSupportsBaseURL(credentialProviderId)
    : false
  const credentialExists = credentialProviderId
    ? Boolean(providerCredentials[credentialProviderId])
    : false

  return (
    <div className="space-y-8 pb-2">
      <div className="space-y-1.5 border-b border-border/80 pb-5">
        <h2 className="text-lg font-semibold">{t('models_settings.title')}</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t('models_settings.description')}
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20">
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <SearchCode className="h-4 w-4" />
              {t('models_settings.vector_search')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('models_settings.vector_search_description')}
            </p>
          </div>
          <Switch checked={vectorSearchEnabled} onCheckedChange={handleVectorSearchToggle} />
        </div>

        {vectorSearchEnabled && (
          <div className="space-y-4 px-5 py-5">
            {!embeddingProviderConfigured && currentEmbeddingConfig && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {t('models_settings.embedding_credentials_missing', {
                    provider:
                      getProviderMeta(currentEmbeddingConfig.providerId)?.name ??
                      currentEmbeddingConfig.providerId
                  })}
                </span>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="space-y-2.5">
                <Label>{t('models_settings.embedding_provider')}</Label>
                <Select value={embeddingProvider} onValueChange={handleEmbeddingProviderChange}>
                  <SelectTrigger className="w-full bg-background/75">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(EMBEDDING_PROVIDER_CONFIGS).map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentEmbeddingConfig && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 md:mb-0.5"
                  onClick={() => openCredentialDialog(currentEmbeddingConfig.providerId)}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  {t('models_settings.manage_credentials')}
                </Button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">{t('models_settings.providers_title')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('models_settings.providers_description')}
            </p>
          </div>
          <ProviderSelect
            providers={availableProviderOptions}
            disabled={availableProviderOptions.length === 0}
            onChange={openCredentialDialog}
          />
        </div>

        {configuredChatProviders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 px-5 py-8 text-center">
            <h4 className="text-sm font-medium">{t('models_settings.no_providers_title')}</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('models_settings.no_providers_description')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {configuredChatProviders.map(({ provider, modelCount }) => {
              const logo = getProviderLogoAsset(provider.id)

              return (
                <div
                  key={provider.id}
                  className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/30 px-5 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/50">
                        {logo ? (
                          <img
                            src={logo.src}
                            alt={provider.name}
                            className={`size-5 object-contain ${logo.invertInDark ? 'dark:invert' : ''}`}
                          />
                        ) : (
                          <span className="text-xs font-semibold uppercase text-muted-foreground">
                            {provider.id.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-medium">{provider.name}</h4>
                          <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                            {t('models_settings.credentials_configured')}
                          </span>
                          {provider.keyUrl && (
                            <button
                              onClick={() => window.api.shell.openExternal(provider.keyUrl!)}
                              className="text-xs text-muted-foreground hover:text-foreground"
                              title={t('models_settings.get_api_key')}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t('models_settings.available_models_count', { count: modelCount })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => openCredentialDialog(provider.id)}
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    {t('models_settings.manage_credentials')}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <Dialog
        open={isCredentialDialogOpen}
        onOpenChange={(open) => !open && closeCredentialDialog()}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{t('models_settings.manage_credentials')}</DialogTitle>
            <DialogDescription>
              {t('models_settings.manage_credentials_description', {
                provider: credentialProviderMeta?.name || credentialProviderId
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('models_settings.provider')}</Label>
              <Input value={credentialProviderMeta?.name || credentialProviderId} disabled />
            </div>

            {credentialProviderSupportsBaseURL && (
              <div className="space-y-2">
                <Label>{t('models_settings.base_url')}</Label>
                <Input
                  value={credentialBaseURL}
                  onChange={(e) => setCredentialBaseURL(e.target.value)}
                  placeholder={credentialProviderMeta?.baseURL || 'https://api.example.com/v1'}
                />
              </div>
            )}

            {credentialProviderRequiresApiKey && (
              <div className="space-y-2">
                <Label>{t('models_settings.api_key')}</Label>
                <Input
                  type="password"
                  value={credentialApiKey}
                  onChange={(e) => setCredentialApiKey(e.target.value)}
                  placeholder={t('models_settings.enter_api_key_placeholder')}
                />
              </div>
            )}

            {credentialProviderMeta?.keyUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="px-0 text-primary hover:text-primary"
                onClick={() => window.api.shell.openExternal(credentialProviderMeta.keyUrl!)}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t('models_settings.get_api_key')}
              </Button>
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            {credentialExists ? (
              <Button variant="outline" onClick={handleDeleteCredential}>
                {t('common.delete')}
              </Button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={closeCredentialDialog}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveCredential}>{t('common.save')}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
