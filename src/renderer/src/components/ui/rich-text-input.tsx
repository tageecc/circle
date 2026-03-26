import { forwardRef, useRef, useEffect, useImperativeHandle, useCallback, type HTMLAttributes } from 'react'
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Node, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { cn } from '@/lib/utils'
import {
  Attachment as AttachmentComponent,
  AttachmentHoverCard,
  AttachmentHoverCardContent,
  AttachmentHoverCardTrigger,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
  getAttachmentLabel,
  getMediaCategory
} from '@/components/ai-elements/attachments'

// 扩展 Commands 接口
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    attachment: {
      setAttachment: (attributes: Attachment) => ReturnType
    }
  }
}

export interface PastedImage {
  id: string
  dataUrl: string
  name: string
  size: number
}

export interface Attachment {
  id: string
  name: string
  size: number
  type: string // MIME type
  data: string // base64 data URL
  isImage: boolean
}

/**
 * TipTap 附件节点渲染组件
 */
function AttachmentNodeView({ node, deleteNode }: NodeViewProps) {
  const attachment = {
    id: node.attrs.id,
    type: 'file' as const,
    url: node.attrs.data,
    mediaType: node.attrs.mimeType,
    filename: node.attrs.name
  }

  const mediaCategory = getMediaCategory(attachment)
  const label = getAttachmentLabel(attachment)

  return (
    <NodeViewWrapper as="span" className="inline-flex items-center mx-1" contentEditable={false}>
      <Attachments variant="inline">
        <AttachmentHoverCard>
          <AttachmentHoverCardTrigger asChild>
            <AttachmentComponent data={attachment} onRemove={deleteNode}>
              <div className="relative size-3.5 shrink-0">
                <div className="absolute inset-0 transition-opacity group-hover:opacity-0">
                  <AttachmentPreview />
                </div>
                <AttachmentRemove className="absolute inset-0" />
              </div>
              <AttachmentInfo />
            </AttachmentComponent>
          </AttachmentHoverCardTrigger>
          <AttachmentHoverCardContent>
            {mediaCategory === 'image' && attachment.url && (
              <img
                alt={label}
                src={attachment.url}
                className="max-w-xs max-h-96 rounded"
              />
            )}
            <div className="mt-2">
              <div className="font-medium text-sm">{label}</div>
              {attachment.mediaType && (
                <div className="text-xs text-muted-foreground font-mono">{attachment.mediaType}</div>
              )}
            </div>
          </AttachmentHoverCardContent>
        </AttachmentHoverCard>
      </Attachments>
    </NodeViewWrapper>
  )
}

/**
 * TipTap 附件扩展
 */
const AttachmentExtension = Node.create({
  name: 'attachment',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      id: { default: null },
      name: { default: null },
      data: { default: null },
      mimeType: { default: null },
      size: { default: 0 },
      isImage: { default: false }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-attachment]'
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-attachment': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentNodeView)
  },

  addCommands() {
    return {
      setAttachment:
        (attributes: Attachment) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              id: attributes.id,
              name: attributes.name,
              data: attributes.data,
              mimeType: attributes.type,
              size: attributes.size,
              isImage: attributes.isImage
            }
          })
        }
    }
  }
})

export interface RichTextInputProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onSend?: () => void
  disabled?: boolean
  onPastedImagesChange: (images: PastedImage[]) => void
  onAttachmentsChange?: (attachments: Attachment[]) => void
  autoFocus?: boolean
}

/**
 * 富文本输入框组件（基于 TipTap）
 */
