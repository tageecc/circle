/**
 * 应用主题配置
 * 统一管理所有颜色定义，供CSS和Monaco Editor使用
 */

export interface ThemeColors {
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  border: string
  input: string
  ring: string
  chart1: string
  chart2: string
  chart3: string
  chart4: string
  chart5: string
  sidebar: string
  sidebarForeground: string
  sidebarPrimary: string
  sidebarPrimaryForeground: string
  sidebarAccent: string
  sidebarAccentForeground: string
  sidebarBorder: string
  sidebarRing: string
}

/**
 * 语法高亮颜色配置
 */
export interface SyntaxColors {
  comment: string
  keyword: string
  operator: string
  string: string
  number: string
  regexp: string
  type: string
  function: string
  variable: string
  constant: string
  class: string
  interface: string
  namespace: string
  parameter: string
  property: string
  tag: string
  attributeName: string
  attributeValue: string
}

/**
 * Monaco编辑器特定颜色配置
 */
export interface EditorColors {
  lineHighlight: string
  selection: string
  inactiveSelection: string
  cursor: string
  whitespace: string
  indentGuide: string
  activeIndentGuide: string
  lineNumber: string
  activeLineNumber: string
  bracketMatch: string
  scrollbarSlider: string
  scrollbarSliderHover: string
  scrollbarSliderActive: string
}

/**
 * 完整主题配置
 */
export interface ThemeConfig {
  name: string
  base: 'vs' | 'vs-dark'
  colors: ThemeColors
  syntax: SyntaxColors
  editor: EditorColors
}

/**
 * One Light 主题配置（亮色模式）
 */
export const oneLightConfig: ThemeConfig = {
  name: 'one-light',
  base: 'vs',
  colors: {
    background: '#fafafa',
    foreground: '#383a42',
    card: '#f2f2f3',
    cardForeground: '#383a42',
    popover: '#ffffff',
    popoverForeground: '#383a42',
    primary: '#4078f2',
    primaryForeground: '#ffffff',
    secondary: '#e5e5e6',
    secondaryForeground: '#383a42',
    muted: '#e5e5e6',
    mutedForeground: '#a0a1a7',
    accent: '#e5e5e6',
    accentForeground: '#4078f2',
    destructive: '#e45649',
    border: '#d3d3d4',
    input: '#ffffff',
    ring: '#4078f2',
    chart1: '#4078f2',
    chart2: '#50a14f',
    chart3: '#c18401',
    chart4: '#a626a4',
    chart5: '#e45649',
    sidebar: '#fafafa',
    sidebarForeground: '#383a42',
    sidebarPrimary: '#4078f2',
    sidebarPrimaryForeground: '#ffffff',
    sidebarAccent: '#e5e5e6',
    sidebarAccentForeground: '#383a42',
    sidebarBorder: '#d3d3d4',
    sidebarRing: '#4078f2'
  },
  syntax: {
    comment: '#a0a1a7',
    keyword: '#a626a4',
    operator: '#0184bc',
    string: '#50a14f',
    number: '#986801',
    regexp: '#e45649',
    type: '#c18401',
    function: '#4078f2',
    variable: '#e45649',
    constant: '#986801',
    class: '#c18401',
    interface: '#c18401',
    namespace: '#c18401',
    parameter: '#986801',
    property: '#e45649',
    tag: '#e45649',
    attributeName: '#986801',
    attributeValue: '#50a14f'
  },
  editor: {
    lineHighlight: '#f0f0f1',
    selection: '#e5e5e6',
    inactiveSelection: '#e5e5e6',
    cursor: '#4078f2',
    whitespace: '#d3d3d4',
    indentGuide: '#d3d3d4',
    activeIndentGuide: '#c5c5c6',
    lineNumber: '#9d9d9f',
    activeLineNumber: '#383a42',
    bracketMatch: '#d3d3d4',
    scrollbarSlider: '#d4d4d580',
    scrollbarSliderHover: '#c5c5c680',
    scrollbarSliderActive: '#b5b5b680'
  }
}

/**
 * One Dark Pro 主题配置（暗色模式）
 */
export const oneDarkProConfig: ThemeConfig = {
  name: 'one-dark-pro',
  base: 'vs-dark',
  colors: {
    background: '#282c34',
    foreground: '#abb2bf',
    card: '#21252b',
    cardForeground: '#abb2bf',
    popover: '#1e2127',
    popoverForeground: '#abb2bf',
    primary: '#61afef',
    primaryForeground: '#ffffff',
    secondary: '#2c313c',
    secondaryForeground: '#abb2bf',
    muted: '#2c313c',
    mutedForeground: '#5c6370',
    accent: '#2c313c',
    accentForeground: '#61afef',
    destructive: '#e06c75',
    border: '#181a1f',
    input: '#1e2127',
    ring: '#61afef',
    chart1: '#61afef',
    chart2: '#98c379',
    chart3: '#e5c07b',
    chart4: '#c678dd',
    chart5: '#e06c75',
    sidebar: '#282c34',
    sidebarForeground: '#abb2bf',
    sidebarPrimary: '#61afef',
    sidebarPrimaryForeground: '#ffffff',
    sidebarAccent: '#2c313c',
    sidebarAccentForeground: '#abb2bf',
    sidebarBorder: '#181a1f',
    sidebarRing: '#61afef'
  },
  syntax: {
    comment: '#5c6370',
    keyword: '#c678dd',
    operator: '#56b6c2',
    string: '#98c379',
    number: '#d19a66',
    regexp: '#e06c75',
    type: '#e5c07b',
    function: '#61afef',
    variable: '#e06c75',
    constant: '#d19a66',
    class: '#e5c07b',
    interface: '#e5c07b',
    namespace: '#e5c07b',
    parameter: '#d19a66',
    property: '#e06c75',
    tag: '#e06c75',
    attributeName: '#d19a66',
    attributeValue: '#98c379'
  },
  editor: {
    lineHighlight: '#2c313c',
    selection: '#3e4451',
    inactiveSelection: '#3a3f4b',
    cursor: '#528bff',
    whitespace: '#3b4048',
    indentGuide: '#3b4048',
    activeIndentGuide: '#4b5363',
    lineNumber: '#495162',
    activeLineNumber: '#abb2bf',
    bracketMatch: '#515a6b',
    scrollbarSlider: '#4e566680',
    scrollbarSliderHover: '#5a637580',
    scrollbarSliderActive: '#747d9180'
  }
}
