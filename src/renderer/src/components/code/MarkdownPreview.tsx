import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import remarkBreaks from 'remark-breaks'
import { cn } from '@/lib/utils'
import { extractLanguage } from '@/lib/markdown-utils'
import { CodeDisplay } from '../ui/code-display'

interface MarkdownPreviewProps {
  content: string
  className?: string
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  return (
    <div className={cn('h-full w-full overflow-auto bg-background px-8 py-6', className)}>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          rehypePlugins={[rehypeRaw]}
          components={{
            // 自定义代码块样式 - 使用 Monaco Editor
            code({
              node,
              className,
              children,
              ...props
            }: {
              node?: { position?: { start: { line: number }; end: { line: number } } }
              className?: string
              children?: ReactNode
            } & ComponentPropsWithoutRef<'code'>) {
              const pos = node?.position
              const isInline = !pos?.start.line || pos.start.line === pos.end.line

              if (isInline) {
                return (
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm" {...props}>
                    {children}
                  </code>
                )
              }

              const language = extractLanguage(className)

              return <CodeDisplay code={children as string} language={language} showCopy={true} />
            },
            pre: function PreComponent({ children }) {
              return <>{children}</>
            },
            // 自定义链接样式
            a({ node: _node, children, ...props }) {
              return (
                <a
                  className="text-primary underline-offset-4 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}
                >
                  {children}
                </a>
              )
            },
            // 自定义表格样式
            table({ node: _node, children, ...props }) {
              return (
                <div className="my-6 w-full overflow-y-auto">
                  <table className="w-full" {...props}>
                    {children}
                  </table>
                </div>
              )
            },
            // 自定义引用块样式
            blockquote({ node: _node, children, ...props }) {
              return (
                <blockquote
                  className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground"
                  {...props}
                >
                  {children}
                </blockquote>
              )
            },
            // 自定义标题样式
            h1({ node: _node, children, ...props }) {
              return (
                <h1
                  className="mb-4 mt-6 border-b pb-2 text-3xl font-bold tracking-tight"
                  {...props}
                >
                  {children}
                </h1>
              )
            },
            h2({ node: _node, children, ...props }) {
              return (
                <h2
                  className="mb-3 mt-5 border-b pb-2 text-2xl font-semibold tracking-tight"
                  {...props}
                >
                  {children}
                </h2>
              )
            },
            h3({ node: _node, children, ...props }) {
              return (
                <h3 className="mb-2 mt-4 text-xl font-semibold tracking-tight" {...props}>
                  {children}
                </h3>
              )
            },
            // 自定义列表样式
            ul({ node: _node, children, ...props }) {
              return (
                <ul className="my-4 ml-6 list-disc space-y-2" {...props}>
                  {children}
                </ul>
              )
            },
            ol({ node: _node, children, ...props }) {
              return (
                <ol className="my-4 ml-6 list-decimal space-y-2" {...props}>
                  {children}
                </ol>
              )
            },
            // 自定义任务列表样式
            li({ node: _node, children, ...props }) {
              const content = String(children)
              // 检测任务列表
              if (content.includes('input type="checkbox"')) {
                return (
                  <li className="flex items-start gap-2 list-none" {...props}>
                    {children}
                  </li>
                )
              }
              return <li {...props}>{children}</li>
            },
            // 自定义图片样式
            img({ node: _node, ...props }) {
              return (
                <img className="max-w-full rounded-lg border shadow-sm" loading="lazy" {...props} />
              )
            },
            // 自定义分隔线样式
            hr({ node: _node, ...props }) {
              return <hr className="my-8 border-border" {...props} />
            }
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
