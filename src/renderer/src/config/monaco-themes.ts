import type { Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { oneDarkProConfig, oneLightConfig, type ThemeConfig } from './theme.config'

/**
 * 将十六进制颜色转换为Monaco需要的格式（去掉#）
 */
function toMonacoColor(hex: string): string {
  return hex.startsWith('#') ? hex.slice(1) : hex
}

/**
 * 将主题配置转换为Monaco编辑器主题定义
 * 统一处理主题转换逻辑，消除重复代码
 */
function createMonacoTheme(config: ThemeConfig): editor.IStandaloneThemeData {
  const { colors, syntax, editor: editorColors } = config

  return {
    base: config.base,
    inherit: true,
    rules: [
      { token: '', foreground: toMonacoColor(colors.foreground) },
      { token: 'comment', foreground: toMonacoColor(syntax.comment), fontStyle: 'italic' },
      { token: 'keyword', foreground: toMonacoColor(syntax.keyword) },
      { token: 'operator', foreground: toMonacoColor(syntax.operator) },
      { token: 'string', foreground: toMonacoColor(syntax.string) },
      { token: 'number', foreground: toMonacoColor(syntax.number) },
      { token: 'regexp', foreground: toMonacoColor(syntax.regexp) },
      { token: 'type', foreground: toMonacoColor(syntax.type) },
      { token: 'function', foreground: toMonacoColor(syntax.function) },
      { token: 'variable', foreground: toMonacoColor(syntax.variable) },
      { token: 'constant', foreground: toMonacoColor(syntax.constant) },
      { token: 'class', foreground: toMonacoColor(syntax.class) },
      { token: 'interface', foreground: toMonacoColor(syntax.interface) },
      { token: 'namespace', foreground: toMonacoColor(syntax.namespace) },
      { token: 'parameter', foreground: toMonacoColor(syntax.parameter) },
      { token: 'property', foreground: toMonacoColor(syntax.property) },
      { token: 'tag', foreground: toMonacoColor(syntax.tag) },
      { token: 'attribute.name', foreground: toMonacoColor(syntax.attributeName) },
      { token: 'attribute.value', foreground: toMonacoColor(syntax.attributeValue) }
    ],
    colors: {
      'editor.background': colors.background,
      'editor.foreground': colors.foreground,
      'editor.lineHighlightBackground': editorColors.lineHighlight,
      'editor.selectionBackground': editorColors.selection,
      'editor.inactiveSelectionBackground': editorColors.inactiveSelection,
      'editorCursor.foreground': editorColors.cursor,
      'editorWhitespace.foreground': editorColors.whitespace,
      'editorIndentGuide.background': editorColors.indentGuide,
      'editorIndentGuide.activeBackground': editorColors.activeIndentGuide,
      'editorLineNumber.foreground': editorColors.lineNumber,
      'editorLineNumber.activeForeground': editorColors.activeLineNumber,
      'editorBracketMatch.background': editorColors.bracketMatch,
      'editorBracketMatch.border': editorColors.bracketMatch,
      'editorGutter.background': colors.background,
      'editorWidget.background': colors.card,
      'editorWidget.border': config.base === 'vs-dark' ? colors.border : colors.muted,
      'input.background': colors.input,
      'input.border': config.base === 'vs-dark' ? colors.border : colors.muted,
      'dropdown.background': colors.card,
      'list.activeSelectionBackground': colors.secondary,
      'list.hoverBackground': colors.secondary,
      'scrollbar.shadow': '#00000000',
      'scrollbarSlider.background': editorColors.scrollbarSlider,
      'scrollbarSlider.hoverBackground': editorColors.scrollbarSliderHover,
      'scrollbarSlider.activeBackground': editorColors.scrollbarSliderActive
    }
  }
}

// 全局单例：确保主题只注册一次
let themesRegistered = false

/**
 * 注册Monaco编辑器主题
 * 使用统一的主题配置，确保与应用主题保持一致
 * 使用单例模式，确保主题只注册一次，避免重复注册
 */
export function registerMonacoThemes(monacoInstance: Monaco): void {
  if (themesRegistered) return

  // 注册 One Dark Pro 主题（暗色）
  monacoInstance.editor.defineTheme(oneDarkProConfig.name, createMonacoTheme(oneDarkProConfig))

  // 注册 One Light 主题（亮色）
  monacoInstance.editor.defineTheme(oneLightConfig.name, createMonacoTheme(oneLightConfig))

  themesRegistered = true
}
