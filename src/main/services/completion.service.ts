import * as path from 'path'
import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'
import type { ConfigService } from './config.service'
import { AgentService } from './agent.service'
import { COMPLETION } from '../constants/completion.constants'
import { getProjectRootForFile, getShadowWorkspace } from './shadow-workspace.service'

export interface CompletionRequest {
  filePath: string
  fileContent: string
  line: number
  column: number
  enableValidation?: boolean
}

export type CompletionChunk =
  | {
      type: 'done'
      text: string
      metrics?: { validated?: boolean; attempts?: number; errors?: number }
    }
  | { type: 'error'; error: string }

export class CompletionService {
  private agentService = new AgentService()

  constructor(private configService: ConfigService) {}

  async generateCompletion(request: CompletionRequest): Promise<CompletionChunk> {
    if (this.configService.getCompletionSettings()?.enabled === false) {
      return { type: 'error', error: 'completion_disabled' }
    }

    const ext = path.extname(request.filePath).toLowerCase()
    const tsJs = ['.ts', '.tsx', '.js', '.jsx'].includes(ext)

    if (request.enableValidation && tsJs) {
      try {
        return await this.generateWithValidation(request)
      } catch (e) {
        console.warn('[Completion] validation path failed, fallback:', e)
      }
    }

    return this.generateWithoutValidation(request)
  }

  private async generateWithValidation(request: CompletionRequest): Promise<CompletionChunk> {
    const projectRoot = getProjectRootForFile(request.filePath) || path.dirname(request.filePath)
    const shadow = getShadowWorkspace(projectRoot)

    let previousErrors: Array<{ line: number; message: string }> | undefined
    let lastText = ''
    let attempts = 0
    let errorCount = 0

    for (let attempt = 1; attempt <= COMPLETION.MAX_RETRY_ATTEMPTS; attempt++) {
      attempts = attempt
      const text = await this.generateText(request, previousErrors)
      if (!text) {
        return { type: 'error', error: '模型未返回补全内容' }
      }
      lastText = text

      const v = await shadow.validateCompletion({
        filePath: request.filePath,
        originalContent: request.fileContent,
        cursorLine: request.line,
        column: request.column,
        completionText: text
      })

      if (v.isValid) {
        return {
          type: 'done',
          text,
          metrics: { validated: true, attempts, errors: 0 }
        }
      }

      errorCount = v.errors.length
      previousErrors = v.errors
    }

    return {
      type: 'done',
      text: lastText,
      metrics: { validated: false, attempts, errors: errorCount }
    }
  }

  private async generateWithoutValidation(request: CompletionRequest): Promise<CompletionChunk> {
    try {
      const text = await this.generateText(request, undefined)
      if (!text) {
        return { type: 'error', error: '模型未返回补全内容' }
      }
      return {
        type: 'done',
        text,
        metrics: { validated: false, attempts: 1 }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!/abort/i.test(msg)) {
        console.error('[Completion] generateWithoutValidation:', e)
      }
      return { type: 'error', error: msg }
    }
  }

