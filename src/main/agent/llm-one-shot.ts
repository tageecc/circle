/**
 * Single-turn text generation via native HTTP/SDKs — OpenAI-compatible, Anthropic Messages, or Gemini.
 */

import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ConfigService } from '../services/config.service'
import { resolveOpenAICompatibleEndpoint } from './native/resolve-openai-endpoint'

export type OneShotParams = {
  modelId: string
  configService: ConfigService
  system?: string
  prompt: string
  temperature?: number
  maxOutputTokens?: number
  abortSignal?: AbortSignal
}

function anthropicKey(config: ConfigService): string | null {
  return config.getApiKey('anthropic') || process.env.ANTHROPIC_API_KEY || null
}

function googleKey(config: ConfigService): string | null {
  return config.getApiKey('google') || process.env.GOOGLE_API_KEY || null
}

export async function generateTextOneShot(params: OneShotParams): Promise<string> {
  const { modelId, configService, system, prompt, temperature, maxOutputTokens, abortSignal } =
    params
  const [provider, model] = modelId.split('/')
  if (!provider || !model) {
    throw new Error(`Invalid modelId: ${modelId}`)
  }

  const openai = resolveOpenAICompatibleEndpoint(modelId, configService)
  if (openai) {
    const messages: Array<{ role: string; content: string }> = []
    if (system) messages.push({ role: 'system', content: system })
    messages.push({ role: 'user', content: prompt })
    const res = await fetch(`${openai.baseURL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openai.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: openai.model,
        messages,
        temperature: temperature ?? 0.3,
        max_tokens: maxOutputTokens ?? 4096
      }),
      signal: abortSignal
    })
    if (!res.ok) {
      throw new Error(`One-shot HTTP ${res.status}: ${await res.text()}`)
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>
    }
    const text = json.choices?.[0]?.message?.content
    return typeof text === 'string' ? text : ''
  }

  if (provider === 'Anthropic') {
    const apiKey = anthropicKey(configService)
    if (!apiKey) throw new Error('Anthropic API key not configured')
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model,
      max_tokens: maxOutputTokens ?? 4096,
      system: system ?? undefined,
      messages: [{ role: 'user', content: prompt }],
      temperature: temperature ?? 0.3
    })
    let anthropicText = ''
    for (const b of msg.content) {
      if (b.type === 'text') anthropicText += b.text
    }
    return anthropicText
  }

  if (provider === 'Google') {
    const apiKey = googleKey(configService)
    if (!apiKey) throw new Error('Google API key not configured')
    const genAI = new GoogleGenerativeAI(apiKey)
    const m = genAI.getGenerativeModel({
      model,
      systemInstruction: system
    })
    const result = await m.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: temperature ?? 0.3,
        maxOutputTokens: maxOutputTokens ?? 4096
      }
    })
    return result.response.text()
  }

  throw new Error(`One-shot not supported for provider: ${provider}`)
}
