export function LoadingDots() {
  return (
    <div className="flex items-center gap-1">
      <div className="size-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
      <div className="size-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
      <div className="size-2 animate-bounce rounded-full bg-current" />
    </div>
  )
}
