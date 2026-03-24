import type { editor } from 'monaco-editor'
import * as monaco from 'monaco-editor'

/**
 * Monaco 编辑器配置选项
 * 统一管理 CodeEditor 和 DiffEditor 的配置，确保一致的编辑体验
 */

export interface EditorSettings {
  fontSize: number
  fontFamily: string
  lineHeight: number
  tabSize: number
  wordWrap: boolean
  lineNumbers: boolean
  minimap: boolean
  gitBlame: boolean
}

/**
 * 生成基础编辑器配置选项
 * 适用于普通编辑器（CodeEditor）
 */
export function createEditorOptions(
  editorSettings: EditorSettings,
  readOnly: boolean = false
): editor.IStandaloneEditorConstructionOptions {
  return {
    fontSize: editorSettings.fontSize,
    fontFamily: editorSettings.fontFamily,
    fontLigatures: true,
    fontWeight: '450',
    lineHeight: editorSettings.lineHeight * editorSettings.fontSize,
    letterSpacing: 0.3,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: editorSettings.tabSize,
    insertSpaces: true,
    detectIndentation: true,
    trimAutoWhitespace: true,
    wordWrap: editorSettings.wordWrap ? 'on' : 'off',
    wordWrapColumn: 120,
    wrappingIndent: 'indent',
    smoothScrolling: true,
    cursorSmoothCaretAnimation: 'on',
    lineNumbers: editorSettings.lineNumbers ? 'on' : 'off',
    glyphMargin: false,
    folding: true,
    lineDecorationsWidth: 8,
    lineNumbersMinChars: 3,
    renderLineHighlight: 'all',
    renderWhitespace: 'boundary',
    renderControlCharacters: false,
    minimap: { enabled: editorSettings.minimap },
    scrollbar: {
      useShadows: false,
      verticalHasArrows: false,
      horizontalHasArrows: false,
      verticalScrollbarSize: 4,
      horizontalScrollbarSize: 4,
      alwaysConsumeMouseWheel: false
    },
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    overviewRulerBorder: false,
    cursorBlinking: 'smooth',
    cursorStyle: 'line',
    cursorWidth: 2,
    cursorSurroundingLines: 3,
    cursorSurroundingLinesStyle: 'default',
    selectionHighlight: true,
    occurrencesHighlight: 'singleFile',
    bracketPairColorization: { enabled: true },
    matchBrackets: 'always',
    autoClosingBrackets: 'languageDefined',
    autoClosingQuotes: 'languageDefined',
    autoSurround: 'languageDefined',
    /** AI 行内补全与 LSP 列表补全分层：输入时不自动弹出单词/LSP，避免与幽灵文本抢交互 */
    quickSuggestions: false,
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnCommitCharacter: true,
    acceptSuggestionOnEnter: 'on',
    snippetSuggestions: 'top',
    tabCompletion: 'off',
    wordBasedSuggestions: 'off',
    suggest: {
      showStatusBar: false,
      preview: false,
      showWords: false,
      showSnippets: false
    },
    inlineSuggest: {
      enabled: true,
      mode: 'prefix',
      showToolbar: 'never',
      suppressSuggestions: true
    },
    formatOnPaste: true,
    formatOnType: true,
    hover: { enabled: true, delay: 300, sticky: true },
    lightbulb: { enabled: monaco.editor.ShowLightbulbIconMode.Off },
    padding: { top: 20, bottom: 20 },
    guides: { indentation: true, bracketPairs: true, highlightActiveBracketPair: true },
    stickyScroll: { enabled: true },
    unicodeHighlight: { ambiguousCharacters: true, invisibleCharacters: true },
    accessibilitySupport: 'off',
    readOnly
  }
}

/**
 * 生成 Diff 编辑器配置选项
 * 基于基础配置，添加 Diff 编辑器特有的配置
 */
export function createDiffEditorOptions(
  editorSettings: EditorSettings,
  readOnly: boolean = false,
  renderSideBySide: boolean = false
): editor.IStandaloneDiffEditorConstructionOptions {
  const baseOptions = createEditorOptions(editorSettings, readOnly)

  return {
    ...baseOptions,
    readOnly,
    renderSideBySide,
    renderIndicators: false,
    renderGutterMenu: false,
    renderOverviewRuler: false,
    // Diff 编辑器特有配置
    enableSplitViewResizing: true,
    ignoreTrimWhitespace: false,
    renderMarginRevertIcon: true,
    diffCodeLens: false,
    diffWordWrap: 'off'
  }
}

/**
 * 默认编辑器设置
 * 用于在没有用户设置时提供默认值
 */
export const defaultEditorSettings: EditorSettings = {
  fontSize: 14,
  fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Monaco', monospace",
  lineHeight: 1.6,
  tabSize: 2,
  wordWrap: false,
  lineNumbers: true,
  minimap: false,
  gitBlame: false
}
