import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

interface HelpMenuProps {
  onDebugConfig: () => void
}

export function HelpMenu({ onDebugConfig }: HelpMenuProps) {
  const { t } = useTranslation('menu')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-3 text-xs font-normal">
          {t('help.label')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        <DropdownMenuItem disabled>
          <span>{t('help.welcome')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <span>{t('help.documentation')}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onDebugConfig}>
          <span>{t('help.debugConfig')}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled>
          <span>{t('help.about')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
