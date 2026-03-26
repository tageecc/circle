import { tool } from 'ai'
import { z } from 'zod'
import https from 'https'

const inputSchema = z.object({
  search_term: z
    .string()
    .describe(
      'The search term to look up on the web. Be specific and include relevant keywords for better results'
    ),
  explanation: z
    .string()
    .optional()
    .describe('One sentence explanation as to why this tool is being used')
})

/**
 * 网络搜索工具
 */
export const webSearchTool = tool({
  description: `Search the web for real-time information using Bing Search API. Returns relevant web pages with snippets and URLs.

### When to Use This Tool

Use web_search when you need:
- **Information beyond your training data** (current events, recent releases)
- **Latest documentation** for frameworks/libraries
- **Up-to-date facts** that change over time (prices, versions, statistics)
- **Current best practices** or breaking changes
- **Recent news or announcements** about technologies
- **Verification** of information that might have changed

### When NOT to Use

Skip web_search for:
- **Information in the codebase** → use \`codebase_search\` or \`grep\`
- **General programming knowledge** → use your training (faster, free)
- **Local project information** → use \`read_file\` or \`list_dir\`
- **Calculations or logic** → compute directly (don't waste API calls)
- **Stable/historical information** → likely in your training data

### Cost Awareness

Each web search:
- Makes an external API call (costs money)
- Takes 1-3 seconds to complete
- Has rate limits

**Think twice**: Is this information really not in your training data? Could you solve this another way?

### Search Query Best Practices

**Good queries** (specific, targeted):
- "React 19 new features 2026"
- "TypeScript 5.5 breaking changes"
- "Electron 32 security updates"
- "Next.js 15 app router migration guide"

**Bad queries** (too general, computable, or unnecessary):
- "what is React" (in training data)
- "how to use useState" (basic knowledge)
- "calculate 2+2" (don't waste API calls)
- "read this file" (wrong tool)

### Decision Guide

<example>
  Query: What are the new features in React 19?
  Tool: web_search
  Search: "React 19 new features official release 2026"
  <reasoning>
    Good: Recent version likely beyond training cutoff, need latest docs
  </reasoning>
</example>

<example>
  Query: How does useState work?
  Tool: NONE (use training data)
  <reasoning>
    Bad: Basic React hook knowledge, well within training data
  </reasoning>
</example>

<example>
  Query: Find where authentication is implemented
  Tool: codebase_search (NOT web_search)
  <reasoning>
    Bad for web_search: Local codebase question, no internet needed
  </reasoning>
</example>

<example>
  Query: What's the latest stable version of Node.js?
  Tool: web_search
  Search: "Node.js latest LTS version 2026"
  <reasoning>
    Good: Version info changes monthly, need current data
  </reasoning>
</example>

### Return Format

Returns JSON with:
- **success**: Whether search succeeded
- **results**: Array of {title, url, snippet, datePublished}
- **totalResults**: Estimated total matches
- **error**: Error message if failed (e.g., API key not configured)

### Important Notes
- Requires BING_SEARCH_API_KEY environment variable
- Returns mock error if not configured
- Results limited to top 10 matches
- Includes date published when available
- Automatically times out after 10 seconds`,
  inputSchema,
  execute: async ({ search_term, explanation }) => {
    try {
      console.log(`[WebSearch] ${explanation || 'Searching the web'}`)
      console.log(`[WebSearch] Query: "${search_term}"`)

      const apiKey = process.env.BING_SEARCH_API_KEY
      if (!apiKey) {
        console.warn('[WebSearch] BING_SEARCH_API_KEY not configured, returning mock results')
        return JSON.stringify({
          success: false,
          error: 'Web search API key not configured',
          suggestion: 'Set BING_SEARCH_API_KEY environment variable to enable web search',
          query: search_term
        })
      }

      const results = await searchBing(search_term, apiKey)

      return JSON.stringify({
        success: true,
        query: search_term,
        results:
          results.webPages?.value?.map((item: BingSearchResult) => ({
            title: item.name,
            url: item.url,
            snippet: item.snippet,
            datePublished: item.datePublished
          })) || [],
        totalResults: results.webPages?.totalEstimatedMatches || 0
      })
    } catch (error: unknown) {
      const err = error as Error
      console.error('[WebSearch] Error:', err)
      return JSON.stringify({
        success: false,
        error: err.message,
        query: search_term
      })
    }
  }
})

interface BingSearchResult {
  name: string
  url: string
  snippet: string
  datePublished?: string
}

interface BingSearchResponse {
  webPages?: {
    value?: BingSearchResult[]
    totalEstimatedMatches?: number
  }
}

async function searchBing(query: string, apiKey: string): Promise<BingSearchResponse> {
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
