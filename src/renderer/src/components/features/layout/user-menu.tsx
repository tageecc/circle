import { useState, useEffect } from 'react'
import { User, LogOut, Settings } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LoginDialog } from '@/components/features/auth/login-dialog'
import { toast } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'

interface UserMenuProps {
  collapsed?: boolean
}

export function UserMenu({ collapsed = false }: UserMenuProps) {
  const [user, setUser] = useState<any>(null)
  const [showLoginDialog, setShowLoginDialog] = useState(false)

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('auth:getCurrentUser')
      if (result.success) {
        setUser(result.user)
      }
    } catch (error) {
      console.error('Failed to load user:', error)
    }
  }

  const handleLogout = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('auth:logout')
      if (result.success) {
        toast.success('已登出', {
          description: '已退出当前账号'
        })
        setUser(null) // 清空用户状态
      }
    } catch (error: any) {
      toast.error('登出失败', {
        description: error.message
      })
    }
  }

  const getInitials = (name: string) => {
    if (!name) return 'U'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const isLoggedIn = !!user?.email

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              'gap-2 text-sidebar-foreground hover:bg-sidebar-accent',
              collapsed ? 'h-9 w-9 rounded-full p-0' : 'w-full justify-start h-9 px-2'
            )}
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {user ? getInitials(user.displayName || user.username) : 'U'}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex flex-col items-start flex-1 min-w-0">
                <span className="text-xs font-medium truncate w-full">
                  {user?.displayName || user?.username || '默认用户'}
                </span>
                <span className="text-[10px] text-muted-foreground truncate w-full">
                  {user?.email || '本地用户'}
                </span>
              </div>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {user?.displayName || user?.username || '默认用户'}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {user?.email || '本地用户'}
              </p>
              {!isLoggedIn && (
                <p className="text-xs text-muted-foreground mt-1">💡 登录账号以使用 Circle AI</p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {!isLoggedIn ? (
            <DropdownMenuItem onClick={() => setShowLoginDialog(true)}>
              <User className="mr-2 h-4 w-4" />
              登录/注册
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                账号设置
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                登出
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} onSuccess={loadUser} />
    </>
  )
}
