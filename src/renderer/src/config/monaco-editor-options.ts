import type { editor } from 'monaco-editor'
import * as monaco from 'monaco-editor'

/**
 * 默认的 Monaco 编辑器配置
 * 可以被外部 options 覆盖
 *
 * ⭐ Web Worker 优化：
 * Monaco Editor 已配置使用 Web Workers 处理：
 * - 语法高亮和语法分析
 * - TypeScript/JavaScript 类型检查
 * - JSON/CSS/HTML 验证
 * - 代码提示和自动完成
 *
 * 这些密集型任务在 Worker 线程中运行，不会阻塞主线程
 */
export const defaultEditorOptions: editor.IStandaloneEditorConstructionOptions = {
  fontSize: 14,
  fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Monaco', monospace",
  fontLigatures: true,
  fontWeight: '450',
  lineHeight: 1.6 * 14,
  letterSpacing: 0.3,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  insertSpaces: true,
  detectIndentation: true,
  trimAutoWhitespace: true,
  wordWrap: 'off',
  wordWrapColumn: 120,
  wrappingIndent: 'indent',
  smoothScrolling: true,
  cursorSmoothCaretAnimation: 'on',
  lineNumbers: 'on',
  glyphMargin: false,
  folding: true,
  lineDecorationsWidth: 8,
  lineNumbersMinChars: 3,
  renderLineHighlight: 'all',
  renderWhitespace: 'boundary',
  renderControlCharacters: false,
  minimap: { enabled: false },
  scrollbar: {
    useShadows: false,
    verticalHasArrows: false,
    horizontalHasArrows: false,
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
    alwaysConsumeMouseWheel: false
  },
  overviewRulerLanes: 3,
  hideCursorInOverviewRuler: false,
  overviewRulerBorder: false,
  cursorBlinking: 'smooth',
  cursorStyle: 'line',
  cursorWidth: 2,
  cursorSurroundingLines: 3,
  cursorSurroundingLinesStyle: 'default',
  selectionHighlight: true,
  occurrencesHighlight: 'singleFile',
  bracketPairColorization: { enabled: false },
  matchBrackets: 'always',
  autoClosingBrackets: 'languageDefined',
  autoClosingQuotes: 'languageDefined',
  autoSurround: 'languageDefined',
  // 🔥 双层补全策略（Cursor 完整方案）
  // 第1层：LSP 补全（Ctrl+Space 手动触发）- 快速、精准、本地
  // 第2层：AI 补全（自动触发）- 智能、生成、云端

  // LSP Suggest Widget 配置
  quickSuggestions: false, // ❌ 禁用自动弹出（避免干扰 AI）
  suggestOnTriggerCharacters: true, // ✅ 允许触发字符（如 .）触发补全
  acceptSuggestionOnCommitCharacter: false, // ❌ 输入字符不自动接受
  acceptSuggestionOnEnter: 'on', // ✅ Enter 接受 suggest 项
  snippetSuggestions: 'inline',
  tabCompletion: 'off', // ✅ Tab 留给 AI inline 补全
  wordBasedSuggestions: 'off',
  suggest: {
    showWords: false,
    showSnippets: false
  },
  // 🔥 启用 Inline Completions (灰色预览补全)
  inlineSuggest: {
    enabled: true,
    mode: 'prefix' as any,
    showToolbar: 'onHover' as any
  },
  formatOnPaste: true,
  formatOnType: true,
  hover: { enabled: true, delay: 300, sticky: true },
  lightbulb: { enabled: monaco.editor.ShowLightbulbIconMode.Off },
  padding: { top: 20, bottom: 20 },
  stickyScroll: { enabled: true },
  unicodeHighlight: { ambiguousCharacters: true, invisibleCharacters: true },
  accessibilitySupport: 'off',
  readOnly: false

  // ⭐ 性能优化说明：
  // Monaco Editor 已通过 vite-plugin-monaco-editor-esm 配置 Web Workers
  // 以下任务自动在 Worker 线程中运行，无需额外配置：
  // - 语法高亮和语法分析
  // - TypeScript/JavaScript 类型检查
  // - JSON/CSS/HTML 验证
  // - 代码提示和自动完成
  // 这些密集型任务不会阻塞主线程，编辑器响应更快
}

/**
 * 默认的 Diff 编辑器配置
 */
export const defaultDiffEditorOptions: editor.IStandaloneDiffEditorConstructionOptions = {
  ...defaultEditorOptions,
  renderSideBySide: false,
  renderIndicators: false,
  renderGutterMenu: false,
  renderOverviewRuler: false,
  enableSplitViewResizing: false,
  ignoreTrimWhitespace: false,
  renderMarginRevertIcon: false,
  diffCodeLens: false,
  diffWordWrap: 'off'
}
