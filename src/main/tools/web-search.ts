import { z } from 'zod'
import https from 'https'
import { getConfigService } from '../index'

/**
 * 网络搜索工具
 * 使用 Bing Search API，API Key 从应用设置读取。
 */
export const webSearchTool = {
  description: `Search the web for real-time information about any topic. Use this tool when you need up-to-date information that might not be available in your training data, or when you need to verify current facts. The search results will include relevant snippets and URLs from web pages. This is particularly useful for questions about current events, technology updates, or any topic that requires recent information.`,

  parameters: z.object({
    search_term: z
      .string()
      .describe(
        'The search term to look up on the web. Be specific and include relevant keywords for better results'
      ),
    explanation: z
      .string()
      .optional()
      .describe('One sentence explanation as to why this tool is being used')
  }),

  execute: async ({ search_term, explanation }: { search_term: string; explanation?: string }) => {
    try {
      console.log(`[WebSearch] ${explanation || 'Searching the web'}`)
      console.log(`[WebSearch] Query: "${search_term}"`)

      const apiKey = getConfigService().getSearchSettings()?.bingApiKey?.trim()
      if (!apiKey) {
        console.warn('[WebSearch] Bing API key not configured in settings')
        return {
          success: false,
          error: 'Web search API key not configured',
          suggestion: '在设置中配置网页搜索 (Bing) API Key 以启用网页搜索',
          query: search_term
        }
      }

      // 使用 Bing Search API
      const results = await searchBing(search_term, apiKey)

      return {
        success: true,
        query: search_term,
        results:
          results.webPages?.value?.map((item: any) => ({
            title: item.name,
            url: item.url,
            snippet: item.snippet,
            datePublished: item.datePublished
          })) || [],
        totalResults: results.webPages?.totalEstimatedMatches || 0
      }
    } catch (error: any) {
      console.error('[WebSearch] Error:', error)
      return {
        success: false,
        error: error.message,
        query: search_term
      }
    }
  }
}

// 使用 Bing Search API 搜索
async function searchBing(query: string, apiKey: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.bing.microsoft.com',
      path: `/v7.0/search?q=${encodeURIComponent(query)}&count=10&responseFilter=Webpages`,
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey
      }
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          resolve(result)
        } catch {
          reject(new Error('Failed to parse search results'))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('Search request timeout'))
    })

    req.end()
  })
}
