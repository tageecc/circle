import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import remarkBreaks from 'remark-breaks'
import { cn } from '@/lib/utils'
import { MARKDOWN_COMPONENTS } from '@/components/ui/markdown'

interface MarkdownPreviewProps {
  content: string
  className?: string
}

/**
 * Markdown 文件预览组件
 * 用于编辑器中预览 .md 文件
 * 复用统一的 MARKDOWN_COMPONENTS 配置
 */
export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  return (
    <div className={cn('h-full w-full overflow-auto bg-background px-8 py-6', className)}>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          rehypePlugins={[rehypeRaw]}
          components={MARKDOWN_COMPONENTS}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
