import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor
} from '../ui/chat-container'
import { Plus, Mic, Send, ArrowLeft, Brain } from 'lucide-react'
import { Reasoning, ReasoningTrigger, ReasoningContent } from '../ui/reasoning'
import { Markdown } from '../ui/markdown'
import { useTranslation } from 'react-i18next'

interface Message {
  id: string
  content: string
  timestamp: Date
  sender: 'user' | 'agent'
  toolUsed?: string
  reasoning?: string
}

interface Chat {
  id: string
  title: string
  timestamp: Date
}

interface ChatPanelProps {
  agentId: string
  /** Breadcrumb label; falls back to translated default when omitted */
  agentName?: string
  onBack?: () => void
}

export function ChatPanel({ agentId, agentName, onBack }: ChatPanelProps) {
  const { t, i18n } = useTranslation('chat')
  const { t: tc } = useTranslation('common')
  const [chats, setChats] = useState<Chat[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    loadThreads()
  }, [agentId, i18n.language, t])

  const loadThreads = async () => {
    try {
      setLoading(true)
      const threads = await window.api.threads.getByAgent(agentId)

      const mappedChats: Chat[] = threads.map((thread: any) => ({
        id: thread.id,
        title: thread.title || 'New Chat',
        timestamp: new Date(thread.createdAt)
      }))

      setChats(mappedChats)

      // Load first thread if exists
      if (mappedChats.length > 0) {
        loadThread(mappedChats[0].id)
      }
    } catch (error) {
      console.error('Failed to load threads:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadThread = async (threadId: string) => {
    try {
      const data = await window.api.threads.getWithMessages(threadId)

      if (data) {
        setCurrentThreadId(threadId)

        const mappedMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          timestamp: new Date(msg.createdAt),
          sender: msg.role === 'user' ? 'user' : 'agent',
          toolUsed: msg.toolCalls && msg.toolCalls.length > 0 ? msg.toolCalls[0].name : undefined
        }))

        setMessages(mappedMessages)
      }
    } catch (error) {
      console.error('Failed to load thread:', error)
    }
  }

  const handleNewChat = () => {
    setCurrentThreadId(null)
    setMessages([])
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || sending) return

    const userMessage = inputValue.trim()
    setInputValue('')
    setSending(true)

    // Add user message to UI immediately
    const tempUserMsg: Message = {
      id: Date.now().toString(),
      content: userMessage,
      timestamp: new Date(),
      sender: 'user'
    }
    setMessages((prev) => [...prev, tempUserMsg])

    // Add empty assistant message that will be updated with streaming content
    const assistantMsgId = (Date.now() + 1).toString()
    const assistantMsg: Message = {
      id: assistantMsgId,
      content: '',
      timestamp: new Date(),
      sender: 'agent',
      reasoning: ''
    }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      // Use streaming API
      window.api.chat.stream(
        {
          agentId,
          threadId: currentThreadId || undefined,
          message: userMessage
        },
        // onChunk - update the assistant message content
        (chunk) => {
          if (chunk.type !== 'text' && chunk.type !== 'reasoning') return
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMsgId) {
                if (chunk.type === 'text' && chunk.content) {
                  return { ...msg, content: msg.content + chunk.content }
                }
                if (chunk.type === 'reasoning' && chunk.content) {
                  return { ...msg, reasoning: (msg.reasoning || '') + chunk.content }
                }
              }
              return msg
            })
          )
        },
        // onEnd - finalize the message
        (threadId: string) => {
          // Update thread ID if it's a new chat
          if (!currentThreadId) {
            setCurrentThreadId(threadId)
            loadThreads() // Reload threads list
          }
          setSending(false)
        },
        // onError - show error message
        (error: string) => {
          console.error('Failed to send message:', error)
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: tc('message.unknownError') } : msg
            )
          )
          setSending(false)
        }
      )
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId ? { ...msg, content: tc('message.unknownError') } : msg
        )
      )
      setSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (date: Date) => {
    const locale = i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US'
    return date.toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: locale !== 'zh-CN'
    })
  }

  return (
    <div className="flex h-screen flex-col border-r border-border bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="icon" className="size-8" onClick={onBack}>
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <span className="text-sm text-muted-foreground">{t('panel.agentsLabel')}</span>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium">{agentName ?? t('panel.agentFallback')}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t('panel.chatTab')}</span>
          <span className="text-border">|</span>
          <span>{t('panel.tracesTab')}</span>
          <span>{t('panel.evalsTab')}</span>
        </div>
      </div>

      {/* Chat List */}
      <div className="w-full border-b border-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 rounded-none border-b border-border px-4 py-3 hover:bg-accent"
          onClick={handleNewChat}
        >
          <Plus className="size-4" />
          <span className="text-sm font-medium text-primary">{t('panel.newChat')}</span>
        </Button>
        <div className="max-h-48 overflow-y-auto">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className="cursor-pointer border-b border-border px-4 py-3 hover:bg-accent"
              onClick={() => loadThread(chat.id)}
            >
              <div className="text-xs text-muted-foreground">{t('panel.chatFrom')}</div>
              <div className="text-sm">{formatTime(chat.timestamp)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <ChatContainerRoot className="flex-1">
        <ChatContainerContent className="px-4 py-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.length === 0 && !loading && (
              <div className="flex h-full min-h-[400px] items-center justify-center text-center">
                <p className="text-muted-foreground">{t('panel.emptyPrompt')}</p>
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className="space-y-2">
                {message.sender === 'user' ? (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-primary-foreground">
                      <p className="text-sm whitespace-pre-wrap wrap-break-word">
                        {message.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {message.toolUsed && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                          <div className="size-2 rounded-full bg-blue-500" />
                          {message.toolUsed}
                        </Badge>
                      </div>
                    )}
                    {message.reasoning && (
                      <Reasoning isStreaming={sending && message.content === ''}>
                        <ReasoningTrigger className="text-xs">
                          <div className="flex items-center gap-2">
                            <Brain className="h-3.5 w-3.5" />
                            {t('reasoning.title')}
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
                    <div className="rounded-2xl bg-muted px-4 py-3">
                      <div className="prose dark:prose-invert text-sm">
                        <Markdown>{message.content}</Markdown>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ChatContainerContent>
        <ChatContainerScrollAnchor />
      </ChatContainerRoot>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="mx-auto max-w-3xl">
          <div className="relative flex items-center gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('panel.inputPlaceholder')}
              className="pr-20"
              disabled={sending}
            />
            <div className="absolute right-2 flex gap-1">
              <Button variant="ghost" size="icon" className="size-8" disabled>
                <Mic className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handleSendMessage}
                disabled={sending || !inputValue.trim()}
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
