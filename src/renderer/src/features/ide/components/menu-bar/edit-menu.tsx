import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuShortcut
} from '@/components/ui/dropdown-menu'

export function EditMenu() {
  const { t } = useTranslation('menu')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-3 text-xs font-normal">
          {t('edit.label')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuItem disabled>
          <span>{t('edit.undo')}</span>
          <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <span>{t('edit.redo')}</span>
          <DropdownMenuShortcut>⇧⌘Z</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled>
          <span>{t('edit.cut')}</span>
          <DropdownMenuShortcut>⌘X</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <span>{t('edit.copy')}</span>
          <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <span>{t('edit.paste')}</span>
          <DropdownMenuShortcut>⌘V</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled>
          <span>{t('edit.find')}</span>
          <DropdownMenuShortcut>⌘F</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <span>{t('edit.replace')}</span>
          <DropdownMenuShortcut>⌥⌘F</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
