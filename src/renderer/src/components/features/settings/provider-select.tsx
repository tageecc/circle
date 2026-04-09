import { useEffect, useRef, useState, type ReactElement } from 'react'
import { ChevronsUpDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getProviderLogoAsset } from '@/lib/provider-logos'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

export interface ProviderOption {
  value: string
  label: string
  models: number
}

interface ProviderSelectProps {
  providers: ProviderOption[]
  onChange: (value: string) => void
  disabled?: boolean
}

export function ProviderSelect({
  providers,
  onChange,
  disabled
}: ProviderSelectProps): ReactElement {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const dialogContent = triggerRef.current?.closest('[data-slot=\"dialog-content\"]')
    setPortalContainer(dialogContent instanceof HTMLElement ? dialogContent : null)
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          className="justify-between gap-2"
          disabled={disabled || providers.length === 0}
        >
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t('models_settings.add_provider')}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        container={portalContainer}
        className="w-[360px] max-w-[min(360px,var(--radix-popover-content-available-width))] overflow-hidden p-0"
        align="end"
      >
        <Command>
          <CommandInput placeholder={t('provider_select.search_placeholder')} />
          <CommandEmpty>{t('provider_select.empty')}</CommandEmpty>
          <CommandList
            className="max-h-[min(18rem,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain p-1.5"
            onWheelCapture={(event) => event.stopPropagation()}
          >
            <CommandGroup className="overflow-visible p-0">
              {providers.map((provider) => {
                const logo = getProviderLogoAsset(provider.value)

                return (
                  <CommandItem
                    key={provider.value}
                    value={`${provider.label} ${provider.value}`}
                    onSelect={() => {
                      onChange(provider.value)
                      setOpen(false)
                    }}
                    className="cursor-pointer gap-3 rounded-xl px-3 py-3"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/70">
                      {logo ? (
                        <img
                          src={logo.src}
                          alt={provider.label}
                          className={cn(
                            'size-4 object-contain',
                            logo.invertInDark && 'dark:invert'
                          )}
                        />
                      ) : (
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                          {provider.value.slice(0, 2)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{provider.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {t('provider_select.models_count', { count: provider.models })}
                      </div>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
