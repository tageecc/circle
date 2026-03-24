import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuShortcut
} from '@/components/ui/dropdown-menu'
import { FilePlus, FolderOpen, Clock, Save, Folder, X as CloseIcon } from 'lucide-react'
import { RecentProject } from '../../types'

interface FileMenuProps {
  activeFile: string | null
  hasOpenFiles: boolean
  workspaceRoot: string | null
  recentProjects: RecentProject[]
  autoSave: boolean
  onOpenProject: () => void
  onOpenRecentProject: (path: string) => void
  onSaveFile: () => void
  onCloseFile: () => void
  onCloseWorkspace: () => void
  onToggleAutoSave: (checked: boolean) => void
}

export function FileMenu({
  activeFile,
  hasOpenFiles,
  workspaceRoot,
  recentProjects,
  autoSave,
  onOpenProject,
  onOpenRecentProject,
  onSaveFile,
  onCloseFile,
  onCloseWorkspace,
  onToggleAutoSave
}: FileMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-3 text-xs font-normal">
          文件
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        <DropdownMenuItem disabled>
          <FilePlus className="mr-2 size-4" />
          <span>新建文本文件</span>
          <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onOpenProject}>
          <FolderOpen className="mr-2 size-4" />
          <span>打开...</span>
          <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onOpenProject}>
          <Folder className="mr-2 size-4" />
          <span>打开文件夹...</span>
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Clock className="mr-2 size-4" />
            <span>最近打开</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-[320px]">
            {recentProjects.length > 0 ? (
              recentProjects.slice(0, 10).map((project) => (
                <DropdownMenuItem
                  key={project.path}
                  onClick={() => onOpenRecentProject(project.path)}
                >
                  <Folder className="mr-2 size-4 text-muted-foreground" />
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm">{project.name}</span>
                    <span className="text-xs text-muted-foreground">{project.path}</span>
                  </div>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>
                <span className="text-muted-foreground">无最近项目</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled={!activeFile} onClick={onSaveFile}>
          <Save className="mr-2 size-4" />
          <span>保存</span>
          <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem disabled={!activeFile}>
          <Save className="mr-2 size-4" />
          <span>另存为...</span>
          <DropdownMenuShortcut>⇧⌘S</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem disabled={!hasOpenFiles}>
          <Save className="mr-2 size-4" />
          <span>全部保存</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuCheckboxItem checked={autoSave} onCheckedChange={onToggleAutoSave}>
          自动保存
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled={!activeFile} onClick={onCloseFile}>
          <CloseIcon className="mr-2 size-4" />
          <span>关闭编辑器</span>
          <DropdownMenuShortcut>⌘W</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem disabled={!workspaceRoot} onClick={onCloseWorkspace}>
          <Folder className="mr-2 size-4" />
          <span>关闭文件夹</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
