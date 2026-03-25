import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor
} from '../ui/chat-container'
import { ScrollButton } from '../ui/scroll-button'
import { MessageSquare, X, Send, Loader2, Bot, Brain } from 'lucide-react'
import { Message, MessageAvatar, MessageContent } from '../ui/message'
import { Markdown } from '../ui/markdown'
import { Reasoning, ReasoningTrigger, ReasoningContent } from '../ui/reasoning'
import { useTranslation } from 'react-i18next'

interface AgentTestChatProps {
  agentId: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
  isStreaming?: boolean
}

export function AgentTestChat({ agentId }: AgentTestChatProps) {
  const { t } = useTranslation('agent')
  const [testMessages, setTestMessages] = useState<ChatMessage[]>([])
  const [testInput, setTestInput] = useState('')
  const [isTesting, setIsTesting] = useState(false)

  useEffect(() => {
    setTestMessages([])
    setTestInput('')
  }, [agentId])

  const handleTestSend = () => {
    if (!testInput.trim() || !agentId) {
      return
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: testInput
    }

    setTestMessages((prev) => [...prev, userMessage])
    setTestInput('')
    setIsTesting(true)

    const assistantMessageId = `${Date.now()}-assistant`
    setTestMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        reasoning: '',
        isStreaming: true
      }
    ])
    console.log(userMessage)

    window.api.chat.stream(
      {
        agentId,
        message: userMessage.content
      },
      (chunk) => {
        console.log('chunk', chunk)
        setTestMessages((prev) =>
          prev.map((m) => {
            if (m.id === assistantMessageId) {
              if (chunk.type === 'text') {
                return { ...m, content: m.content + chunk.content }
              } else if (chunk.type === 'reasoning') {
                return { ...m, reasoning: (m.reasoning || '') + chunk.content }
              }
            }
            return m
          })
        )
      },
      () => {
        setIsTesting(false)
        setTestMessages((prev) =>
          prev.map((m) => (m.id === assistantMessageId ? { ...m, isStreaming: false } : m))
        )
      },
      (error) => {
        console.error('Stream error:', error)
        setTestMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, content: t('testChat.streamError') } : m
          )
        )
        setIsTesting(false)
      }
    )
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-sidebar-border/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-sidebar-foreground/70" />
          <span className="text-sm font-semibold">{t('testChat.title')}</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="size-8 p-0 hover:bg-sidebar-accent"
          onClick={() => setTestMessages([])}
          disabled={testMessages.length === 0}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Messages */}
      <ChatContainerRoot className="flex-1 flex-col">
        <ChatContainerContent className="space-y-4 p-4 flex-col">
          {testMessages.length === 0 ? (
            <div className="flex h-full min-h-[400px] items-center justify-center text-center">
              <div>
                <div className="relative mx-auto w-16 h-16 mb-4">
                  <div className="absolute inset-0 rounded-full bg-linear-to-br from-primary/10 to-primary/5 border border-primary/20 shadow-lg shadow-primary/10 flex items-center justify-center">
                    <Bot className="size-8 text-primary" />
                  </div>
                  <div className="absolute inset-0 rounded-full bg-linear-to-br from-primary/20 via-primary/10 to-transparent blur-xl animate-pulse-soft" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  {t('testChat.emptyTitle')}
                </h3>
                <p className="text-xs text-muted-foreground">{t('testChat.emptyDescription')}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {testMessages.map((message) => {
                const isAssistant = message.role === 'assistant'

                return (
                  <Message
                    key={message.id}
                    className={message.role === 'user' ? 'justify-end' : 'justify-start'}
                  >
                    {isAssistant && <MessageAvatar src="" alt="AI Assistant" fallback="AI" />}
                    <div className="max-w-[85%] flex-1 sm:max-w-[75%]">
                      {isAssistant ? (
                        <div className="space-y-3">
                          {message.reasoning && (
                            <Reasoning isStreaming={message.isStreaming}>
                              <ReasoningTrigger className="text-xs">
                                <div className="flex items-center gap-2">
                                  <Brain className="h-3.5 w-3.5" />
                                  {t('testChat.reasoning')}
                                </div>
                              </ReasoningTrigger>
                              <ReasoningContent
                                markdown
                                className="ml-2 mt-2 border-l-2 border-border pl-3"
                                contentClassName="text-xs"
                              >
                                {message.reasoning}
                              </ReasoningContent>
                            </Reasoning>
                          )}
                          {message.content && (
                            <div className="prose dark:prose-invert rounded-lg bg-secondary p-3 text-sm text-foreground">
                              <Markdown>{message.content}</Markdown>
                            </div>
                          )}
                        </div>
                      ) : (
                        <MessageContent className="bg-primary text-primary-foreground">
                          {message.content}
                        </MessageContent>
                      )}
                    </div>
                  </Message>
                )
              })}
            </div>
          )}
        </ChatContainerContent>
        <ChatContainerScrollAnchor />
        <div className="absolute right-4 bottom-4">
          <ScrollButton className="shadow-sm" />
        </div>
      </ChatContainerRoot>

      {/* Input */}
      <div className="border-t border-sidebar-border/50 p-3">
        <div className="flex gap-2">
          <Textarea
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleTestSend()
              }
            }}
            placeholder={t('testChat.placeholder')}
            className="min-h-[60px] resize-none text-sm bg-background"
            disabled={isTesting}
          />
          <Button
            size="icon"
            onClick={handleTestSend}
            disabled={!testInput.trim() || isTesting}
            className="shrink-0 size-9"
          >
            {isTesting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t('testChat.hintKeys')}</p>
      </div>
    </div>
  )
}
