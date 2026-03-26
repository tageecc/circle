export function LoadingScreen() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        {/* 旋转加载图标 */}
        <div className="relative">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" />
          <div className="absolute inset-0 h-12 w-12 animate-pulse rounded-full border-4 border-primary/20" />
        </div>

        {/* 加载文字 */}
        <div className="flex flex-col items-center gap-2">
          <div className="text-sm font-medium text-foreground">正在加载工作区</div>
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
          </div>
        </div>
      </div>
    </div>
  )
}
