import { cn } from '@/lib/utils'
import { extractLanguage } from '@/lib/markdown-utils'
import { memo } from 'react'
import ReactMarkdown, { Components } from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { CodeDisplay } from './code-display'

export type MarkdownProps = {
  children: string
  className?: string
  components?: Partial<Components>
}

const DEFAULT_COMPONENTS: Partial<Components> = {
  // 标题样式
  h1: ({ children, ...props }) => (
    <h1
      className="text-[2em] font-bold text-foreground mt-6 mb-4 first:mt-0 border-b border-border pb-2"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="text-[1.75em] font-bold text-foreground mt-5 mb-3 first:mt-0 border-b border-border pb-2"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-[1.5em] font-semibold text-foreground mt-4 mb-3 first:mt-0" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-[1.25em] font-semibold text-foreground mt-4 mb-2 first:mt-0" {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, ...props }) => (
    <h5 className="text-[1.1em] font-semibold text-foreground mt-3 mb-2 first:mt-0" {...props}>
      {children}
    </h5>
  ),
  h6: ({ children, ...props }) => (
    <h6 className="text-[1em] font-semibold text-muted-foreground mt-3 mb-2 first:mt-0" {...props}>
      {children}
    </h6>
  ),

  // 段落样式
  p: ({ children, ...props }) => (
    <p className="text-foreground leading-relaxed my-3 first:mt-0 last:mb-0" {...props}>
      {children}
    </p>
  ),

  // 链接样式
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),

  // 列表样式
  ul: ({ children, ...props }) => (
    <ul
      className="list-disc list-outside ml-5 my-3 text-foreground space-y-1 first:mt-0 last:mb-0"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className="list-decimal list-outside ml-5 my-3 text-foreground space-y-1 first:mt-0 last:mb-0"
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-foreground leading-relaxed" {...props}>
      {children}
    </li>
  ),

  // 引用样式
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="border-l-4 border-primary/40 bg-muted/50 pl-4 pr-4 py-2 my-3 text-muted-foreground italic first:mt-0 last:mb-0"
      {...props}
    >
      {children}
    </blockquote>
  ),

  // 分隔线样式
  hr: (props) => <hr className="border-0 border-t border-border my-6" {...props} />,

  // 强调样式
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-foreground" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic text-foreground" {...props}>
      {children}
    </em>
  ),

  // 表格样式
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto my-4 first:mt-0 last:mb-0">
      <table className="min-w-full border-collapse border border-border" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
  tr: ({ children, ...props }) => (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border border-border px-4 py-2 text-left font-semibold text-foreground"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-border px-4 py-2 text-foreground" {...props}>
      {children}
    </td>
  ),

  // 行内代码和代码块
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line

    if (isInline) {
      return (
        <code
          className={cn(
            'bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[0.9em] border border-border/50',
            className
          )}
          {...props}
        >
          {children}
        </code>
      )
    }

    const language = extractLanguage(className)

    return <CodeDisplay code={children as string} language={language} />
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>
  }
}

function MarkdownComponent({ children, className, components }: MarkdownProps) {
  return (
    <div className={cn('text-foreground', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{ ...DEFAULT_COMPONENTS, ...components }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

export const Markdown = memo(MarkdownComponent)
