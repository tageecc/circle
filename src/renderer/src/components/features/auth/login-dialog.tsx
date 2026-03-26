import { useState } from 'react'
import { GalleryVerticalEnd } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/sonner'

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function LoginDialog({ open, onOpenChange, onSuccess }: LoginDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('请填写完整信息', {
        description: '邮箱和密码不能为空'
      })
      return
    }

    if (password.length < 8) {
      toast.error('密码太短', {
        description: '密码至少需要8个字符'
      })
      return
    }

    setIsLoading(true)
    try {
      // 调用 IPC 注册
      const result = await window.electron.ipcRenderer.invoke('auth:register', {
        email,
        password,
        displayName: displayName || undefined
      })

      if (result.success) {
        toast.success('注册成功！', {
          description: `账号 ${email} 已创建`
        })
        onSuccess?.()
        onOpenChange(false)
      } else {
        toast.error('注册失败', {
          description: result.error
        })
      }
    } catch (error: any) {
      toast.error('注册失败', {
        description: error.message
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('请填写完整信息', {
        description: '邮箱和密码不能为空'
      })
      return
    }

    setIsLoading(true)
    try {
      // 调用 IPC 登录
      const result = await window.electron.ipcRenderer.invoke('auth:login', {
        email,
        password
      })

      if (result.success) {
        // 检查是否需要合并设备用户数据
        if (result.needsMerge && result.deviceUserId) {
          const shouldMerge = window.confirm(
            '检测到本设备有未登录时创建的会话数据。\n\n是否将这些数据合并到您的账号？'
          )

          if (shouldMerge) {
            try {
              await window.electron.ipcRenderer.invoke('auth:mergeDeviceData', {
                deviceUserId: result.deviceUserId,
                targetUserId: result.user.id
              })
              toast.success('数据合并成功！')
            } catch (mergeError: any) {
              toast.error('数据合并失败', {
                description: mergeError.message
              })
            }
          }
        }

        toast.success('登录成功！', {
          description: `欢迎回来，${result.user.displayName || email}`
        })
        onSuccess?.()
        onOpenChange(false)
      } else {
        toast.error('登录失败', {
          description: result.error
        })
      }
    } catch (error: any) {
      toast.error('登录失败', {
        description: error.message
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex flex-col items-center gap-2 mb-4">
            <div className="flex size-12 items-center justify-center rounded-md bg-primary/10">
              <GalleryVerticalEnd className="size-6 text-primary" />
            </div>
            <DialogTitle className="text-2xl">Circle AI</DialogTitle>
            <DialogDescription>连接你的账号，在多设备间同步数据</DialogDescription>
          </div>
        </DialogHeader>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="login-email">邮箱</FieldLabel>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="login-password">密码</FieldLabel>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </Field>

                <Field>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? '登录中...' : '登录'}
                  </Button>
                </Field>
              </FieldGroup>
            </form>

            <FieldDescription className="mt-4 text-center text-xs text-muted-foreground">
              数据存储在本地数据库，安全可靠
            </FieldDescription>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="register-email">邮箱</FieldLabel>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="register-password">密码</FieldLabel>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="至少8个字符"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                  <FieldDescription>密码长度至少为8个字符</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="display-name">显示名称（可选）</FieldLabel>
                  <Input
                    id="display-name"
                    type="text"
                    placeholder="你的名字"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={isLoading}
                  />
                  <FieldDescription>不填写则使用邮箱作为显示名称</FieldDescription>
                </Field>

                <Field>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? '注册中...' : '注册'}
                  </Button>
                </Field>
              </FieldGroup>
            </form>

            <FieldDescription className="mt-4 text-center text-xs text-muted-foreground">
              注册后即可开始使用 Circle AI
            </FieldDescription>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
