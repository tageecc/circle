/**
 * 主进程服务配置常量
 *
 * 包含所有主进程服务的硬编码配置值
 * 注意：这些值应该尽可能从 ConfigService 读取
 */

// ============================================================================
// Language Service 配置
// ============================================================================

export const LANGUAGE_SERVICE = {
  /** 补全请求超时时间（毫秒） */
  COMPLETION_TIMEOUT: 500,

  /** Hover 请求超时时间（毫秒） */
  HOVER_TIMEOUT: 1000,

  /** Hover 缓存有效期（毫秒） */
  HOVER_CACHE_TTL: 5000,

  /** 缓存清理间隔（毫秒） */
  CACHE_CLEANUP_INTERVAL: 10000,

  /** 过期缓存清理阈值（毫秒） */
  CACHE_EXPIRY_THRESHOLD: 10000,

  /** 文件内容更新防抖延迟（毫秒） */
  UPDATE_DEBOUNCE: 300
} as const

// ============================================================================
// 代码补全配置
// ============================================================================

export const COMPLETION = {
  /** 补全请求超时时间（毫秒） */
  TIMEOUT: 5000,

  /** 前缀上下文行数 */
  PREFIX_CONTEXT_LINES: 30,

  /** 后缀上下文行数 */
  SUFFIX_CONTEXT_LINES: 10,

  /** Temperature 参数（0-1，控制随机性） */
  TEMPERATURE: 0.2,

  /** 最大重试次数 */
  MAX_RETRY_ATTEMPTS: 2
} as const

// ============================================================================
// 代码索引配置
// ============================================================================

export const CODEBASE_INDEX = {
  /** 最大文件大小（字节）- 1MB */
  MAX_FILE_SIZE: 1024 * 1024,

  /** 分块最大大小（tokens） */
  CHUNK_MAX_SIZE: 512,

  /** 分块重叠大小（tokens） */
  CHUNK_OVERLAP: 50,

  /** 并发度配置 */
  CONCURRENCY: {
    /** 小项目（< 100 文件） */
    SMALL: 8,
    /** 中型项目（100-500 文件） */
    MEDIUM: 12,
    /** 大型项目（500-2000 文件） */
    LARGE: 16,
    /** 超大项目（> 2000 文件） */
    XLARGE: 20
  }
} as const

// ============================================================================
// 终端配置
// ============================================================================

export const TERMINAL = {
  /** 输出缓冲区最大大小（字节）- 50KB */
  MAX_OUTPUT_BUFFER: 50000
} as const

// ============================================================================
// OAuth 配置
// ============================================================================

export const OAUTH = {
  /** OAuth 回调服务器端口 */
  CALLBACK_PORT: 13337
} as const

// ============================================================================
// AI 模型配置
// ============================================================================

export const AI_MODEL = {
  /** 编辑文件时的 temperature（零随机性） */
  EDIT_FILE_TEMPERATURE: 0,

  /** 聊天默认 temperature（从用户设置读取，此为后备值） */
  DEFAULT_TEMPERATURE: 0.7
} as const

// ============================================================================
// Agent harness (context window, MCP deltas, smart context budgeting)
// ============================================================================

export const AGENT_HARNESS = {
  /** Rough tokenizer: characters per token (mixed languages) */
  CHARS_PER_TOKEN: 3.5,
  /** Default max input context when model-specific limit unknown */
  DEFAULT_MAX_INPUT_TOKENS: 120_000,
  /** Reserve headroom for model output + tool JSON */
  RESERVE_OUTPUT_TOKENS: 16_000,
  /** Max characters kept per tool result when still over budget after pruning */
  MAX_TOOL_RESULT_CHARS_IN_CONTEXT: 24_000,
  /** Second pass: shrink tool payloads before dropping below MIN_MESSAGES_TO_PRESERVE */
  MAX_TOOL_RESULT_CHARS_AGGRESSIVE: 8_000,
  /** Do not prune below this count until aggressive truncation runs (then may go lower) */
  MIN_MESSAGES_TO_PRESERVE: 4,
  /** Git snapshot block max size */
  GIT_SNIPPET_MAX_CHARS: 2500,
  /** Marker between stable product instructions and per-turn environment (future prompt cache) */
  DYNAMIC_CONTEXT_BOUNDARY: '\n---\n## Current session context (changes every message)\n---\n',
  /** Pre-prune LLM summary: need at least this many messages to consider summarizing head */
  SUMMARY_MIN_MESSAGES: 14,
  /** Messages kept verbatim at tail (includes current user turn) */
  SUMMARY_TAIL_MESSAGES: 8,
  /** Micro-compact: leave this many latest messages untouched before placeholdering old tool blobs */
  MICROCOMPACT_PRESERVE_LAST: 6,
  /** Run summary when estimated message tokens exceed this fraction of budget */
  SUMMARY_TRIGGER_BUDGET_RATIO: 0.55,
  /** Max chars per message for plain text / text & reasoning parts (single huge paste guard) */
  MAX_MESSAGE_TEXT_CHARS_IN_CONTEXT: 96_000,

  /** OpenAI-compatible chat.completions: max output tokens per request (reduces mid-stream truncation) */
  OPENAI_MAX_COMPLETION_TOKENS: 16_384,

  /** Single streaming HTTP request timeout (model can be slow; keep above generic NETWORK.REQUEST_TIMEOUT) */
  NATIVE_CHAT_FETCH_TIMEOUT_MS: 180_000,

  /** After finish_reason length (or equivalent), append messages and re-request up to this many times */
  MAX_OUTPUT_LENGTH_RECOVERIES: 5,

  /**
   * If the last context message before the model call was tool output and the model returns
   * stop with text only (no tool calls), inject one continuation user message — improves models that "plan then stop".
   */
  POST_TOOL_SOFT_NUDGE_MAX_PER_ROUND: 1
} as const

// ============================================================================
// 文件监控配置
// ============================================================================

export const FILE_WATCHER = {
  /** 忽略的文件夹模式 */
  IGNORED_PATTERNS: [
    'node_modules',
    '.git',
    'dist',
    'build',
    'out',
    '.next',
    'coverage',
    'temp',
    '.cache',
    '.temp',
    '.vscode',
    '.idea'
  ]
} as const

// ============================================================================
// Git 配置
// ============================================================================

export const GIT = {
  /** Git 操作超时时间（毫秒） */
  OPERATION_TIMEOUT: 30000,

  /** Diff 最大行数 */
  MAX_DIFF_LINES: 10000
} as const

// ============================================================================
// 网络配置
// ============================================================================

export const NETWORK = {
  /** HTTP 请求超时时间（毫秒） */
  REQUEST_TIMEOUT: 10000,

  /** 重试次数 */
  MAX_RETRIES: 3,

  /** 重试延迟（毫秒） */
  RETRY_DELAY: 1000
} as const

// ============================================================================
// 性能配置
// ============================================================================

export const PERFORMANCE = {
  /** 大文件阈值（字节）- 1MB */
  LARGE_FILE_THRESHOLD: 1024 * 1024,

  /** 语法高亮最大文件大小（字节）- 5MB */
  MAX_SYNTAX_HIGHLIGHT_SIZE: 5 * 1024 * 1024
} as const