const RichTextInput = forwardRef<HTMLDivElement, RichTextInputProps>(
  (
    {
      placeholder = 'Ask, Search or Chat...',
      value,
      onChange,
      onSend,
      disabled = false,
      className,
      style,
      onPastedImagesChange,
      onAttachmentsChange,
      autoFocus = false,
      ...props
    },
    ref
  ) => {
    const editorDivRef = useRef<HTMLDivElement>(null)
    const onChangeRef = useRef(onChange)
    const onPastedImagesChangeRef = useRef(onPastedImagesChange)
    const onAttachmentsChangeRef = useRef(onAttachmentsChange)
    const onSendRef = useRef(onSend)
    const editorRef = useRef<ReturnType<typeof useEditor>>(null)
    
    useEffect(() => {
      onChangeRef.current = onChange
      onPastedImagesChangeRef.current = onPastedImagesChange
      onAttachmentsChangeRef.current = onAttachmentsChange
      onSendRef.current = onSend
    }, [onChange, onPastedImagesChange, onAttachmentsChange, onSend])
    
    useImperativeHandle(ref, () => editorDivRef.current!)

    // 从 editor 提取附件
    const extractAttachments = useCallback((doc: any): Attachment[] => {
      const attachments: Attachment[] = []
      doc.descendants((node: any) => {
        if (node.type.name === 'attachment') {
          attachments.push({
            id: node.attrs.id,
            name: node.attrs.name,
            size: node.attrs.size,
            type: node.attrs.mimeType,
            data: node.attrs.data,
            isImage: node.attrs.isImage
          })
        }
      })
      return attachments
    }, [])

    // 处理文件
    const handleFile = useCallback((file: File) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        if (dataUrl && editorRef.current) {
          const attachment: Attachment = {
            id: `${Date.now()}-${Math.random()}`,
            name: file.name,
            size: file.size,
            type: file.type,
            data: dataUrl,
            isImage: file.type.startsWith('image/')
          }
          editorRef.current.chain().focus().setAttachment(attachment).run()
        }
      }
      reader.readAsDataURL(file)
    }, [])

    const editor = useEditor(
      {
        extensions: [
          StarterKit.configure({
            bold: false,
            italic: false,
            strike: false,
            code: false,
            codeBlock: false,
            heading: false,
            blockquote: false,
            horizontalRule: false,
            bulletList: false,
            orderedList: false,
            listItem: false,
            paragraph: {
              HTMLAttributes: {
                class: 'm-0 text-left leading-normal'
              }
            }
          }),
          AttachmentExtension,
          Placeholder.configure({
            placeholder
          })
        ],
        editable: !disabled,
        onUpdate: ({ editor }) => {
          onChangeRef.current(editor.getText())
          
          const attachments = extractAttachments(editor.state.doc)
          onAttachmentsChangeRef.current?.(attachments)
          
          // 向后兼容：提取图片给 onPastedImagesChange
          onPastedImagesChangeRef.current(
            attachments
              .filter(att => att.isImage)
              .map(att => ({ id: att.id, dataUrl: att.data, name: att.name, size: att.size }))
          )
        },
        editorProps: {
          attributes: {
            class: cn(
              'w-full min-h-[1.25em] max-h-[calc(1.25em*10+1.5rem)] overflow-y-auto cursor-text',
              'whitespace-pre-wrap break-words text-left px-3 py-2.5',
              'text-sm text-foreground leading-normal focus:outline-none',
              '[&_p]:my-0 [&_p]:leading-normal [&_p]:cursor-text',
              disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
            ),
            spellcheck: 'false'
          },
          handleKeyDown: (view, event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              if (onSendRef.current && view.state.doc.textContent.trim()) {
                onSendRef.current()
              }
              return true
            }
            return false
          },
          handlePaste: (_view, event) => {
            const files = Array.from(event.clipboardData?.items || [])
              .map(item => item.getAsFile())
              .filter((file): file is File => file !== null)

            if (files.length > 0) {
              event.preventDefault()
              files.forEach(handleFile)
              return true
            }
            
            return false
          }
        }
      },
      [placeholder, disabled]
    )
    
    // 保存 editor 引用
    useEffect(() => {
      editorRef.current = editor
    }, [editor])

    // 同步外部 value 变化
    useEffect(() => {
      if (!editor) return
      
      const currentText = editor.getText()
      
      // 清空
      if (!value && currentText) {
        editor.commands.clearContent()
        return
      }
      
      // 同步内容（处理换行）
      if (value && currentText !== value) {
        // 将 \n 转换为 TipTap 段落结构
        const content = value.split('\n').map(line => {
          if (!line) {
            return { type: 'paragraph' }
          }
          return {
            type: 'paragraph',
            content: [{ type: 'text', text: line }]
          }
        })
        
        editor.commands.setContent(content)
      }
    }, [editor, value])
    
    // 自动聚焦
    useEffect(() => {
      if (editor && autoFocus) {
        editor.commands.focus('end')
      }
    }, [editor, autoFocus])

    const handleContainerClick = (e: React.MouseEvent) => {
      // 只处理容器本身的点击，点击内容时让 TipTap 自然处理
      if (!disabled && editorRef.current && e.target === editorDivRef.current) {
        editorRef.current.commands.focus('end')
      }
    }

    // 处理拖放
    const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault()
      if (!disabled) {
        Array.from(e.dataTransfer.files).forEach(handleFile)
      }
    }, [disabled, handleFile])

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault()
    }, [])

    return (
      <div 
        ref={editorDivRef} 
        data-slot="rich-text-input"
        className={cn('flex-1 w-full cursor-text', className)} 
        style={style}
        onClick={handleContainerClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        {...props}
      >
        <EditorContent editor={editor} />
      </div>
    )
  }
)

RichTextInput.displayName = 'RichTextInput'

export { RichTextInput }