  private async generateText(
    request: CompletionRequest,
    previousErrors?: Array<{ line: number; message: string }>
  ): Promise<string | null> {
    const model = await this.resolveModel()
    const userPrompt = this.buildPrompt(request)

    const system =
      previousErrors && previousErrors.length > 0
        ? `Complete code at <|fim_middle|>. Output only code, no markdown.\n\nFIX THESE ERRORS:\n${this.formatErrors(previousErrors)}`
        : 'Complete code at <|fim_middle|>. Output only code, no markdown, no explanation.'

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), COMPLETION.TIMEOUT_MS)

    try {
      const result = await generateText({
        model,
        system,
        prompt: userPrompt,
        temperature: COMPLETION.TEMPERATURE,
        maxOutputTokens: 512,
        abortSignal: controller.signal
      })

      let out = (result.text || '').trim()
      out = finalizeCompletionOutput(out, request)
      return out || null
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        return null
      }
      throw e
    } finally {
      clearTimeout(timeout)
    }
  }

  private buildPrompt(request: CompletionRequest): string {
    const lines = request.fileContent.split(/\r?\n/)
    const lineIdx = request.line - 1
    const currentLine = lines[lineIdx] ?? ''
    const beforeCursor = currentLine.slice(0, request.column - 1)
    const afterCursor = currentLine.slice(request.column - 1)

    const prefix = this.buildPrefix(lines, lineIdx, beforeCursor)
    const suffix = this.buildSuffix(lines, lineIdx, afterCursor)

    const fileSep = `<|file_sep|>${request.filePath}`
    let body = `${fileSep}\n<|fim_prefix|>${prefix}`
    if (this.shouldStartNewLine(afterCursor, prefix)) {
      body += '\n'
    }
    body += `<|fim_suffix|>${suffix}\n<|fim_middle|>`
    return body
  }

  private buildPrefix(lines: string[], lineIdx: number, beforeOnLine: string): string {
    const start = Math.max(0, lineIdx - COMPLETION.PREFIX_CONTEXT_LINES)
    const above = lines.slice(start, lineIdx)
    if (above.length === 0) return beforeOnLine
    return `${above.join('\n')}\n${beforeOnLine}`
  }

  private buildSuffix(lines: string[], lineIdx: number, afterOnLine: string): string {
    const restOfLine = afterOnLine
    const end = Math.min(lines.length, lineIdx + 1 + COMPLETION.SUFFIX_CONTEXT_LINES)
    const below = lines.slice(lineIdx + 1, end)
    if (below.length === 0) return restOfLine
    return `${restOfLine}\n${below.join('\n')}`
  }

  private shouldStartNewLine(after: string, prefixBlock: string): boolean {
    if (after.length > 0) return false
    const lastLine = prefixBlock.split('\n').pop() || ''
    if (lastLine.trim().length === 0) return false
    return lastLine.trim().length > 20
  }

  private formatErrors(errors: Array<{ line: number; message: string }>): string {
    return errors
      .slice(0, 3)
      .map((e) => `Line ${e.line}: ${e.message}`)
      .join('\n')
  }

  private async resolveModel(): Promise<LanguageModel> {
    const cs = this.configService.getCompletionSettings()
    if (cs?.provider && cs?.model) {
      return buildLanguageModel(cs.provider, cs.model, cs.apiKey)
    }

    const agent = await this.agentService.getDefaultAgent()
    return buildLanguageModel(agent.provider, agent.model, agent.apiKey)
  }
}

async function buildLanguageModel(
  provider: string,
  model: string,
  apiKey?: string | null
): Promise<LanguageModel> {
  const m = model.includes('/') ? model.split('/').pop()! : model
  const p = provider.toLowerCase()
  const key = apiKey?.trim()

  if (p === 'openai') {
    if (!key) throw new Error('OpenAI API Key 未配置')
    return createOpenAI({ apiKey: key })(m)
  }
  if (p === 'anthropic') {
    if (!key) throw new Error('Anthropic API Key 未配置')
    return createAnthropic({ apiKey: key })(m)
  }
  if (p === 'google') {
    if (!key) throw new Error('Google API Key 未配置')
    return createGoogleGenerativeAI({ apiKey: key })(m)
  }
  if (p === 'dashscope') {
    if (!key) throw new Error('DashScope API Key 未配置')
    return createOpenAI({
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: key
    })(m)
  }

  throw new Error(`不支持的补全提供商: ${provider}（请用 openai / anthropic / google / dashscope）`)
}

function finalizeCompletionOutput(text: string, request: CompletionRequest): string {
  let t = text.trim()

  const fence = /^```[\w]*\n([\s\S]*?)\n```$/m
  const fm = t.match(fence)
  if (fm) t = fm[1].trim()

  t = t.replace(/<\|fim_[^|]+\|>/g, '')
  t = t.replace(/<\|endoftext\|>/gi, '')
  const ot = '<' + 'think' + '>'
  const ct = '<' + '/' + 'think' + '>'
  t = t.replace(new RegExp(ot + '[\\s\\S]*?' + ct, 'gi'), '')
  t = t.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')

  const lines = request.fileContent.split(/\r?\n/)
  const lineIdx = request.line - 1
  const line = lines[lineIdx] ?? ''
  const before = line.slice(0, request.column - 1)
  const lastThree = before.trim().split(/\s+/).filter(Boolean).slice(-3)
  if (lastThree.length) {
    const prefix = lastThree.join(' ')
    if (t.startsWith(prefix)) t = t.slice(prefix.length)
  }

  const parts = t.split('\n')
  if (parts.length > COMPLETION.MAX_COMPLETION_LINES) {
    t = parts.slice(0, COMPLETION.MAX_COMPLETION_LINES).join('\n')
  }

  return t.trim()
}
