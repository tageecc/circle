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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function LoginDialog({ open, onOpenChange, onSuccess }: LoginDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [mergeStrategy, setMergeStrategy] = useState<'keep_both' | 'prefer_local' | 'prefer_cloud'>(
    'keep_both'
  )
  const { toast } = useToast()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast({
        title: '请输入邮箱',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)
    try {
      // 调用 IPC 注册
      const result = await window.electron.ipcRenderer.invoke('auth:register', {
        email,
        displayName: displayName || undefined
      })

      if (result.success) {
        toast({
          title: '注册成功！',
          description: `已将本地数据关联到账号 ${email}`
        })
        onSuccess?.()
        onOpenChange(false)
      } else {
        toast({
          title: '注册失败',
          description: result.error,
          variant: 'destructive'
        })
      }
    } catch (error: any) {
      toast({
        title: '注册失败',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast({
        title: '请输入邮箱',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)
    try {
      // 调用 IPC 登录
      const result = await window.electron.ipcRenderer.invoke('auth:login', {
        email,
        mergeStrategy
      })

      if (result.success) {
        const { conflicts, mergeResult } = result

        // 显示合并结果
        if (conflicts?.hasConflicts) {
          toast({
            title: '登录成功，数据已合并',
            description: `检测到 ${conflicts.memories.length} 个记忆冲突，已按"${getMergeStrategyText(mergeStrategy)}"策略处理`
          })
        } else {
          toast({
            title: '登录成功！',
            description: `欢迎回来，${email}`
          })
        }

        // 显示合并统计
        if (mergeResult) {
          console.log('合并结果:', mergeResult)
        }

        onSuccess?.()
        onOpenChange(false)
      } else {
        toast({
          title: '登录失败',
          description: result.error,
          variant: 'destructive'
        })
      }
    } catch (error: any) {
      toast({
        title: '登录失败',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getMergeStrategyText = (strategy: string) => {
    const map = {
      keep_both: '保留双方',
      prefer_local: '优先本地',
      prefer_cloud: '优先云端'
    }
    return map[strategy] || strategy
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
                  <FieldLabel htmlFor="merge-strategy">数据合并策略</FieldLabel>
                  <Select
                    value={mergeStrategy}
                    onValueChange={(value: any) => setMergeStrategy(value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep_both">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">保留双方（推荐）</span>
                          <span className="text-xs text-muted-foreground">
                            本地和云端数据都保留，冲突时自动重命名
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="prefer_local">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">优先本地</span>
                          <span className="text-xs text-muted-foreground">冲突时保留本地数据</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="prefer_cloud">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">优先云端</span>
                          <span className="text-xs text-muted-foreground">
                            冲突时使用云端数据覆盖
                          </span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>选择当本地数据与账号数据冲突时的处理方式</FieldDescription>
                </Field>

                <Field>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? '登录中...' : '登录并合并数据'}
                  </Button>
                </Field>
              </FieldGroup>
            </form>

            <FieldDescription className="mt-4 text-center text-xs text-muted-foreground">
              暂时不连接云端，数据存储在本地数据库
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
                    {isLoading ? '注册中...' : '注册并上传数据'}
                  </Button>
                </Field>
              </FieldGroup>
            </form>

            <FieldDescription className="mt-4 text-center text-xs text-muted-foreground">
              注册后，当前电脑的所有数据将关联到这个账号
            </FieldDescription>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
